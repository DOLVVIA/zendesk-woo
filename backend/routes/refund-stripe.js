// backend/routes/refund-stripe.js
require('dotenv').config();
const express = require('express');
const Stripe = require('stripe');
const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;

const router = express.Router();

// POST /api/refund-stripe
// Body JSON:
// {
//   orderId: string,                    // ID de pedido en WooCommerce
//   chargeId: string,                   // ID de cargo en Stripe
//   amount: number,                     // importe en céntimos
//   stripe_secret_key: string,          // clave secreta Stripe
//   woocommerce_url: string,            // URL de WooCommerce (desde Zendesk parameters)
//   woocommerce_consumer_key: string,   // consumer key WooCommerce
//   woocommerce_consumer_secret: string // consumer secret WooCommerce
// }
router.post('/', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros del body
  const {
    orderId,
    chargeId,
    amount,
    stripe_secret_key,
    woocommerce_url,
    consumer_key,
    onsumer_secret
  } = req.body;

  // 3) Validaciones básicas
  if (!orderId || !chargeId || amount == null) {
    return res.status(400).json({ error: 'Falta orderId, chargeId o amount en el body.' });
  }
  if (!stripe_secret_key) {
    return res.status(400).json({ error: 'Falta stripe_secret_key en el body.' });
  }
  if (!woocommerce_url || !woocommerce_consumer_key || !woocommerce_consumer_secret) {
    return res.status(400).json({
      error: 'Faltan parámetros de WooCommerce en el body (url/key/secret).'
    });
  }

  try {
    // 4) Crear reembolso en Stripe
    const stripe = new Stripe(stripe_secret_key, { apiVersion: '2022-11-15' });
    const refund = await stripe.refunds.create({ charge: chargeId, amount });

    // 5) Instanciar WooCommerce REST API con credenciales dinámicas
    const wcApi = new WooCommerceRestApi({
      url:              woocommerce_url,
      consumerKey:      woocommerce_consumer_key,
      consumerSecret:   woocommerce_consumer_secret,
      version:          'wc/v3'
    });

    // 6) Registrar reembolso en WooCommerce (importe en €)
    await wcApi.post(`orders/${orderId}/refunds`, {
      amount: (amount / 100).toFixed(2),
      reason: 'Reembolso desde Zendesk'
    });

    // 7) Actualizar estado del pedido a "refunded"
    await wcApi.put(`orders/${orderId}`, { status: 'refunded' });

    // 8) Responder al frontend
    res.json({ success: true, refund });
  } catch (err) {
    console.error('Error en refund-stripe:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
