// backend/routes/paypal.js
const express  = require('express');
const checkout = require('@paypal/checkout-server-sdk');
const router   = express.Router();

// 1️⃣ Inicializa el cliente PayPal aquí mismo
const env    = new checkout.core.LiveEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_SECRET
);
const client = new checkout.core.PayPalHttpClient(env);

// 2️⃣ Define la ruta GET /api/get-paypal-transaction
router.get('/get-paypal-transaction', async (req, res) => {
  const { captureId } = req.query;
  if (!captureId) {
    return res.status(400).json({ error: 'Falta parámetro captureId.' });
  }
  try {
    // Usa CapturesGetRequest para obtener una única captura
    const request  = new checkout.payments.CapturesGetRequest(captureId);
    const response = await client.execute(request);
    return res.json([ response.result ]);
  } catch (err) {
    console.error('Error al obtener captura PayPal:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
