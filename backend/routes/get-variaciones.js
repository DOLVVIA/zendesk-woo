const express = require('express');
const router = express.Router();
const { api } = require('../utils/woocommerce');

// GET /api/get-variaciones?product_id=123
router.get('/get-variaciones', async (req, res) => {
  const { product_id } = req.query;
  if (!product_id) {
    return res.status(400).json({ error: 'Falta el parámetro product_id' });
  }

  try {
    // Llamada a WooCommerce para obtener variaciones del producto
    const response = await api.get(`products/${product_id}/variations`);
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener variaciones:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al obtener variaciones' });
  }
});

module.exports = router;
