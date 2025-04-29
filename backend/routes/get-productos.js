// backend/routes/get-productos.js
const express = require('express');
const router = express.Router();
const { api } = require('../utils/woocommerce');

// GET /api/get-productos
// Devuelve [{ id, name }] de todos los productos (no variaciones).
router.get('/get-productos', async (req, res) => {
  try {
    // Ajusta per_page si tienes muchos productos
    const response = await api.get('products', { per_page: 100 });
    const products = response.data.map(p => ({
      id: p.id,
      name: p.name
    }));
    res.json(products);
  } catch (err) {
    console.error('Error al cargar productos:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudieron obtener los productos' });
  }
});

module.exports = router;
