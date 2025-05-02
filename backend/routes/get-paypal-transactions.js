// backend/routes/get-paypal-transactions.js

const express = require('express');
const paypal  = require('@paypal/checkout-server-sdk');
const router  = express.Router();

router.get('/', async (req, res) => {
  // 1) Seguridad
  const secret = req.get('x-zendesk-secret');
  if (!secret || secret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Lectura de parámetros
  const clientId     = req.query.paypal_client_id;
  const clientSecret = req.query.paypal_secret;
  const mode         = req.query.paypal_mode === 'sandbox' ? 'sandbox' : 'live';
  const email        = (req.query.email || '').toLowerCase();

  if (!clientId || !clientSecret || !email) {
    return res.status(400).json({
      error: 'Faltan paypal_client_id, paypal_secret o email en la query.'
    });
  }

  // 3) Inicializar SDK
  const env = mode === 'sandbox'
    ? new paypal.core.SandboxEnvironment(clientId, clientSecret)
    : new paypal.core.LiveEnvironment(   clientId, clientSecret);
  const client = new paypal.core.PayPalHttpClient(env);

  // 4) Paginación Reporting API (últimos 90 días)
  const since   = new Date(Date.now() - 90*24*60*60*1000).toISOString();
  const until   = new Date().toISOString();
  const pageSize = 50;
  let page = 1;
  const allTx = [];

  try {
    while (true) {
      const path = `/v1/reporting/transactions` +
        `?start_date=${encodeURIComponent(since)}` +
        `&end_date=${encodeURIComponent(until)}` +
        `&fields=all&page_size=${pageSize}&page=${page}`;

      const reqRpt = new paypal.http.HttpRequest(path);
      reqRpt.headers['Content-Type'] = 'application/json';

      // El SDK añade el token por ti
      const rptRes = await client.execute(reqRpt);
      const txs   = rptRes.result.transaction_details || [];
      allTx.push(...txs);

      if (txs.length < pageSize) break;
      page++;
    }
  } catch (err) {
    console.error('❌ Error Reporting API con SDK:', err);
    return res.status(500).json({ error: 'Error consultando transacciones PayPal.' });
  }

  // 5) Filtrar por email y mapear
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

  // 6) Enviar resultado
  res.json(output);
});

module.exports = router;
