// backend/routes/get-paypal-transactions.js

const express  = require('express');
const checkout = require('@paypal/checkout-server-sdk');
const router   = express.Router();

// Inicializa el cliente PayPal en modo LIVE
const environment = new checkout.core.LiveEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_SECRET
);
const client = new checkout.core.PayPalHttpClient(environment);

/**
 * GET /api/get-paypal-transactions?paypalCaptureId=<ID> o captureId=<ID>
 * Devuelve la captura PayPal como array para mantener compatibilidad.
 */
router.get('/', async (req, res) => {
  // Seguridad: validar clave Zendesk
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // Acepta captureId o paypalCaptureId
  const captureId = req.query.captureId || req.query.paypalCaptureId;
  if (!captureId) {
    return res.status(400).json({ error: 'Falta parámetro captureId o paypalCaptureId.' });
  }

  try {
    const request = new checkout.payments.CapturesGetRequest(captureId);
    const response = await client.execute(request);

    // Devuelve como array (igual que la versión funcional anterior)
    return res.json([ response.result ]);
  } catch (err) {
    console.error('❌ Error al obtener captura PayPal:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
