// backend/routes/refund-paypal.js

const express = require('express');
const paypal  = require('@paypal/checkout-server-sdk');
const router  = express.Router();

function createPayPalClient() {
  const clientId     = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_SECRET;
  const environment  = new paypal.core.SandboxEnvironment(clientId, clientSecret);
  return new paypal.core.PayPalHttpClient(environment);
}

router.post('/', async (req, res) => {
  // 1) VALIDAR x-zendesk-secret
  const zendeskSecret = req.get('x-zendesk-secret');
  if (!zendeskSecret || zendeskSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Parámetros obligatorios
  const { transactionId, amount, currency } = req.body;
  if (!transactionId || !amount) {
    return res.status(400).json({ error: 'Falta transactionId o amount' });
  }

  try {
    const client  = createPayPalClient();
    const request = new paypal.payments.CapturesRefundRequest(transactionId);
    request.requestBody({
      amount: {
        value:         amount,
        currency_code: currency || 'EUR'
      }
    });

    const response = await client.execute(request);
    return res.json(response.result);
  } catch (err) {
    console.error('Error reembolsando en PayPal:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
