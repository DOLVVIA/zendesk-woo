const express = require('express');
const router = express.Router();
const {
  fetchOrderById,
  updateOrder
} = require('../utils/editar-woocommerce');

// PUT /api/editar-item?order_id=123&line_index=0
// Body JSON: {
//   variation_id?,
//   quantity,
//   total?,
//   woocommerce_url,
//   consumer_key,
//   consumer_secret
// }
router.put('/editar-item', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Obtener parámetros de query y body
  const { order_id, line_index } = req.query;
  const {
    variation_id,
    quantity,
    total,
    woocommerce_url,
    consumer_key,
    consumer_secret
  } = req.body;

  // 3) Validaciones básicas
  if (!order_id || line_index === undefined) {
    return res.status(400).json({
      error: 'Faltan order_id o line_index en query.'
    });
  }
  if (quantity === undefined) {
    return res.status(400).json({
      error: 'Falta quantity en body.'
    });
  }
  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error: 'Faltan parámetros de conexión. Incluye woocommerce_url, consumer_key y consumer_secret en body.'
    });
  }

  try {
    // 4) Traer pedido y guardar estado original
    const order = await fetchOrderById(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id
    );
    const originalStatus = order.status;

    // 5) Identificar la línea antigua
    const oldLine = order.line_items[line_index];
    if (!oldLine) {
      return res.status(400).json({ error: 'Índice de línea inválido.' });
    }

    // 6) Calcular precio unitario si se pasa total
    let priceUnit;
    if (total != null) {
      priceUnit = (parseFloat(total) / quantity).toFixed(2);
    }

    // 7) Construir la nueva línea
    const newLine = {
      product_id: oldLine.product_id,
      quantity: Number(quantity),
      ...(variation_id != null ? { variation_id: Number(variation_id) } : {}),
      ...(total != null ? {
        price:        priceUnit,
        subtotal:     total,
        total:        total,
        subtotal_tax: oldLine.subtotal_tax,
        total_tax:    oldLine.total_tax
      } : {})
    };

    // 8) Preparar array de actualizaciones
    const lineUpdates = [
      { id: oldLine.id, quantity: 0 }, // elimina la línea vieja
      newLine                          // añade la nueva
    ];

    // 9) Primera actualización: status 'pending' para forzar recálculo
    await updateOrder(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id,
      {
        status: 'pending',
        line_items: lineUpdates
      }
    );

    // 10) Segunda actualización: restaurar estado original y aplicar líneas
    const updated = await updateOrder(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id,
      {
        status: originalStatus,
        line_items: lineUpdates
      }
    );

    // 11) Devolver pedido actualizado
    res.json(updated);

  } catch (err) {
    console.error('Error al editar item del pedido:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudo actualizar el artículo del pedido.' });
  }
});

module.exports = router;
