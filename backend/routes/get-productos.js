const express = require('express');
const NodeCache = require('node-cache');
const router = express.Router();
const { fetchProducts } = require('../utils/woocommerce');

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

  const cacheKey = `${woocommerce_url}_productos`;

  try {
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const productsData = await fetchProducts({ woocommerce_url, consumer_key, consumer_secret });

    const products = productsData.map(p => ({
      id: p.id,
      name: p.name
    }));

    cache.set(cacheKey, products);
    res.json(products);
  } catch (err) {
    console.error('Error al cargar productos:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudieron obtener los productos.' });
  }
});

module.exports = router;
