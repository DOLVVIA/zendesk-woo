// backend/routes/paypal-transaction.js

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
 * GET /api/get-paypal-transaction?paypalOrderId=<ID>
 * Devuelve un array con la captura extraída del Order de PayPal.
 */
router.get('/', async (req, res) => {
  // 0) Validar cabecera Zendesk
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 1) Parámetro obligatorio
  const { paypalOrderId } = req.query;
  if (!paypalOrderId) {
    return res.status(400).json({ error: 'Falta parámetro paypalOrderId.' });
  }

  try {
    // 2) Obtener el Order de PayPal
    const orderRequest = new checkout.orders.OrdersGetRequest(paypalOrderId);
    const orderResp    = await client.execute(orderRequest);

    // 3) Extraer la primera captura de purchase_units
    const pu      = orderResp.result.purchase_units?.[0];
    const capture = pu?.payments?.captures?.[0];
    if (!capture) {
      return res.status(404).json({ error: 'No se encontró ninguna captura.' });
    }

    // 4) Devolver la captura dentro de un array
    return res.json([capture]);
  } catch (err) {
    console.error('Error al obtener PayPal transaction:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
