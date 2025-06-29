// routes/paypal-transactions.js
const express = require('express');
const fetch   = require('node-fetch'); // npm install node-fetch@2
const router  = express.Router();

const cache = new Map(); // 🔁 Cache en memoria

router.get('/', async (req, res) => {
  console.log('💬 Query recibida en /get-paypal-transactions:', req.query);

  // ─── Seguridad ─────────────────────────────────────────────────────────
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // ─── Parámetros ────────────────────────────────────────────────────────
  const {
    paypal_client_id: clientId,
    paypal_secret:    clientSecret,
    paypal_mode:      rawMode,
    email:            rawEmail,
    order_id
  } = req.query;

  const email = (rawEmail || '').toLowerCase();
  const mode  = rawMode === 'live' ? 'live' : 'sandbox';

  if (!clientId || !clientSecret || !email || !order_id) {
    return res.status(400).json({
      error: 'Faltan paypal_client_id, paypal_secret, email o order_id en la query.'
    });
  }

  // ─── Cache key ─────────────────────────────────────────────────────────
  const cacheKey = `${order_id}-${email}-${mode}`;
  const cached   = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    console.log('🚀 Respuesta desde cache');
    return res.json(cached.data);
  }

  // ─── URLs base ─────────────────────────────────────────────────────────
  const baseUrl = mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  // ─── 1) Obtener token ──────────────────────────────────────────────────
  let accessToken;
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type':  'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error('❌ PayPal token error:', tokenJson);
      return res.status(500).json({ error: tokenJson.error_description || tokenJson.error });
    }
    accessToken = tokenJson.access_token;
    console.log('🔑 Token PayPal obtenido');
  } catch (e) {
    console.error('❌ Error autenticando con PayPal:', e);
    return res.status(500).json({ error: 'Error autenticando en PayPal.' });
  }

  // ─── 2) Traer el pedido de WooCommerce ─────────────────────────────────
  let order;
  try {
    const { woocommerce_url, consumer_key, consumer_secret } = req.query;
    const wcRes = await fetch(
      `${woocommerce_url}/wp-json/wc/v3/orders/${order_id}` +
      `?consumer_key=${consumer_key}&consumer_secret=${consumer_secret}`
    );
    if (!wcRes.ok) throw new Error(`WooCommerce ${wcRes.status}`);
    order = await wcRes.json();
    console.log('📝 Pedido Woo obtenido:', JSON.stringify(order, null, 2));
  } catch (e) {
    console.error('❌ Error WooCommerce:', e);
    return res.status(500).json({ error: 'Error obteniendo pedido de WooCommerce.' });
  }

  // ─── 3) Listar transacciones por email ───────────────────────────────
  let transactions;
  try {
    const now  = new Date().toISOString();
    const past = new Date(Date.now() - 30*24*60*60*1000).toISOString(); // últimos 30 días

    const searchUrl = `${baseUrl}/v1/reporting/transactions`
      + `?start_date=${encodeURIComponent(past)}`
      + `&end_date=${encodeURIComponent(now)}`
      + `&fields=all`
      + `&page_size=100`
      + `&transaction_status=S`    // sólo completadas
      + `&email_address=${encodeURIComponent(email)}`;

    const txRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!txRes.ok) throw new Error(`Search API ${txRes.status}`);
    const txJson = await txRes.json();
    transactions = txJson.transaction_details || [];
    console.log('📝 Transacciones encontradas:', transactions.length);
  } catch (e) {
    console.error('❌ Error listando por email:', e);
    return res.status(500).json({ error: 'Error listando transacciones PayPal.' });
  }

  // ─── 4) Formatear salida ──────────────────────────────────────────────
  const output = transactions.map(t => ({
    id:           t.transaction_info.transaction_id,
    status:       t.transaction_info.transaction_status,
    amount:       {
      value:         parseFloat(t.transaction_info.transaction_amount.value).toFixed(2),
      currency_code: t.transaction_info.transaction_amount.currency_code
    },
    payer_email:  t.payer_info?.email_address || null,
    date:         t.transaction_info.transaction_initiation_date
  }));

  // ─── 5) Cache y respuesta ─────────────────────────────────────────────
  cache.set(cacheKey, { timestamp: Date.now(), data: output });
  console.log('✅ Respuesta final:', output);
  res.json(output);
});

module.exports = router;
