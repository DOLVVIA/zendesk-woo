// backend/routes/cambiar-estado.js

const express = require('express');
const router  = express.Router();
const { api } = require('../utils/woocommerce');

// PUT /api/cambiar-estado?order_id=123
// Body JSON: { status }
router.put('/cambiar-estado', async (req, res) => {
  const { order_id } = req.query;
  const { status }   = req.body;

  if (!order_id) {
    return res.status(400).json({ error: 'Falta order_id en query.' });
  }
  if (!status) {
    return res.status(400).json({ error: 'Falta status en body.' });
  }

  try {
    // Envía el PUT a WooCommerce para cambiar el estado
    const { data: updated } = await api.put(`orders/${order_id}`, { status });
    return res.json(updated);
  } catch (err) {
    console.error('Error al cambiar estado:', err.response?.data || err.message);
    return res.status(500).json({ error: 'No se pudo cambiar el estado.' });
  }
});

module.exports = router;
