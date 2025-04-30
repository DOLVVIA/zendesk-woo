const express = require('express');
const router = express.Router();
const { getPedidosPorEmail } = require('../utils/editar-woocommerce');

// GET /api/buscar-pedidos?email=cliente@ejemplo.com&woocommerce_url=...&consumer_key=...&consumer_secret=...
router.get('/buscar-pedidos', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros desde query
  const {
    email,
    woocommerce_url,
    consumer_key,
    consumer_secret
  } = req.query;

  // 3) Validaciones básicas
  if (!email) {
    return res.status(400).json({ error: 'El parámetro email es obligatorio en query.' });
  }
  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error: 'Faltan parámetros de conexión. Incluye woocommerce_url, consumer_key y consumer_secret en query.'
    });
  }

  try {
    // 4) Llamar a la utilidad para obtener pedidos por email
    const pedidos = await getPedidosPorEmail(
      { woocommerce_url, consumer_key, consumer_secret },
      email
    );

    // 5) Devolver respuesta
    res.json({ email, pedidos });
  } catch (err) {
    console.error('Error al obtener pedidos por email:', err.response?.data || err.message);
    res.status(500).json({ error: 'Error al obtener los pedidos.' });
  }
});

module.exports = router;
