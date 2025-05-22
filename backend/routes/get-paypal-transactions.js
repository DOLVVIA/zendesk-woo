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
    order_id,
    order_date
  } = req.query;

  const email = (rawEmail || '').toLowerCase();
  const mode  = rawMode === 'live' ? 'live' : 'sandbox';

  if (!clientId || !clientSecret || !email || !order_id || !order_date) {
    return res.status(400).json({
      error: 'Faltan paypal_client_id, paypal_secret, email, order_id o order_date en la query.'
    });
  }

  // ─── Cache key ─────────────────────────────────────────────────────────
  const cacheKey = `${order_id}-${email}-${mode}`;
  const cached   = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return res.json(cached.data);
  }

  // ─── URLs base PayPal ───────────────────────────────────────────────────
  const baseUrl = mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  // ─── 1) Obtener access token ─────────────────────────────────────────────
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

  // ─── 2) Llamada única al Reporting API con invoice_id ───────────────────
  let allTx = [];
  try {
    const url = new URL(`${baseUrl}/v1/reporting/transactions`);
    url.searchParams.set('invoice_id', order_id);
    url.searchParams.set('fields',      'all');
    url.searchParams.set('page_size',   50);

    console.log('🔍 PayPal Reporting URL:', url.toString());

    const rptRes  = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const rptJson = await rptRes.json();
    if (!rptRes.ok) {
      throw new Error(rptJson.error_description || JSON.stringify(rptJson));
    }

    allTx = rptJson.transaction_details || [];
    console.log('✅ transacciones recuperadas:', allTx.map(t => t.transaction_info.transaction_id));
  } catch (e) {
    console.error('❌ Error al listar transacciones:', e.message);
    return res.status(500).json({ error: 'Error consultando transacciones PayPal.' });
  }

  // ─── 3) Filtrar por email y separar pagos / reembolsos ──────────────────
  const pagos      = [];
  const reembolsos = [];

  allTx.forEach(tx => {
    const info  = tx.transaction_info;
    const payer = tx.payer_info?.email_address?.toLowerCase();
    if (!payer || payer !== email) return;

    const code  = info.transaction_event_code;
    const refId = info.paypal_reference_id;

    if (code?.startsWith('T11') && refId) {
      reembolsos.push({
        refId,
        amount: parseFloat(info.transaction_amount.value)
      });
    } else {
      pagos.push(tx);
    }
  });

  // ─── 4) Formatear salida igual que antes ───────────────────────────────
  const output = pagos.map(tx => {
    const info     = tx.transaction_info;
    const id       = info.transaction_id;
    const total    = parseFloat(info.transaction_amount.value);
    const currency = info.transaction_amount.currency_code;

    const refundMatches = reembolsos.filter(r => r.refId === id);
    const refunded      = refundMatches.reduce((sum, r) => sum + r.amount, 0);

    return {
      id,
      status:          info.transaction_status,
      amount:          { value: total.toFixed(2), currency_code: currency },
      refunded_amount: refunded.toFixed(2),
      is_refunded:     refunded > 0,
      date:            info.transaction_initiation_date
    };
  });

  // ─── 5) Guardar en cache y devolver ────────────────────────────────────
  cache.set(cacheKey, { timestamp: Date.now(), data: output });
  res.json(output);
});

module.exports = router;
