const express = require('express');
const NodeCache = require('node-cache');
const router = express.Router();
const { createApi } = require('../utils/woocommerce');

// Caché de 10 horas (36000 segundos)
const cache = require('../cache');


router.get('/', async (req, res) => {
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  const {
    product_id,
    woocommerce_url,
    consumer_key,
    consumer_secret
  } = req.query;

  if (!product_id) {
    return res.status(400).json({ error: 'Falta el parámetro product_id en query.' });
  }
  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error: 'Faltan parámetros de conexión. Incluye woocommerce_url, consumer_key y consumer_secret en query.'
    });
  }

  const cacheKey = `${woocommerce_url}_variaciones_${product_id}`;

  try {
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const api = createApi({ woocommerce_url, consumer_key, consumer_secret });

    const response = await api.get(`products/${product_id}/variations`, {
      per_page: 100
    });

    cache.set(cacheKey, response.data);
    res.json(response.data);
  } catch (err) {
    console.error(
      'Error al obtener variaciones del producto:',
      err.response?.data || err.message
    );
    res.status(500).json({ error: 'No se pudieron obtener las variaciones del producto.' });
  }
});

module.exports = router;
