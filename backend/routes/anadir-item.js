// backend/routes/anadir-item.js

const express = require('express');
const router = express.Router();
const { addLineItemToOrder, fetchOrderById } = require('../utils/woocommerce');

// POST /api/anadir-item?order_id=XXX
// Body JSON: {
//   product_id: number,
//   variation_id?: number,
//   quantity: number,
//   woocommerce_url: string,
//   consumer_key: string,
//   consumer_secret: string
// }
router.post('/', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros de conexión y datos de la petición
  const { order_id } = req.query;
  const {
    product_id,
    variation_id,
    quantity,
    woocommerce_url,
    consumer_key,
    consumer_secret
  } = req.body;

  // 3) Validaciones
  if (!order_id) {
    return res.status(400).json({ error: 'Falta order_id en query.' });
  }
  if (!product_id || quantity == null) {
    return res.status(400).json({
      error: 'Faltan parámetros en body. Debes enviar product_id y quantity.'
    });
  }
  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error: 'Faltan parámetros de conexión. Incluye woocommerce_url, consumer_key y consumer_secret en body.'
    });
  }

  try {
    // 4) Construir la línea de item
    const lineItem = {
      product_id: Number(product_id),
      quantity: Number(quantity)
    };
    if (variation_id != null) {
      lineItem.variation_id = Number(variation_id);
    }

    // 5) Añadir línea al pedido
    await addLineItemToOrder(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id,
      [lineItem]
    );

    // 6) Recuperar pedido actualizado
    const updatedOrder = await fetchOrderById(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id
    );

    // 7) Devolver resultado
    res.json(updatedOrder);
  } catch (err) {
    console.error('Error al añadir item al pedido:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudo añadir el artículo al pedido.' });
  }
});

module.exports = router;
