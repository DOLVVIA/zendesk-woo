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
    let resultado = [];

    // 1️⃣ Si se busca por ID exacto
    if (id && !email && !nombre) {
      try {
        const { data } = await api.get(`orders/${id}`);
        resultado = [data]; // lo metemos en un array para mantener el formato
      } catch (err) {
        if (err.response?.status === 404) {
          return res.json({ pedidos: [] }); // no encontrado
        }
        throw err;
      }
    }

    // 2️⃣ Si se busca por email o nombre
    else if (email || nombre) {
      const searchQuery = email || nombre;
      const { data: pedidos } = await api.get('orders', {
        search: searchQuery,
        status: 'any',
        per_page: 10
      });

      resultado = pedidos.filter(p => {
        const billing = p.billing || {};
        const matchesEmail = email && billing.email?.toLowerCase() === email.toLowerCase();
        const matchesNombre = nombre && `${billing.first_name} ${billing.last_name}`.toLowerCase().includes(nombre.toLowerCase());
        return matchesEmail || matchesNombre;
      });
    }

    return res.json({ pedidos: resultado });
  } catch (error) {
    console.error('❌ Error buscar-pedido-avanzado:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Error interno al buscar pedidos.' });
  }
});

module.exports = router;
