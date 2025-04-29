// backend/routes/get-estados.js

const express = require('express');
const router  = express.Router();
const { api } = require('../utils/woocommerce');

// GET /api/get-estados
router.get('/get-estados', async (req, res) => {
  try {
    // WooCommerce expone los estados en /orders/statuses
    const { data } = await api.get('orders/statuses');
    // data es un array de { name, slug, ... }
    res.json(data);
  } catch (err) {
    console.error('Error al obtener estados de pedido:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudieron cargar los estados.' });
  }
});

module.exports = router;
