// backend/routes/editar-item.js

const express = require('express');
const router  = express.Router();
const { api } = require('../utils/woocommerce');

// PUT /api/editar-item?order_id=123&line_index=0
// Body JSON: { variation_id?, quantity, total? }
router.put('/editar-item', async (req, res) => {
  const { order_id, line_index } = req.query;
  const { variation_id, quantity, total } = req.body;

  // 1) Validaciones
  if (!order_id || line_index === undefined) {
    return res.status(400).json({ error: 'Faltan order_id o line_index en query.' });
  }
  if (quantity === undefined) {
    return res.status(400).json({ error: 'Falta quantity en body.' });
  }

  try {
    // 2) Traer el pedido completo y guardar estado original
    const { data: order } = await api.get(`orders/${order_id}`);
    const originalStatus = order.status;

    // 3) Identificar la línea antigua
    const oldLine = order.line_items[line_index];
    if (!oldLine) {
      return res.status(400).json({ error: 'Índice de línea inválido.' });
    }

    // 4) Calcular precio unitario si nos pasan total
    let priceUnit;
    if (total != null) {
      priceUnit = (parseFloat(total) / quantity).toFixed(2);
    }

    // 5) Construir la nueva línea, incluyendo taxes para que no se recalcule
    const newLine = {
      product_id: oldLine.product_id,
      quantity:   quantity,
      ...(variation_id != null ? { variation_id } : {}),
      ...(total != null ? {
        price:         priceUnit,
        subtotal:      total,
        total:         total,
        subtotal_tax:  oldLine.subtotal_tax,
        total_tax:     oldLine.total_tax
      } : {})
    };

    const lineUpdates = [
      { id: oldLine.id, quantity: 0 }, // eliminar la línea vieja
      newLine                           // añadir la nueva
    ];

    // 6) Primera actualización: poner en 'pending' y cambiar líneas
    await api.put(`orders/${order_id}`, {
      status:     'pending',
      line_items: lineUpdates
    });

    // 7) Segunda actualización: restaurar estado original y volver a enviar líneas
    const { data: updated } = await api.put(`orders/${order_id}`, {
      status:     originalStatus,
      line_items: lineUpdates
    });

    // 8) Devolver el pedido ya actualizado
    res.json(updated);

  } catch (error) {
    console.error('Error al editar item:', error.response?.data || error.message);
    res.status(500).json({ error: 'No se pudo actualizar el artículo.' });
  }
});

module.exports = router;
