const express = require('express');
const router = express.Router();
const { fetchProducts } = require('../utils/woocommerce');

// GET /api/get-productos?woocommerce_url=...&consumer_key=...&consumer_secret=...
// Devuelve [{ id, name }] de todos los productos (no variaciones).
router.get('/', async (req, res) => {
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
    // 4) Obtener productos usando la utilidad
    const productsData = await fetchProducts({
      woocommerce_url,
      consumer_key,
      consumer_secret
    });

    // 5) Mapear al formato requerido
    const products = productsData.map(p => ({
      id: p.id,
      name: p.name
    }));

    // 6) Devolver la lista de productos
    res.json(products);
  } catch (err) {
    console.error('Error al cargar productos:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudieron obtener los productos.' });
  }
});

module.exports = router;
