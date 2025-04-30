const express = require('express');
const router = express.Router();
const { fetchOrderStatuses } = require('../utils/woocommerce');

// GET /api/get-estados?woocommerce_url=...&consumer_key=...&consumer_secret=...
router.get('/get-estados', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros dinámicos de req.query
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
    // 4) Obtener los estados de pedido usando la utilidad
    const statuses = await fetchOrderStatuses({
      woocommerce_url,
      consumer_key,
      consumer_secret
    });

    // 5) Devolver la lista de estados
    res.json(statuses);
  } catch (err) {
    console.error('Error al obtener estados de pedido:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudieron cargar los estados.' });
  }
});

module.exports = router;
