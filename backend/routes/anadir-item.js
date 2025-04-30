const express = require('express');
const router  = express.Router();
const {
  addLineItemToOrder,
  fetchOrderById
} = require('../utils/editar-woocommerce');

// POST /api/anadir-item?order_id=XXX
// Body JSON: {
//   product_id,
//   variation_id?,
//   quantity,
//   woocommerce_url,
//   consumer_key,
//   consumer_secret
// }
router.post('/anadir-item', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros dinámicos de req.body y req.query
  const { order_id } = req.query;
  const {
    product_id,
    variation_id,
    quantity,
    woocommerce_url,
    consumer_key,
    consumer_secret
  } = req.body;

  // 3) Validar que tengamos todo lo necesario
  if (
    !order_id ||
    !product_id ||
    quantity == null ||
    !woocommerce_url ||
    !consumer_key ||
    !consumer_secret
  ) {
    return res.status(400).json({
      error: 'Faltan parámetros. Asegúrate de incluir order_id en query y product_id, quantity, woocommerce_url, consumer_key, consumer_secret en body.'
    });
  }

  try {
    // 4) Construir línea de pedido
    const lineItem = {
      product_id: Number(product_id),
      quantity: Number(quantity)
    };
    if (variation_id) {
      lineItem.variation_id = Number(variation_id);
    }

    // 5) Llamar a la utilidad para añadir la línea
    await addLineItemToOrder(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id,
      [ lineItem ]
    );

    // 6) Recuperar el pedido actualizado
    const updatedOrder = await fetchOrderById(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id
    );

    // 7) Devolver al cliente
    res.json(updatedOrder);

  } catch (err) {
    console.error('Error al añadir item al pedido:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudo añadir el artículo al pedido.' });
  }
});

module.exports = router;
