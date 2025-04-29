const express = require('express');
const router  = express.Router();
const { api } = require('../utils/woocommerce');

// DELETE /api/eliminar-item?order_id=XXX&line_index=Y
router.delete('/eliminar-item', async (req, res) => {
  const { order_id, line_index } = req.query;
  if (!order_id || line_index == null) {
    return res.status(400).json({ error: 'Faltan order_id o line_index en query.' });
  }

  try {
    // 1) Traer pedido
    const { data: order } = await api.get(`orders/${order_id}`);
    const lineItem = order.line_items[line_index];
    if (!lineItem) throw new Error('Índice de línea inválido.');
    const lineItemId = lineItem.id;

    // 2) Eliminar (poner qty=0)
    await api.put(`orders/${order_id}`, {
      line_items: [{ id: lineItemId, quantity: 0 }]
    });

    // 3) Devolver pedido actualizado
    const { data: updated } = await api.get(`orders/${order_id}`);
    res.json(updated);

  } catch (err) {
    console.error('Error al eliminar item:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudo eliminar el artículo.' });
  }
});

module.exports = router;
