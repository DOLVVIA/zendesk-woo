// backend/routes/get-paypal-transactions.js

const express = require('express');
const fetch   = require('node-fetch'); // npm install node-fetch@2
const router  = express.Router();

router.get('/', async (req, res) => {
  // 1) Seguridad: validar x-zendesk-secret
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros
  const clientId     = req.query.paypal_client_id;
  const clientSecret = req.query.paypal_secret;
  const email        = (req.query.email || '').toLowerCase();
  const mode         = req.query.paypal_mode === 'live' ? 'live' : 'sandbox';

  if (!clientId || !clientSecret || !email) {
    return res.status(400).json({
      error: 'Faltan paypal_client_id, paypal_secret o email en la query.'
    });
  }

  // 3) URL base según modo
  const baseUrl = mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  console.log(`→ PayPal mode: ${mode}, baseUrl: ${baseUrl}`);

  // 4) Obtener access_token
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

    const tokenText = await tokenRes.text();
    console.log(`→ /v1/oauth2/token status: ${tokenRes.status}, body: ${tokenText}`);

    if (!tokenRes.ok) {
      const err = JSON.parse(tokenText);
      return res.status(500).json({ error: err.error_description || err.error });
    }

    const tokenJson = JSON.parse(tokenText);
    accessToken = tokenJson.access_token;
  } catch (e) {
    console.error('❌ Error autenticando con PayPal:', e);
    return res.status(500).json({ error: 'Error autenticando en PayPal.' });
  }

  // 5) Buscar transacciones de los últimos 90 días
  const since    = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const until    = new Date().toISOString();
  const pageSize = 50;
  let page       = 1;
  const allTx    = [];

  try {
    while (true) {
      const url = new URL(`${baseUrl}/v1/reporting/transactions`);
      url.searchParams.set('start_date', since);
      url.searchParams.set('end_date', until);
      url.searchParams.set('fields', 'all');
      url.searchParams.set('page_size', pageSize);
      url.searchParams.set('page', page);

      const rptRes = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      const rptJson = await rptRes.json();

      if (!rptRes.ok) {
        throw new Error(rptJson.error_description || JSON.stringify(rptJson));
      }

      const txs = rptJson.transaction_details || [];
      allTx.push(...txs);

      if (txs.length < pageSize) break;
      page++;
    }
  } catch (e) {
    console.error('❌ Error al listar transacciones:', e);
    return res.status(500).json({ error: 'Error consultando transacciones PayPal.' });
  }

  // 6) Filtrar por email y formatear
  const output = allTx
    .filter(tx => tx.payer_info?.email_address?.toLowerCase() === email)
    .map(tx => ({
      id:     tx.transaction_info.transaction_id,
      status: tx.transaction_info.transaction_status,
      amount: {
        value:         tx.transaction_info.transaction_amount.value,
        currency_code: tx.transaction_info.transaction_amount.currency_code
      },
      date:   tx.transaction_info.transaction_initiation_date
    }));

  // 7) Respuesta al frontend
  res.json(output);
});

module.exports = router;
