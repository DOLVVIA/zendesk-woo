// backend/routes/buscar-pedidos.js
const express = require('express');
const router = express.Router();
const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
const axios = require('axios');

/**
 * GET /api/buscar-pedidos?email=…&woocommerce_url=…&consumer_key=…&consumer_secret=…
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
    return res.status(400).json({ error: 'El parámetro email es obligatorio en query.' });
  }
  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error: 'Faltan parámetros de conexión. Incluye woocommerce_url, consumer_key y consumer_secret en query.'
    });
  }

  try {
    // 3) Inicializar cliente WooCommerce REST API
    const wcApi = new WooCommerceRestApi({
      url:        woocommerce_url,
      consumerKey:    consumer_key,
      consumerSecret: consumer_secret,
      version:    'wc/v3'
    });

    // 4) Obtener todos los estados (tanto los nativos de WooCommerce como los tuyos)
    //    Llamamos a nuestra propia ruta interna /get-estados
    const estadosResp = await axios.get(`${process.env.BACKEND_URL}/api/get-estados`, {
      params: { woocommerce_url, consumer_key, consumer_secret },
      headers: { 'x-zendesk-secret': process.env.ZENDESK_SHARED_SECRET }
    });
    const estados = estadosResp.data;               // [{ slug: 'completed', name: ... }, ...]
    const slugs  = estados.map(s => s.slug).join(',');

    // 5) Listar pedidos del cliente filtrando por **todos** esos estados
    //    paginamos hasta 100 por página para garantizar que traemos la mayoría
    const pedidosResp = await wcApi.get('orders', {
      per_page: 100,
      status:   slugs,    // e.g. "completed,processing,on-hold,my-custom-status,…"
      // **WooCommerce API no filtra por email directamente**: 
      //   si tu util usa otro método, sustituye esta línea por tu propia búsqueda por email.
      //   Muchos escriben `search: email` o usan meta_query en utils.obtenerPedidosPorEmail.
      search: email
    });

    // 6) Devolver
    return res.json({
      email,
      estados: estados.map(s => s.slug),
      pedidos: pedidosResp.data
    });
  } catch (err) {
    console.error('Error al obtener pedidos por email:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Error al obtener los pedidos.' });
  }
});

module.exports = router;
