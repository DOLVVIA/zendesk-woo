const express = require('express');
const router = express.Router();
const { fetchCountryStates } = require('../utils/woocommerce');

// GET /api/get-provincias?country=ES&woocommerce_url=...&consumer_key=...&consumer_secret=...
router.get('/get-provincias', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros de conexión dinámicos de req.query
  const {
    woocommerce_url,
    consumer_key,
    consumer_secret,
    country = 'ES'
  } = req.query;

  // 3) Validaciones básicas
  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error:
        'Faltan parámetros de conexión. Incluye woocommerce_url, consumer_key y consumer_secret en query.'
    });
  }

  // 4) Normalizar código de país
  const countryCode = String(country).toUpperCase();

  try {
    // 5) Obtener estados/provincias del país usando la utilidad
    const states = await fetchCountryStates(
      { woocommerce_url, consumer_key, consumer_secret },
      countryCode
    );

    // 6) Extraer nombres de provincias, filtrar vacíos y ordenar
    const provinces = (states || [])
      .map(s => s.name)
      .filter(Boolean)
      .sort();

    // 7) Devolver la lista de provincias
    res.json(provinces);
  } catch (err) {
    console.error('Error al obtener provincias:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudieron cargar las provincias.' });
  }
});

module.exports = router;
