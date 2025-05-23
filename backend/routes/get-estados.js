const express = require('express');
const NodeCache = require('node-cache');
const router = express.Router();
const { fetchOrderStatuses } = require('../utils/woocommerce');

// Caché de 10 horas (36000 segundos)
const cache = require('../cache');


router.get('/', async (req, res) => {
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  const { woocommerce_url, consumer_key, consumer_secret } = req.query;

  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error: 'Faltan parámetros de conexión. Incluye woocommerce_url, consumer_key y consumer_secret en query.'
    });
  }

  const cacheKey = `${woocommerce_url}_estados`;

  try {
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const statuses = await fetchOrderStatuses({ woocommerce_url, consumer_key, consumer_secret });

    cache.set(cacheKey, statuses);
    res.json(statuses);
  } catch (err) {
    console.error('Error al obtener estados de pedido:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudieron cargar los estados.' });
  }
});

module.exports = router;
