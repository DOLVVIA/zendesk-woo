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
 *
 * Devuelve todos los pedidos (status = 'any') y luego filtra
 * por billing.email === email
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
    // 3) Inicializar el cliente de WooCommerce con credenciales dinámicas
    const wcApi = new WooCommerceRestApi({
      url:         woocommerce_url,
      consumerKey: consumer_key,
      consumerSecret: consumer_secret,
      version:     'wc/v3'
    });

    // 4) Pedir TODOS los pedidos (status = 'any') hasta 100
    const { data: allOrders } = await wcApi.get('orders', {
      per_page: 100,
      status:   'any'
    });

    // 5) Filtrar por correo de facturación (case-insensitive)
    const pedidos = allOrders.filter(o =>
      o.billing &&
      o.billing.email &&
      o.billing.email.toLowerCase() === email.toLowerCase()
    );

    // 6) Responder con el listado completo
    res.json({ email, pedidos });
  } catch (err) {
    console.error('Error al obtener pedidos por email:', err.response?.data || err.message);
    res.status(500).json({ error: 'Error al obtener los pedidos.' });
  }
});

module.exports = router;
