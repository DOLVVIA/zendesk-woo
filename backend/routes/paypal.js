// backend/routes/get-paypal-transaction.js

const express  = require('express');
const checkout = require('@paypal/checkout-server-sdk');
const router   = express.Router();

// GET /api/get-paypal-transaction?captureId=XXX&paypal_client_id=...&paypal_secret=...
router.get('/', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros de la query
  const { captureId, paypal_client_id, paypal_secret } = req.query;

  // 3) Validaciones básicas
  if (!captureId) {
    return res.status(400).json({ error: 'Falta el parámetro captureId en query.' });
  }
  if (!paypal_client_id || !paypal_secret) {
    return res.status(400).json({
      error: 'Faltan parámetros de configuración de PayPal. Incluye paypal_client_id y paypal_secret en query.'
    });
  }

  try {
    // 4) Inicializar siempre en LiveEnvironment
    const { core: paypalCore, payments } = checkout;
    const environment = new paypalCore.LiveEnvironment(
      paypal_client_id,
      paypal_secret
    );
    const client = new paypalCore.PayPalHttpClient(environment);

    // 5) Ejecutar request para obtener la captura
    const request  = new payments.CapturesGetRequest(captureId);
    const response = await client.execute(request);

    // 6) Devolver resultado en array para compatibilidad con el frontend
    res.json([ response.result ]);
  } catch (err) {
    console.error('Error al obtener captura PayPal:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
