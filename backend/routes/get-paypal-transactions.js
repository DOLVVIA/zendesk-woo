// routes/paypal-transactions.js
const express = require('express');
const fetch   = require('node-fetch'); // npm install node-fetch@2
const router  = express.Router();

const cache = new Map();

router.get('/', async (req, res) => {
  console.log('💬 GET /get-paypal-transactions', req.query);

  // --- Seguridad ---
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // --- Parámetros ---
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

  if (
    !clientId || !clientSecret ||
    !email    || !order_id    ||
    !woocommerce_url || !consumer_key || !consumer_secret
  ) {
    return res.status(400).json({ error: 'Faltan parámetros obligatorios' });
  }

  // --- Cache 5 min ---
  const cacheKey = `${order_id}|${email}|${mode}`;
  const cached   = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    console.log('🚀 Respondiendo desde cache');
    return res.json(cached.data);
  }

  // --- URLs base PayPal ---
  const baseUrl = mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  // 1) Obtener Access Token
  let accessToken;
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type':  'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenJson.error_description || tokenJson.error);
    accessToken = tokenJson.access_token;
  } catch (err) {
    console.error('❌ Error autenticando en PayPal:', err);
    return res.status(500).json({ error: 'Error autenticando en PayPal' });
  }

  // 2) Verificar pedido WooCommerce
  try {
    const wcRes = await fetch(
      `${woocommerce_url}/wp-json/wc/v3/orders/${order_id}` +
      `?consumer_key=${consumer_key}&consumer_secret=${consumer_secret}`
    );
    if (!wcRes.ok) throw new Error(`WooCommerce ${wcRes.status}`);
  } catch (err) {
    console.error('❌ Pedido Woo no encontrado:', err);
    return res.status(500).json({ error: 'Pedido WooCommerce no encontrado' });
  }

  // 3) Traer transacciones por bloques de 31 días (90 días atrás)
  const perPage = 100;
  const nowMs   = Date.now();
  const startMs = nowMs - 90 * 24 * 60 * 60 * 1000;
  let allTxs    = [];

  const toPayPalDate = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

  for (
    let chunkStart = startMs;
    chunkStart < nowMs;
    chunkStart += 31 * 24 * 60 * 60 * 1000
  ) {
    const chunkEnd = Math.min(chunkStart + 31 * 24 * 60 * 60 * 1000, nowMs);
    const startDate = toPayPalDate(chunkStart);
    const endDate   = toPayPalDate(chunkEnd);

    let page       = 1;
    let totalPages = 1;

    try {
      do {
        const url = `${baseUrl}/v1/reporting/transactions`
          + `?start_date=${encodeURIComponent(startDate)}`
          + `&end_date=${encodeURIComponent(endDate)}`
          + `&page_size=${perPage}`
          + `&page=${page}`
          + `&transaction_status=S`
          + `&fields=all`;

        const txRes  = await fetch(url, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const txJson = await txRes.json();
        if (!txRes.ok) {
          console.error('❌ PayPal responde error:', txJson);
          throw new Error(`PayPal API ${txRes.status}`);
        }

        totalPages = txJson.pagination_info?.total_pages || 1;
        allTxs     = allTxs.concat(txJson.transaction_details || []);
        page++;
      } while (page <= totalPages);
    } catch (err) {
      console.error('❌ Error paginando transacciones:', err);
      return res.status(500).json({ error: 'Error listando transacciones PayPal' });
    }
  }

  // 4) Filtrar por email, ordenar y formatear
  const output = allTxs
    .filter(t =>
      t.payer_info?.email_address?.toLowerCase() === email
    )
    .sort((a, b) =>
      new Date(b.transaction_info.transaction_initiation_date)
      - new Date(a.transaction_info.transaction_initiation_date)
    )
    .map(t => ({
      id:               t.transaction_info.transaction_id,
      status:           t.transaction_info.transaction_status,
      amount: {
        value:         parseFloat(t.transaction_info.transaction_amount.value).toFixed(2),
        currency_code: t.transaction_info.transaction_amount.currency_code
      },
      refunded_amount:  t.transaction_info.transaction_amount.value_refunded || '0.00',
      is_refunded:       t.transaction_info.transaction_status === 'REFUNDED',
      payer_email:      t.payer_info?.email_address || null,
      date:             t.transaction_info.transaction_initiation_date
    }));

  // 5) Cache y enviar
  cache.set(cacheKey, { timestamp: Date.now(), data: output });
  console.log(`✅ /get-paypal-transactions → ${output.length} txs`);
  res.json(output);
});

module.exports = router;
