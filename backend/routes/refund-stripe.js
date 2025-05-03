// backend/routes/refund-stripe.js
require('dotenv').config();
const express = require('express');
const Stripe = require('stripe');
const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;

const router = express.Router();

// Inicializamos el cliente de WooCommerce
const wcApi = new WooCommerceRestApi({
  url: process.env.WC_URL,            // p.e. https://tusitio.com
  consumerKey: process.env.WC_KEY,    // tu ck_xxx
  consumerSecret: process.env.WC_SECRET,  // tu cs_xxx
  version: 'wc/v3'
});

// POST /api/refund-stripe
// Body JSON:
// {
//   orderId: string,           // **nuevo**: el ID de pedido en WooCommerce
//   chargeId: string,          // el ID de cargo en Stripe
//   amount: number,            // importe en céntimos
//   stripe_secret_key: string  // tu clave secreta de Stripe
// }
router.post('/', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros del body
  const { orderId, chargeId, amount, stripe_secret_key } = req.body;

  // 3) Validaciones básicas
  if (!orderId) {
    return res.status(400).json({ error: 'Falta orderId en el body.' });
  }
  if (!chargeId || amount == null) {
    return res.status(400).json({ error: 'Falta chargeId o amount en el body.' });
  }
  if (!stripe_secret_key) {
    return res.status(400).json({
      error: 'Falta stripe_secret_key en el body para autenticar con Stripe.'
    });
  }

  try {
    // 4) Crear el reembolso en Stripe
    const stripe = new Stripe(stripe_secret_key, { apiVersion: '2022-11-15' });
    const refund = await stripe.refunds.create({ charge: chargeId, amount });

    // 5) Registrar el reembolso en WooCommerce (importe en €)
    const refundData = {
      amount: (amount / 100).toFixed(2), // convertir céntimos a euros
      reason: 'Reembolso desde Zendesk'
    };
    await wcApi.post(`orders/${orderId}/refunds`, refundData);

    // 6) Actualizar el estado del pedido a "refunded"
    await wcApi.put(`orders/${orderId}`, { status: 'refunded' });

    // 7) Responder al frontend
    res.json({ success: true, refund });
  } catch (err) {
    console.error('Error al procesar refund Stripe / Woo:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
