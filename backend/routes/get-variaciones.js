// backend/routes/get-variaciones.js

const express = require('express');
const router = express.Router();
const { createApi } = require('../utils/woocommerce');

// GET /api/get-variaciones?product_id=123&woocommerce_url=...&consumer_key=...&consumer_secret=...
router.get('/', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res
      .status(401)
      .json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros dinámicos de req.query
  const {
    product_id,
    woocommerce_url,
    consumer_key,
    consumer_secret
  } = req.query;

  // 3) Validaciones básicas
  if (!product_id) {
    return res
      .status(400)
      .json({ error: 'Falta el parámetro product_id en query.' });
  }
  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error:
        'Faltan parámetros de conexión. Incluye woocommerce_url, consumer_key y consumer_secret en query.'
    });
  }

  try {
    // 4) Construir cliente WooCommerce
    const api = createApi({ woocommerce_url, consumer_key, consumer_secret });
    // 5) Obtener variaciones
    const response = await api.get(`products/${product_id}/variations`, {
      per_page: 100
    });
    // 6) Devolver array de variaciones
    res.json(response.data);
  } catch (err) {
    console.error(
      'Error al obtener variaciones del producto:',
      err.response?.data || err.message
    );
    res
      .status(500)
      .json({ error: 'No se pudieron obtener las variaciones del producto.' });
  }
});

module.exports = router;
