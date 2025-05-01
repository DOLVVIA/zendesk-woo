// backend/routes/get-paypal-transactions.js

const express = require('express');
const paypal  = require('@paypal/checkout-server-sdk');
const router  = express.Router();

// Inicializa cliente PayPal (Sandbox/LIVE según tus env)
function createPayPalClient() {
  const clientId     = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_SECRET;
  const environment  = new paypal.core.SandboxEnvironment(clientId, clientSecret);
  return new paypal.core.PayPalHttpClient(environment);
}

router.get('/', async (req, res) => {
  // 1) VALIDAR x-zendesk-secret
  const zendeskSecret = req.get('x-zendesk-secret');
  if (!zendeskSecret || zendeskSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Parámetro email
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'Falta el parámetro email' });
  }

  try {
    const client    = createPayPalClient();
    const now       = new Date();
    const startDate = new Date(now.getTime() - 30*24*60*60*1000).toISOString();
    const endDate   = now.toISOString();

    // 3) Construir request usando transaction_payer_email
    const request = new paypal.reporting.TransactionsSearchRequest();
    request.queryParams({
      start_date:              startDate,
      end_date:                endDate,
      transaction_payer_email: email,
      page_size:               20,
      fields:                  'all'
    });

    const response = await client.execute(request);
    return res.json(response.result.transaction_details);
  } catch (err) {
    console.error('Error buscando transacciones PayPal:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
