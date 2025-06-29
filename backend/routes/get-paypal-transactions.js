// routes/paypal-transactions.js
const express = require('express');
const fetch   = require('node-fetch'); // npm install node-fetch@2
const router  = express.Router();

const cache = new Map();

router.get('/', async (req, res) => {
  console.log('💬 GET /get-paypal-transactions', req.query);

  // ─── Seguridad ────────────────────────────────────────────────────────
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // ─── Parámetros ──────────────────────────────────────────────────────
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
    return res.status(400).json({
      error: 'Faltan paypal_client_id, paypal_secret, email, order_id, woocommerce_url, consumer_key o consumer_secret.'
    });
  }

  // ─── Cache ───────────────────────────────────────────────────────────
  const cacheKey = `${order_id}|${email}|${mode}`;
  const cached   = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    console.log('🚀 Devolviendo desde cache');
    return res.json(cached.data);
  }

  // ─── Base URL PayPal ─────────────────────────────────────────────────
  const baseUrl = mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  // ─── 1) Obtener OAuth2 token ─────────────────────────────────────────
  let accessToken;
  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method:  'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error('❌ PayPal token:', tokenJson);
      return res.status(500).json({ error: tokenJson.error_description || tokenJson.error });
    }
    accessToken = tokenJson.access_token;
  } catch (err) {
    console.error('❌ Error OAuth2 PayPal:', err);
    return res.status(500).json({ error: 'Error autenticando en PayPal.' });
  }

  // ─── 2) Validar pedido en WooCommerce ────────────────────────────────
  try {
    const wcRes = await fetch(
      `${woocommerce_url}/wp-json/wc/v3/orders/${order_id}` +
      `?consumer_key=${consumer_key}&consumer_secret=${consumer_secret}`
    );
    if (!wcRes.ok) throw new Error(`WooCommerce ${wcRes.status}`);
    // si devuelve 200 OK, seguimos
  } catch (err) {
    console.error('❌ Pedido WooCommerce no encontrado:', err);
    return res.status(500).json({ error: 'Pedido no encontrado en WooCommerce.' });
  }

  // ─── 3) Paginación de Reporting API (últimos 90 días) ────────────────
  const allTx = [];
  const nowIso    = new Date().toISOString();
  const past90Iso = new Date(Date.now() - 90*24*60*60*1000).toISOString();
  const pageSize  = 100;
  let page        = 1;
  let totalPages  = 1;

  try {
    do {
      const url = `${baseUrl}/v1/reporting/transactions`
        + `?start_date=${encodeURIComponent(past90Iso)}`
        + `&end_date=${encodeURIComponent(nowIso)}`
        + `&page_size=${pageSize}`
        + `&page=${page}`
        + `&transaction_status=S`
        + `&email_address=${encodeURIComponent(email)}`
        + `&fields=all`;

      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!r.ok) throw new Error(`PayPal reporting ${r.status}`);
      const j = await r.json();

      // recoge transacciones y lee total_pages
      const batch      = j.transaction_details || [];
      totalPages       = j.total_pages || 1;
      allTx.push(...batch);

      console.log(`📑 Página ${page}/${totalPages} → ${batch.length} txs`);
      page++;
    } while (page <= totalPages);
  } catch (err) {
    console.error('❌ Error en Reporting API:', err);
    return res.status(500).json({ error: 'Error obteniendo transacciones de PayPal.' });
  }

  // ─── 4) Formatear salida ──────────────────────────────────────────────
  const output = allTx.map(t => ({
    id:           t.transaction_info.transaction_id,
    status:       t.transaction_info.transaction_status,
    amount: {
      value:         parseFloat(t.transaction_info.transaction_amount.value).toFixed(2),
      currency_code: t.transaction_info.transaction_amount.currency_code
    },
    payer_email:  t.payer_info?.email_address || null,
    date:         t.transaction_info.transaction_initiation_date
  }));

  // ─── 5) Cache y respuesta ────────────────────────────────────────────
  cache.set(cacheKey, { timestamp: Date.now(), data: output });
  console.log(`✅ Total transacciones devueltas: ${output.length}`);
  res.json(output);
});

module.exports = router;
