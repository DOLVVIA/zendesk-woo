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
 * GET /api/get-paypal-transactions?
 *    captureId=<ID>
 *  o paypalCaptureId=<ID>
 *  o paypalOrderId=<ID>
 *
 * Devuelve la captura PayPal (dentro de un array para compatibilidad).
 */
router.get('/', async (req, res) => {
  // 1) Validación de seguridad
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leemos cualquiera de los tres parámetros
  const captureId =
    req.query.captureId
    || req.query.paypalCaptureId
    || req.query.paypalOrderId;

  if (!captureId) {
    return res
      .status(400)
      .json({ error: 'Falta parámetro captureId, paypalCaptureId o paypalOrderId.' });
  }

  // 3) Llamada a PayPal para obtener la captura
  try {
    const request  = new checkout.payments.CapturesGetRequest(captureId);
    const response = await client.execute(request);
    // 4) Devolvemos un array con el resultado
    return res.json([ response.result ]);
  } catch (err) {
    console.error(`❌ Error al obtener captura PayPal para ID "${captureId}":`, err);
    // Si la SDK de PayPal expone statusCode, lo usamos; si no, 500 genérico
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
});

module.exports = router;
