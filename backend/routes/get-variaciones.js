const express = require('express');
const router = express.Router();
const { fetchProductVariations } = require('../utils/editar-woocommerce');

// GET /api/get-variaciones?product_id=123&woocommerce_url=...&consumer_key=...&consumer_secret=...
router.get('/get-variaciones', async (req, res) => {
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
    // 4) Obtener variaciones usando la utilidad
    const variations = await fetchProductVariations(
      { woocommerce_url, consumer_key, consumer_secret },
      product_id
    );

    // 5) Devolver array de variaciones
    res.json(variations);
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
