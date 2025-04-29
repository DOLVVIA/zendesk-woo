// backend/routes/get-provincias.js
const express = require('express');
const router  = express.Router();
const { api } = require('../utils/woocommerce');

// GET /api/get-provincias?country=ES
router.get('/get-provincias', async (req, res) => {
  const country = req.query.country || 'ES';  // por defecto España
  try {
    // Llamada a WooCommerce para traer datos del país y sus estados
    const { data } = await api.get(`data/countries/${country}`);
    // data.states es un array [{ code, name }, …]
    // Extraemos sólo los nombres y los ordenamos
    const provinces = data.states
      .map(s => s.name)
      .filter(Boolean)
      .sort();
    res.json(provinces);
  } catch (err) {
    console.error('Error get-provincias:', err.response?.data || err.message);
    res.status(500).json({ error: 'no se pudieron cargar provincias' });
  }
});

module.exports = router;
