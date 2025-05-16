// backend/routes/buscar-pedido-avanzado.js

const express = require('express');
const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
const router = express.Router();

router.get('/', async (req, res) => {
  const secret = req.get('x-zendesk-secret');
  if (!secret || secret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  const { email, id, nombre, woocommerce_url, consumer_key, consumer_secret } = req.query;

  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error: 'Faltan parámetros de conexión: woocommerce_url, consumer_key o consumer_secret.'
    });
  }

  const api = new WooCommerceRestApi({
    url: woocommerce_url,
    consumerKey: consumer_key,
    consumerSecret: consumer_secret,
    version: 'wc/v3',
    queryStringAuth: true
  });

  try {
    let pedidos = [];

    // Descargar hasta 5 páginas de pedidos
    for (let page = 1; page <= 5; page++) {
      const { data } = await api.get('orders', {
        per_page: 100,
        page,
        status: 'any'
      });
      if (!data.length) break;
      pedidos.push(...data);
    }

    // Filtrar por ID, email o nombre completo
    let resultado = pedidos;

    if (id) {
      resultado = resultado.filter(p => p.id.toString() === id.toString());
    }

    if (email) {
      resultado = resultado.filter(p => p.billing?.email?.toLowerCase() === email.toLowerCase());
    }

    if (nombre) {
      const nombreLower = nombre.toLowerCase();
      resultado = resultado.filter(p =>
        `${p.billing?.first_name} ${p.billing?.last_name}`.toLowerCase().includes(nombreLower)
      );
    }

    return res.json({ pedidos: resultado });
  } catch (error) {
    console.error('Error al buscar pedidos:', error.message);
    return res.status(500).json({ error: 'Error interno al buscar pedidos.' });
  }
});

module.exports = router;
