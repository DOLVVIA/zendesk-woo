const express = require('express');
const NodeCache = require('node-cache');
const router = express.Router();
const { fetchCountryStates } = require('../utils/woocommerce');

// Caché de 10 horas (36000 segundos)
const cache = require('../cache');


router.get('/', async (req, res) => {
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  const {
    woocommerce_url,
    consumer_key,
    consumer_secret,
    country = 'ES'
  } = req.query;

  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error: 'Faltan parámetros de conexión. Incluye woocommerce_url, consumer_key y consumer_secret en query.'
    });
  }

  const countryCode = String(country).toUpperCase();
  const cacheKey = `${woocommerce_url}_provincias_${countryCode}`;

  try {
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const states = await fetchCountryStates(
      { woocommerce_url, consumer_key, consumer_secret },
      countryCode
    );

    const provinces = (states || [])
      .map(s => s.name)
      .filter(Boolean)
      .sort();

    cache.set(cacheKey, provinces);
    res.json(provinces);
  } catch (err) {
    console.error('Error al obtener provincias:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudieron cargar las provincias.' });
  }
});

module.exports = router;
