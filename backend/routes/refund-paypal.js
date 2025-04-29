// backend/routes/refund-paypal.js
const express  = require('express');
const checkout = require('@paypal/checkout-server-sdk');
const router   = express.Router();

// vs. tu init de client: importa o reutiliza la misma instancia
const env    = new checkout.core.LiveEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_SECRET
);
const client = new checkout.core.PayPalHttpClient(env);

// POST /api/refund-paypal
router.post('/refund-paypal', async (req, res) => {
  const { captureId, amount, currency_code } = req.body;
  if (!captureId || !amount || !currency_code) {
    return res.status(400).json({ error: 'Faltan parámetros.' });
  }
  try {
    const request = new checkout.payments.CapturesRefundRequest(captureId);
    request.requestBody({
      amount: { value: amount.toString(), currency_code }
    });
    const response = await client.execute(request);
    return res.json({ success: true, refund: response.result });
  } catch (err) {
    console.error('Error refund PayPal:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
