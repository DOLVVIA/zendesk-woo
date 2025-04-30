// backend/routes/editar-direccion.js

const express = require('express');
const router = express.Router();
const { createApi } = require('../utils/woocommerce');

// PUT /api/editar-direccion?order_id=XXX&billing=...&shipping=...&woocommerce_url=...&consumer_key=...&consumer_secret=...
router.put('/', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros dinámicos de req.query
  const {
    order_id,
    billing,
    shipping,
    woocommerce_url,
    consumer_key,
    consumer_secret
  } = req.query;

  // 3) Validaciones
  if (!order_id) {
    return res.status(400).json({ error: 'Falta order_id en query.' });
  }
  if (!billing && !shipping) {
    return res.status(400).json({ error: 'Debe incluir al menos billing o shipping en query.' });
  }
  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error:
        'Faltan parámetros de conexión. Incluye woocommerce_url, consumer_key y consumer_secret en query.'
    });
  }

  try {
    // 4) Construir cliente y payload
    const api = createApi({ woocommerce_url, consumer_key, consumer_secret });
    const payload = {};
    if (billing)  payload.billing  = JSON.parse(billing);
    if (shipping) payload.shipping = JSON.parse(shipping);

    // 5) Ejecutar la actualización de la orden
    const response = await api.put(`orders/${order_id}`, payload);

    // 6) Enviar respuesta
    res.status(200).json({
      message: 'Dirección del pedido actualizada',
      data: response.data
    });
  } catch (err) {
    console.error('Error al actualizar dirección del pedido:', err.response?.data || err.message);
    res.status(500).json({ error: 'Error al actualizar la dirección del pedido.' });
  }
});

module.exports = router;
