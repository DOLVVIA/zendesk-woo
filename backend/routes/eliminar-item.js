const express = require('express');
const router = express.Router();
const {
  fetchOrderById,
  updateOrder
} = require('../utils/editar-woocommerce');

// DELETE /api/eliminar-item?order_id=XXX&line_index=Y
// Body JSON: {
//   woocommerce_url,
//   consumer_key,
//   consumer_secret
// }
router.delete('/eliminar-item', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros de query y body
  const { order_id, line_index } = req.query;
  const {
    woocommerce_url,
    consumer_key,
    consumer_secret
  } = req.body;

  // 3) Validaciones básicas
  if (!order_id || line_index == null) {
    return res.status(400).json({
      error: 'Faltan order_id o line_index en query.'
    });
  }
  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error:
        'Faltan parámetros de conexión. Incluye woocommerce_url, consumer_key y consumer_secret en body.'
    });
  }

  try {
    // 4) Traer el pedido completo
    const order = await fetchOrderById(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id
    );

    // 5) Identificar el ítem a eliminar
    const oldLine = order.line_items[line_index];
    if (!oldLine) {
      return res.status(400).json({ error: 'Índice de línea inválido.' });
    }

    // 6) Eliminar la línea (quantity: 0)
    await updateOrder(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id,
      {
        line_items: [
          { id: oldLine.id, quantity: 0 }
        ]
      }
    );

    // 7) Recuperar el pedido actualizado
    const updatedOrder = await fetchOrderById(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id
    );

    // 8) Devolver al cliente
    res.json(updatedOrder);

  } catch (err) {
    console.error('Error al eliminar item del pedido:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudo eliminar el artículo del pedido.' });
  }
});

module.exports = router
