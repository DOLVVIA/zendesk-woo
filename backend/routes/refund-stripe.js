require('dotenv').config();
const express = require('express');
const Stripe = require('stripe');
const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;

const router = express.Router();

router.post('/', async (req, res) => {
  // 1️⃣ Validar x-zendesk-secret
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2️⃣ Mapear nombres antiguos/nuevos
  const {
    stripe_secret_key: stripeKeyNew, secret_key,
    woocommerce_consumer_key: wooKeyNew, consumer_key,
    woocommerce_consumer_secret: wooSecretNew, consumer_secret,
    orderId, chargeId, amount, woocommerce_url
  } = req.body;

  const stripe_secret_key           = stripeKeyNew || secret_key;
  const woocommerce_consumer_key    = wooKeyNew  || consumer_key;
  const woocommerce_consumer_secret = wooSecretNew || consumer_secret;

  // 3️⃣ Validaciones
  if (!orderId || !chargeId || amount == null) {
    return res.status(400).json({ error: 'Falta orderId, chargeId o amount en el body.' });
  }
  if (!stripe_secret_key) {
    return res.status(400).json({ error: 'Falta stripe_secret_key (o secret_key).' });
  }
  if (!woocommerce_url || !woocommerce_consumer_key || !woocommerce_consumer_secret) {
    return res.status(400).json({
      error: 'Faltan parámetros de WooCommerce (url/key/secret).'
    });
  }

  try {
    // 4️⃣ Reembolso en Stripe
    const stripe = new Stripe(stripe_secret_key, { apiVersion: '2022-11-15' });
    const refund = await stripe.refunds.create({ charge: chargeId, amount });

    // 5️⃣ Instanciar WooCommerce REST API
    const wcApi = new WooCommerceRestApi({
      url:            woocommerce_url,
      consumerKey:    woocommerce_consumer_key,
      consumerSecret: woocommerce_consumer_secret,
      version:        'wc/v3'
    });

    // 6️⃣ Registrar reembolso en WooCommerce
    //    IMPORTANTE: enviamos una cadena con punto (p.e. "19.99")
    const amountEuros = (amount / 100).toFixed(2);
    await wcApi.post(`orders/${orderId}/refunds`, {
      amount: amountEuros,
      reason: 'Reembolso desde Zendesk'
    });

    // 7️⃣ Marcar pedido como refunded
    await wcApi.put(`orders/${orderId}`, { status: 'refunded' });

    // 8️⃣ Devolver éxito
    return res.json({ success: true, refund });
  } catch (err) {
    console.error('🔥 Error en refund-stripe:', err);
    if (err.response && err.response.data) {
      console.error('Response data:', err.response.data);
      return res.status(500).json({
        success: false,
        error: err.response.data.message || JSON.stringify(err.response.data)
      });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
