const express = require('express');
const checkout = require('@paypal/checkout-server-sdk');
const router = express.Router();

// POST /api/refund-paypal
// Body JSON:
// {
//   captureId,
//   amount,
//   currency_code,
//   paypal_client_id,
//   paypal_secret,
//   paypal_env        // 'sandbox' o 'live'
// }
router.post('/refund-paypal', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros
  const {
    captureId,
    amount,
    currency_code,
    paypal_client_id,
    paypal_secret,
    paypal_env
  } = req.body;

  // 3) Validaciones básicas
  if (!captureId || amount == null || !currency_code) {
    return res.status(400).json({ error: 'Faltan parámetros: captureId, amount o currency_code.' });
  }
  if (!paypal_client_id || !paypal_secret || !paypal_env) {
    return res.status(400).json({
      error: 'Faltan parámetros de configuración de PayPal: paypal_client_id, paypal_secret o paypal_env.'
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

    // 5) Construir y ejecutar la solicitud de reembolso
    const request = new payments.CapturesRefundRequest(captureId);
    request.requestBody({
      amount: {
        value: amount.toString(),
        currency_code
      }
    });
    const response = await client.execute(request);

    // 6) Devolver resultado
    res.json({ success: true, refund: response.result });
  } catch (err) {
    console.error('Error al procesar refund PayPal:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
