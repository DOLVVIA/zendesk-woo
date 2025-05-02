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
 *    paypalCaptureId=<ID> 
 *  o paypalOrderId=<ID>
 * Devuelve la captura PayPal como array para mantener compatibilidad.
 */
router.get('/', async (req, res) => {
  // 1) Seguridad: validar clave Zendesk
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leemos parámetros posibles
  let captureId      = req.query.captureId      || req.query.paypalCaptureId;
  const paypalOrderId = req.query.paypalOrderId;

  // 3) Si no recibimos captureId pero sí orderId, buscamos la captura en la orden
  if (!captureId && paypalOrderId) {
    try {
      // 3.1) Traemos la orden de PayPal
      const orderRequest  = new checkout.orders.OrdersGetRequest(paypalOrderId);
      const orderResponse = await client.execute(orderRequest);

      // 3.2) Extraemos todos los payments.captures de cada purchase_unit
      const captures = (orderResponse.result.purchase_units || [])
        .flatMap(unit => unit.payments?.captures || []);

      // 3.3) Tomamos el primer capture.id disponible
      captureId = captures[0]?.id;
      if (!captureId) {
        return res
          .status(404)
          .json({ error: 'No se encontró ningún captureId en la orden PayPal.' });
      }
    } catch (err) {
      console.error('❌ Error fetching PayPal order:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // 4) Si aún no tenemos captureId → bad request
  if (!captureId) {
    return res
      .status(400)
      .json({ error: 'Falta parámetro captureId o paypalOrderId válido.' });
  }

  // 5) Ya tenemos captureId → traemos la captura
  try {
    const captureRequest  = new checkout.payments.CapturesGetRequest(captureId);
    const captureResponse = await client.execute(captureRequest);
    // Devolvemos siempre un array, para no romper compatibilidad
    return res.json([ captureResponse.result ]);
  } catch (err) {
    console.error('❌ Error al obtener captura PayPal:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
