// routes/buscar-pedidos.js
const express = require('express');
const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;

const router = express.Router();

/**
 * GET /api/buscar-pedidos
 * Query params:
 *   - email
 *   - woocommerce_url
 *   - consumer_key
 *   - consumer_secret
 */
router.get('/', async (req, res) => {
  // 1) Validar cabecera Zendesk
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Parámetros obligatorios
  const { email, woocommerce_url, consumer_key, consumer_secret } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'El parámetro email es obligatorio.' });
  }
  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error: 'Faltan parámetros de conexión. Incluye woocommerce_url, consumer_key y consumer_secret.'
    });
  }

  try {
    // 3) Inicializar cliente WooCommerce
    const wcApi = new WooCommerceRestApi({
      url: woocommerce_url,
      consumerKey: consumer_key,
      consumerSecret: consumer_secret,
      version: 'wc/v3',
      queryStringAuth: true
    });

    // 4) Búsqueda rápida por email con parámetro ?search
    const { data: pedidos } = await wcApi.get('orders', {
      search: email,
      status: 'any',
      per_page: 10
    });

    // 5) Filtrado adicional por billing.email exacto
    const filtrados = pedidos.filter(p =>
      p.billing?.email?.toLowerCase() === email.toLowerCase()
    );

    return res.json({ pedidos: filtrados });
  } catch (err) {
    console.error('❌ Error buscar-pedidos:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Error al obtener pedidos desde WooCommerce.' });
  }
});

module.exports = router;
