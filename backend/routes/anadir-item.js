const express = require('express');
const router  = express.Router();
const { api } = require('../utils/woocommerce');

// POST /api/anadir-item?order_id=XXX
// Body JSON: { product_id, variation_id?, quantity }
router.post('/anadir-item', async (req, res) => {
  const { order_id } = req.query;
  const { product_id, variation_id, quantity } = req.body;

  if (!order_id || !product_id || quantity == null) {
    return res.status(400).json({ error: 'Faltan order_id en query o product_id/quantity en body.' });
  }

  try {
    // 1) Añadir nueva línea al pedido
    const line = { product_id: Number(product_id), quantity: Number(quantity) };
    if (variation_id) line.variation_id = Number(variation_id);

    await api.put(`orders/${order_id}`, {
      line_items: [ line ]
    });

    // 2) Devolver pedido actualizado
    const { data: updated } = await api.get(`orders/${order_id}`);
    res.json(updated);

  } catch (err) {
    console.error('Error al añadir item:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudo añadir el artículo.' });
  }
});

module.exports = router;
