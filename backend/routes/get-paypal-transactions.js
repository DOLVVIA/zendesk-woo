const express = require('express');
const fetch   = require('node-fetch'); // npm install node-fetch@2
const router  = express.Router();

const cache = new Map();

router.get('/', async (req, res) => {
  console.log('💬 GET /get-paypal-transactions', req.query);

  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
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

  const email = (rawEmail || '').toLowerCase();
  const mode  = rawMode === 'live' ? 'live' : 'sandbox';

  if (!clientId || !clientSecret || !email || !order_id
      || !woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({ error: 'Faltan parámetros obligatorios' });
  }

  const cacheKey = `${order_id}|${email}|${mode}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 5*60*1000) {
    console.log('🚀 Devolviendo desde cache');
    return res.json(cached.data);
  }

  const baseUrl = mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  // 1) token
  let accessToken;
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(500).json({ error: tokenJson.error_description||tokenJson.error });
    }
    accessToken = tokenJson.access_token;
  } catch (err) {
    return res.status(500).json({ error: 'Error autenticando en PayPal' });
  }

  // 2) verificar pedido Woo
  try {
    const wcRes = await fetch(
      `${woocommerce_url}/wp-json/wc/v3/orders/${order_id}` +
      `?consumer_key=${consumer_key}&consumer_secret=${consumer_secret}`
    );
    if (!wcRes.ok) throw new Error();
  } catch (err) {
    return res.status(500).json({ error: 'Pedido WooCommerce no encontrado' });
  }

  // 3) paginar transacciones
  let allTxs = [];
  const perPage = 100;
  let page = 1, totalPages = 1;
  const now  = new Date().toISOString();
  const past = new Date(Date.now() - 90*24*60*60*1000).toISOString();

  try {
    do {
      const rptRes = await fetch(
        `${baseUrl}/v1/reporting/transactions`
        + `?start_date=${encodeURIComponent(past)}`
        + `&end_date=${encodeURIComponent(now)}`
        + `&page_size=${perPage}&page=${page}`
        + `&transaction_status=S&fields=all`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const rptJson = await rptRes.json();
      if (!rptRes.ok) throw new Error();

      totalPages = rptJson.pagination_info?.total_pages || 1;
      allTxs = allTxs.concat(rptJson.transaction_details || []);
      page++;
    } while (page <= totalPages);
  } catch (err) {
    return res.status(500).json({ error: 'Error listando transacciones PayPal' });
  }

  // 4) filtrar+ordenar+mapear
  const output = allTxs
    .filter(t => t.payer_info?.email_address?.toLowerCase() === email)
    .sort((a,b) =>
      new Date(b.transaction_info.transaction_initiation_date)
      - new Date(a.transaction_info.transaction_initiation_date)
    )
    .map(t => ({
      id:    t.transaction_info.transaction_id,
      status: t.transaction_info.transaction_status,
      amount: {
        value: parseFloat(t.transaction_info.transaction_amount.value).toFixed(2),
        currency_code: t.transaction_info.transaction_amount.currency_code
      },
      payer_email: t.payer_info?.email_address || null,
      date: t.transaction_info.transaction_initiation_date
    }));

  cache.set(cacheKey, { timestamp: Date.now(), data: output });
  res.json(output);
});

module.exports = router;
