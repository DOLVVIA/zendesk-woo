// backend/routes/cambiar-estado.js

const express = require('express');
const router = express.Router();
const { updateOrder, fetchOrderById } = require('../utils/woocommerce');

// PUT /api/cambiar-estado?order_id=123&status=...&woocommerce_url=...&consumer_key=...&consumer_secret=...
router.put('/', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros de conexión y datos
  const {
    order_id,
    status,
    woocommerce_url,
    consumer_key,
    consumer_secret
  } = req.query;

  // 3) Validaciones
  if (!order_id) {
    return res.status(400).json({ error: 'Falta order_id en query.' });
  }
  if (!status) {
    return res.status(400).json({ error: 'Falta status en query.' });
  }
  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error:
        'Faltan parámetros de conexión. Incluye woocommerce_url, consumer_key y consumer_secret en query.'
    });
  }

  try {
    // 4) Cambiar el estado del pedido
    await updateOrder(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id,
      { status }
    );

    // 5) Recuperar el pedido actualizado
    const updatedOrder = await fetchOrderById(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id
    );

    // 6) Devolver al cliente
    res.json(updatedOrder);
  } catch (err) {
    console.error('Error al cambiar estado del pedido:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudo cambiar el estado del pedido.' });
  }
});

module.exports = router;
