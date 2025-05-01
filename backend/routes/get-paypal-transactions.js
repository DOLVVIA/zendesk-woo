// backend/routes/get-paypal-transactions.js

const express  = require('express');
const checkout = require('@paypal/checkout-server-sdk');
const router   = express.Router();

// 1️⃣ Inicializa siempre en Live (forzar "live" mode)
const environment = new checkout.core.LiveEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_SECRET
);
const client = new checkout.core.PayPalHttpClient(environment);

/**
 * GET /api/get-paypal-transactions?paypalCaptureId=<CAPTURE_ID>
 * Devuelve un array con la captura obtenida directamente a partir del Capture ID.
 */
router.get('/', async (req, res) => {
  // 0) Validar cabecera Zendesk
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 1) Parámetro obligatorio: Capture ID
  const { paypalCaptureId } = req.query;
  if (!paypalCaptureId) {
    return res.status(400).json({ error: 'Falta parámetro paypalCaptureId.' });
  }

  try {
    // 2) Obtener captura desde PayPal
    const captureRequest  = new checkout.payments.CapturesGetRequest(paypalCaptureId);
    const captureResponse = await client.execute(captureRequest);

    // 3) Devolver la captura dentro de un array
    return res.json([ captureResponse.result ]);
  } catch (err) {
    console.error('Error al obtener captura PayPal:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
