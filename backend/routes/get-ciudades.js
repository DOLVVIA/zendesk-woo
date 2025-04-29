// backend/routes/get-ciudades.js
const express = require('express');
const router  = express.Router();

// Esta función asume que "api" es tu instancia del SDK de WooCommerce
const { api } = require('../utils/woocommerce');

router.get('/get-ciudades', async (req, res) => {
  try {
    // Hacemos la llamada a WooCommerce y extraemos directamente el array de pedidos
    const { data: results } = await api.get('orders', {
      per_page: 100,            // ajusta según tu volumen de pedidos
      _fields: ['billing.city'] // solo nos interesa la ciudad de facturación
    });

    // Extraemos las ciudades, quitamos duplicados y ordenamos
    const cities = Array.from(
      new Set(
        results
          .map(o => o.billing.city) // sacamos billing.city de cada pedido
          .filter(Boolean)          // descartamos valores vacíos o nulos
      )
    ).sort();

    // Enviamos el JSON con la lista de ciudades
    res.json(cities);
  } catch (err) {
    console.error('Error get-ciudades:', err);
    res.status(500).json({ error: 'no se pudieron cargar ciudades' });
  }
});

module.exports = router;
