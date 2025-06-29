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
      return res.status(500).json({ error: tokenJson.error_description || tokenJson.error });
    }
    accessToken = tokenJson.access_token;
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
    if (!wcRes.ok) throw new Error('Error al traer pedido WooCommerce');
    order = await wcRes.json();
  } catch (e) {
    console.error('❌ Error WooCommerce:', e);
    return res.status(500).json({ error: 'Error obteniendo pedido de WooCommerce.' });
  }

  // ─── 3) Extraer IDs de captura PayPal (logs) ───────────────────────────
  console.log('📝 Pedido Woo obtenido:', JSON.stringify(order, null, 2));
  const captureIds = new Set();
  if (order.transaction_id) captureIds.add(order.transaction_id);
  (order.meta_data || []).forEach(m => {
    if (m.key === 'wfocu_ppcp_order_current' || m.key === '_paypal_capture_id') {
      captureIds.add(m.value);
    }
  });
  console.log('📝 Capture IDs encontrados:', Array.from(captureIds));
  if (!captureIds.size) {
    console.log('⚠️ No se encontraron capture IDs, respondiendo []');
    return res.json([]);
  }

  // ─── 4) Llamar a la API de Capturas de PayPal en paralelo ─────────────
  const detalles = await Promise.all(
    [...captureIds].map(async id => {
      try {
        const resp = await fetch(`${baseUrl}/v2/payments/captures/${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!resp.ok) throw new Error(`PayPal ${id}: ${resp.status}`);
        return resp.json();
      } catch (err) {
        console.error('❌ Error PayPal capture:', id, err);
        return null;
      }
    })
  );

  // ─── 5) Filtrar nulos y por email, formatear salida ───────────────────
  const output = detalles
    .filter(d => d && d.payer && d.payer.email_address?.toLowerCase() === email)
    .map(d => ({
      id:           d.id,
      status:       d.status,
      amount:       { value: parseFloat(d.amount.value).toFixed(2), currency_code: d.amount.currency_code },
      refunded_amount: d.payment_state === 'REFUNDED'
        ? (parseFloat(d.amount.value) - parseFloat(d.supplementary_data?.refund_info?.gross_refund_amount?.value || 0)).toFixed(2)
        : '0.00',
      is_refunded:  d.payment_state === 'REFUNDED',
      date:         d.create_time
    }));

  // ─── 6) Cache y respuesta ─────────────────────────────────────────────
  cache.set(cacheKey, { timestamp: Date.now(), data: output });
  res.json(output);
});

module.exports = router;
