// backend/routes/get-paypal-transactions.js

const express  = require('express');
const paypal   = require('@paypal/checkout-server-sdk');
const router   = express.Router();

// Inicializa el cliente PayPal en modo LIVE
const env    = new paypal.core.LiveEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_SECRET
);
const client = new paypal.core.PayPalHttpClient(env);

router.get('/', async (req, res) => {
  // 1) Seguridad
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Parsea cualquiera de los tres parámetros
  let captureId      = req.query.captureId      || req.query.paypalCaptureId;
  const paypalOrderId = req.query.paypalOrderId;

  // 3) Si sólo tenemos Order ID, recuperamos la orden y extraemos el Capture ID
  if (!captureId && paypalOrderId) {
    try {
      // 3.1) Traemos la orden
      const orderReq  = new paypal.orders.OrdersGetRequest(paypalOrderId);
      const orderRes  = await client.execute(orderReq);

      // 3.2) Buscamos el primer payments.captures[0].id
      const captures = (orderRes.result.purchase_units || [])
        .flatMap(u => u.payments?.captures || []);
      captureId = captures[0]?.id;

      if (!captureId) {
        return res
          .status(404)
          .json({ error: 'No se encontró ningún captureId en la orden PayPal.' });
      }
    } catch (err) {
      console.error('❌ Error fetching PayPal order:', err);
      // si falla la llamada a OrdersGetRequest, devolvemos el error que venga de PayPal
      const status = err.statusCode || 500;
      return res.status(status).json({ error: err.message });
    }
  }

  // 4) Si aún no tenemos captureId → bad request
  if (!captureId) {
    return res
      .status(400)
      .json({ error: 'Falta parámetro captureId, paypalCaptureId o paypalOrderId válido.' });
  }

  // 5) Finalmente: llamamos a la API de Captures
  try {
    const capReq  = new paypal.payments.CapturesGetRequest(captureId);
    const capRes  = await client.execute(capReq);
    // 6) Devolvemos siempre un array para mantener compatibilidad
    return res.json([ capRes.result ]);
  } catch (err) {
    console.error(`❌ Error al obtener captura ${captureId}:`, err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
});

module.exports = router;
