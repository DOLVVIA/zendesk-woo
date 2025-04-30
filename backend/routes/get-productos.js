const express = require('express');
const router = express.Router();
const { fetchProducts } = require('../utils/woocommerce');

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

  try {
    const productsData = await fetchProducts({ woocommerce_url, consumer_key, consumer_secret });

    const products = productsData.map(p => ({
      id: p.id,
      name: p.name
    }));

    res.json(products);
  } catch (err) {
    console.error('Error al cargar productos:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudieron obtener los productos.' });
  }
});

module.exports = router;
