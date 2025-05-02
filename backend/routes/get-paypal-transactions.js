// backend/routes/get-paypal-transactions.js

const express  = require('express');
const paypal   = require('@paypal/checkout-server-sdk');
const router   = express.Router();

router.get('/', async (req, res) => {
  // 1) Seguridad: validar header x-zendesk-secret
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer credenciales y modo desde la query
  const clientId     = req.query.paypal_client_id;
  const clientSecret = req.query.paypal_secret;
  const mode         = req.query.paypal_mode || 'live';

  if (!clientId || !clientSecret) {
    return res
      .status(400)
      .json({ error: 'Faltan paypal_client_id o paypal_secret en la query.' });
  }

  // 3) Inicializar PayPal SDK “al vuelo”
  const env = mode === 'sandbox'
    ? new paypal.core.SandboxEnvironment(clientId, clientSecret)
    : new paypal.core.LiveEnvironment(   clientId, clientSecret);
  const client = new paypal.core.PayPalHttpClient(env);

  // 4) Obtener captureId o paypalOrderId
  let captureId      = req.query.captureId      || req.query.paypalCaptureId;
  const paypalOrderId = req.query.paypalOrderId;

  // 5) Si solo tenemos Order ID, traemos la orden y extraemos captureId
  if (!captureId && paypalOrderId) {
    try {
      const orderReq = new paypal.orders.OrdersGetRequest(paypalOrderId);
      const orderRes = await client.execute(orderReq);
      const caps = (orderRes.result.purchase_units || [])
        .flatMap(u => u.payments?.captures || []);
      captureId = caps[0]?.id;
      if (!captureId) {
        return res
          .status(404)
          .json({ error: 'No se encontró ningún captureId en la orden PayPal.' });
      }
    } catch (e) {
      console.error('❌ Error fetching PayPal order:', e);
      const status = e.statusCode || 500;
      return res.status(status).json({ error: e.message });
    }
  }

  // 6) Si aún no hay captureId → bad request
  if (!captureId) {
    return res
      .status(400)
      .json({ error: 'Falta captureId o paypalOrderId válido en la query.' });
  }

  // 7) Llamada final a CapturesGetRequest
  try {
    const capReq = new paypal.payments.CapturesGetRequest(captureId);
    const capRes = await client.execute(capReq);
    return res.json([ capRes.result ]);
  } catch (e) {
    console.error(`❌ Error al obtener captura ${captureId}:`, e);
    const status = e.statusCode || 500;
    return res.status(status).json({ error: e.message });
  }
});

module.exports = router;
