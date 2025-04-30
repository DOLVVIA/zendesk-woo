const express = require('express');
const router = express.Router();
const { fetchOrders } = require('../utils/woocommerce');

// GET /api/get-ciudades?woocommerce_url=...&consumer_key=...&consumer_secret=...
router.get('/get-ciudades', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros de conexión dinámicos de req.query
  const {
    woocommerce_url,
    consumer_key,
    consumer_secret
  } = req.query;

  // 3) Validaciones básicas
  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error:
        'Faltan parámetros de conexión. Incluye woocommerce_url, consumer_key y consumer_secret en query.'
    });
  }

  try {
    // 4) Traer todos los pedidos usando la utilidad
    const orders = await fetchOrders({
      woocommerce_url,
      consumer_key,
      consumer_secret
    });

    // 5) Extraer ciudades, eliminar duplicados y ordenar
    const cities = Array.from(
      new Set(
        orders
          .map(order => order.billing?.city)
          .filter(Boolean)
      )
    ).sort();

    // 6) Devolver la lista de ciudades
    res.json(cities);
  } catch (err) {
    console.error('Error al obtener ciudades:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudieron cargar las ciudades.' });
  }
});

module.exports = router;
