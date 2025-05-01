// backend/routes/get-paypal-transactions.js

const express = require('express');
const paypal = require('@paypal/checkout-server-sdk');
const router = express.Router();

/** Crea un cliente PayPal dinamicamente (Sandbox o Live según tus .env) */
function createPayPalClient() {
  const clientId     = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_SECRET;
  const environment  = new paypal.core.SandboxEnvironment(clientId, clientSecret);
  return new paypal.core.PayPalHttpClient(environment);
}

router.get('/', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetro email
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'Falta el parámetro email' });
  }

  try {
    const client    = createPayPalClient();
    const now       = new Date();
    const startDate = new Date(now.getTime() - 30*24*60*60*1000).toISOString();
    const endDate   = now.toISOString();

    // 3) Construir y ejecutar la búsqueda
    const request = new paypal.reporting.TransactionsSearchRequest();
    request.queryParams({
      start_date: startDate,
      end_date:   endDate,
      payer_email: email,
      page_size:  20
    });

    const response = await client.execute(request);
    return res.json(response.result.transaction_details);
  } catch (err) {
    console.error('Error buscando transacciones PayPal:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
