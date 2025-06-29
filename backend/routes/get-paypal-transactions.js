// routes/paypal-transactions.js
const express = require('express');
const fetch   = require('node-fetch'); // npm install node-fetch@2
const router  = express.Router();

const cache = new Map();

router.get('/', async (req, res) => {
  console.log('💬 GET /get-paypal-transactions', req.query);

  // Seguridad
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const {
    paypal_client_id: clientId,
    paypal_secret:    clientSecret,
    paypal_mode:      rawMode,
    email:            rawEmail,
    order_id,
    woocommerce_url,
    consumer_key,
    consumer_secret
  } = req.query;

  const email = (rawEmail||'').toLowerCase();
  const mode  = rawMode === 'live' ? 'live' : 'sandbox';

  if (!clientId || !clientSecret || !email || !order_id
      || !woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  // Cache
  const cacheKey = `${order_id}|${email}|${mode}`;
  const cached   = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 5*60*1000) {
    return res.json(cached.data);
  }

  // Base URL
  const baseUrl = mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  // 1) Token
  let accessToken;
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    const tj = await tRes.json();
    if (!tRes.ok) throw new Error(tj.error_description||tj.error);
    accessToken = tj.access_token;
  } catch (e) {
    console.error('Token error:', e);
    return res.status(500).json({ error: 'Error autenticando' });
  }

  // 2) Validar pedido en Woo
  try {
    const wcRes = await fetch(
      `${woocommerce_url}/wp-json/wc/v3/orders/${order_id}`
      + `?consumer_key=${consumer_key}&consumer_secret=${consumer_secret}`
    );
    if (!wcRes.ok) throw new Error(`Woo ${wcRes.status}`);
  } catch (e) {
    console.error('Woo error:', e);
    return res.status(500).json({ error: 'Pedido no encontrado' });
  }

  // 3) Reporting sin page (solo primera página)
  let transactions = [];
  try {
    const now  = new Date().toISOString();
    const past = new Date(Date.now() - 90*24*60*60*1000).toISOString();
    const url = `${baseUrl}/v1/reporting/transactions`
      + `?start_date=${encodeURIComponent(past)}`
      + `&end_date=${encodeURIComponent(now)}`
      + `&page_size=100`
      + `&transaction_status=S`
      + `&fields=all`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!r.ok) throw new Error(`Reporting ${r.status}`);
    const j = await r.json();
    transactions = j.transaction_details || [];
  } catch (e) {
    console.error('Reporting error:', e);
    return res.status(500).json({ error: 'Error listado PayPal' });
  }

  // 4) Filtrar por email y ordenar
  const output = transactions
    .filter(t => 
      t.payer_info?.email_address?.toLowerCase() === email
    )
    .sort((a,b) =>
      new Date(b.transaction_info.transaction_initiation_date)
      - new Date(a.transaction_info.transaction_initiation_date)
    )
    .map(t => ({
      id: t.transaction_info.transaction_id,
      status: t.transaction_info.transaction_status,
      amount: {
        value: parseFloat(t.transaction_info.transaction_amount.value).toFixed(2),
        currency_code: t.transaction_info.transaction_amount.currency_code
      },
      payer_email: t.payer_info?.email_address||null,
      date: t.transaction_info.transaction_initiation_date
    }));

  // Cache y respuesta
  cache.set(cacheKey, { timestamp: Date.now(), data: output });
  res.json(output);
});

module.exports = router;
