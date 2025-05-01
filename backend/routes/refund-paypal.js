const express = require('express');
const router = express.Router();
const paypal = require('@paypal/checkout-server-sdk');
const { authorizeZendesk } = require('../middleware/auth');

function createPayPalClient() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_SECRET;
  const environment = new paypal.core.SandboxEnvironment(clientId, clientSecret);
  return new paypal.core.PayPalHttpClient(environment);
}

router.post('/', authorizeZendesk, async (req, res) => {
  const { transactionId, amount, currency } = req.body;
  if (!transactionId || !amount) {
    return res.status(400).json({ error: 'Falta transactionId o amount' });
  }

  try {
    const client = createPayPalClient();
    const captureId = transactionId; // en PayPal se reembolsa sobre un captureId
    const request = new paypal.payments.CapturesRefundRequest(captureId);
    request.requestBody({
      amount: {
        value: amount,
        currency_code: currency || 'EUR'
      }
    });

    const response = await client.execute(request);
    // Devuelve datos del reembolso
    res.json(response.result);
  } catch (err) {
    console.error('Error reembolsando en PayPal:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
