const express = require('express');
const router = express.Router();
const {
  changeOrderStatus,
  fetchOrderById
} = require('../utils/editar-woocommerce');

// PUT /api/cambiar-estado?order_id=123
// Body JSON: {
//   status,
//   woocommerce_url,
//   consumer_key,
//   consumer_secret
// }
router.put('/cambiar-estado', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros dinámicos
  const { order_id } = req.query;
  const {
    status,
    woocommerce_url,
    consumer_key,
    consumer_secret
  } = req.body;

  // 3) Validar que tengamos todo lo necesario
  if (!order_id) {
    return res.status(400).json({ error: 'Falta order_id en query.' });
  }
  if (!status) {
    return res.status(400).json({ error: 'Falta status en body.' });
  }
  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error:
        'Faltan parámetros de conexión. Incluye woocommerce_url, consumer_key y consumer_secret en body.'
    });
  }

  try {
    // 4) Cambiar estado usando la utilidad
    await changeOrderStatus(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id,
      status
    );

    // 5) (Opcional) Recuperar pedido actualizado para devolverlo
    const updatedOrder = await fetchOrderById(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id
    );

    // 6) Devolver pedido actualizado
    res.json(updatedOrder);

  } catch (err) {
    console.error('Error al cambiar estado del pedido:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudo cambiar el estado del pedido.' });
  }
});

module.exports = router;
