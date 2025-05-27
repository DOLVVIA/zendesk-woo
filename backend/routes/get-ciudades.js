const express = require('express');
const router = express.Router();
const cache = require('../cache');
const { fetchOrders } = require('../utils/woocommerce');

// GET /api/get-ciudades?country=ES&woocommerce_url=...&consumer_key=...&consumer_secret=...
router.get('/', async (req, res) => {
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  const { woocommerce_url, consumer_key, consumer_secret, country } = req.query;

  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error: 'Faltan parámetros de conexión. Incluye woocommerce_url, consumer_key y consumer_secret en query.'
    });
  }

  const normalizedCountry = (country || 'ES').toUpperCase();
  const cacheKey = `${woocommerce_url}_ciudades_${normalizedCountry}`;

  try {
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`🗃️ Devuelto desde caché: ${cacheKey}`);
      return res.json(cached);
    }

    const orders = await fetchOrders({ woocommerce_url, consumer_key, consumer_secret });

    // Log de depuración de países
    orders.forEach(o => {
      console.log(`📦 Pedido ${o.id}:`, {
        country: o.billing?.country,
        city: o.billing?.city
      });
    });

    // Filtro estricto
    const cities = Array.from(
      new Set(
        orders
          .filter(order =>
            order.billing?.country &&
            order.billing?.city &&
            order.billing.country.toUpperCase() === normalizedCountry
          )
          .map(order => order.billing.city.trim())
          .filter(Boolean)
      )
    ).sort();

    console.log(`🌍 Ciudades válidas para ${normalizedCountry}:`, cities);

    cache.set(cacheKey, cities);
    res.json(cities);
  } catch (err) {
    console.error('❌ Error al obtener ciudades:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudieron cargar las ciudades.' });
  }
});

module.exports = router;
