// backend/routes/anadir-item.js

const express = require('express');
const router = express.Router();
const { addLineItemToOrder, fetchOrderById } = require('../utils/woocommerce');

// POST /api/anadir-item?order_id=XXX
// Body JSON: {
//   product_id:    number,
//   variation_id?: number,
//   quantity:      number,
//   price?:        string,  // precio unitario sin IVA, ej "19.99"
//   subtotal?:     string,  // subtotal sin IVA, ej "39.98"
//   total?:        string,  // total sin IVA, ej "39.98"
//   subtotal_tax?: string,  // imp. total, ej "7.99"
//   total_tax?:    string,  // imp. total, ej "7.99"
//   woocommerce_url: string,
//   consumer_key:    string,
//   consumer_secret: string
// }
router.post('/', async (req, res) => {
  // 1) Seguridad
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros
  const { order_id } = req.query;
  const {
    product_id,
    variation_id,
    quantity,
    price,
    subtotal,
    total,
    subtotal_tax,
    total_tax,
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
      error: 'Faltan parámetros en body. Debes enviar al menos product_id y quantity.'
    });
  }
  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error: 'Faltan credenciales. Incluye woocommerce_url, consumer_key y consumer_secret en body.'
    });
  }

  try {
    // 4) Construir el line_item incluyendo precios e impuestos si vienen
    const lineItem = {
      product_id: Number(product_id),
      quantity:   Number(quantity)
    };
    if (variation_id != null) {
      lineItem.variation_id = Number(variation_id);
    }
    if (price != null)        lineItem.price        = price;
    if (subtotal != null)     lineItem.subtotal     = subtotal;
    if (total != null)        lineItem.total        = total;
    if (subtotal_tax != null) lineItem.subtotal_tax = subtotal_tax;
    if (total_tax != null)    lineItem.total_tax    = total_tax;

    // Añadimos array taxes si nos pasaron tax totals
    if (subtotal_tax != null && total_tax != null) {
      lineItem.taxes = [
        {
          id:       0,
          total:    total_tax,
          subtotal: subtotal_tax
        }
      ];
    }

    // 5) Añadir línea al pedido
    await addLineItemToOrder(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id,
      [lineItem]
    );

    // 6) Recuperar pedido actualizado y devolverlo
    const updatedOrder = await fetchOrderById(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id
    );
    return res.json(updatedOrder);

  } catch (err) {
    console.error('Error al añadir item al pedido:', err.response?.data || err.message);
    return res.status(500).json({ error: 'No se pudo añadir el artículo al pedido.' });
  }
});

module.exports = router;
