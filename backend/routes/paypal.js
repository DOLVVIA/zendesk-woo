const express = require('express');
const checkout = require('@paypal/checkout-server-sdk');
const router = express.Router();

// GET /api/get-paypal-transaction?captureId=XXX&paypal_client_id=...&paypal_secret=...&paypal_env=...
router.get('/get-paypal-transaction', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros dinámicos de req.query
  const {
    captureId,
    paypal_client_id,
    paypal_secret,
    paypal_env
  } = req.query;

  // 3) Validaciones básicas
  if (!captureId) {
    return res.status(400).json({ error: 'Falta el parámetro captureId en query.' });
  }
  if (!paypal_client_id || !paypal_secret || !paypal_env) {
    return res.status(400).json({
      error: 'Faltan parámetros de configuración de PayPal. Incluye paypal_client_id, paypal_secret y paypal_env en query.'
    });
  }

  try {
    // 4) Inicializar PayPal SDK dinámicamente según entorno
    const { core: paypalCore, payments } = checkout;
    let environment;
    if (paypal_env === 'live') {
      environment = new paypalCore.LiveEnvironment(paypal_client_id, paypal_secret);
    } else {
      environment = new paypalCore.SandboxEnvironment(paypal_client_id, paypal_secret);
    }
    const client = new paypalCore.PayPalHttpClient(environment);

    // 5) Ejecutar request para obtener la captura
    const request  = new payments.CapturesGetRequest(captureId);
    const response = await client.execute(request);

    // 6) Devolver resultado (array para mantener compatibilidad)
    res.json([ response.result ]);
  } catch (err) {
    console.error('Error al obtener captura PayPal:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
