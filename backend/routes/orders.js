// backend/routes/orders.js

const express = require('express');
const router = express.Router();
const { obtenerPedidosPorEmail } = require('../utils/woocommerce');

// GET /api/buscar-pedidos?email=cliente@ejemplo.com&woocommerce_url=...&consumer_key=...&consumer_secret=...
router.get('/', async (req, res) => {
  // 1) Validar cabecera Zendesk
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Parámetros obligatorios
  const {
    email,
    woocommerce_url,
    consumer_key,
    consumer_secret
  } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'El parámetro email es obligatorio en query.' });
  }
  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error: 'Faltan parámetros de conexión. Incluye woocommerce_url, consumer_key y consumer_secret en query.'
    });
  }

  try {
    // 3) Llamada al util que obtiene pedidos de WooCommerce por email
    let pedidos = await obtenerPedidosPorEmail(
      { woocommerce_url, consumer_key, consumer_secret },
      email
    );

    // 4) En cada pedido, extraer transaction_id o _transaction_id de meta_data
    pedidos = pedidos.map(pedido => {
      let txId = pedido.transaction_id || null;
      if (!txId && Array.isArray(pedido.meta_data)) {
        const meta = pedido.meta_data.find(m =>
          m.key === 'transaction_id' || m.key === '_transaction_id'
        );
        txId = meta ? meta.value : null;
      }
      return {
        ...pedido,
        paypal_tx_id: txId
      };
    });

    // 5) Devolver email y array de pedidos con paypal_tx_id
    res.json({ email, pedidos });
  } catch (err) {
    console.error('Error al obtener pedidos por email:', err.response?.data || err.message);
    res.status(500).json({ error: 'Error al obtener los pedidos.' });
  }
});

module.exports = router;
