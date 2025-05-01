const express = require('express');
const router = express.Router();
const { obtenerPedidosPorEmail } = require('../utils/woocommerce');

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
    // 3) Obtener pedidos desde WooCommerce
    let pedidos = await obtenerPedidosPorEmail(
      { woocommerce_url, consumer_key, consumer_secret },
      email
    );

    // 4) Extraer metadatos relevantes
    pedidos = pedidos.map(pedido => {
      const meta = Array.isArray(pedido.meta_data) ? pedido.meta_data : [];

      const getMeta = key => {
        const entry = meta.find(m => m.key === key);
        return entry ? entry.value : null;
      };

      // Order ID (por si quieres usar OrdersGetRequest)
      const paypal_order_id = getMeta('_ppcp_paypal_order_id');

      // Fallbacks para obtener un Capture ID válido (PayPal)
      const paypal_capture_id =
        getMeta('_ppcp_paypal_capture_id') ||
        getMeta('paypal_transaction_id') ||
        getMeta('_paypal_transaction_id');

      return {
        id: pedido.id,
        status: pedido.status,
        total: pedido.total,
        email: pedido.billing?.email || null,
        payment_method: pedido.payment_method,
        paypal_order_id,
        paypal_capture_id,
      };
    });

    // 5) Enviar resultado
    res.json({ email, pedidos });
  } catch (err) {
    console.error('Error al obtener pedidos por email:', err.response?.data || err.message);
    res.status(500).json({ error: 'Error al obtener los pedidos.' });
  }
});

module.exports = router;
