require('dotenv').config();
const express = require('express');
const Stripe = require('stripe');
const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;

const router = express.Router();

// POST /api/refund-stripe
// Body JSON (admite claves antiguas y nuevas):
// {
//   orderId, chargeId, amount,                  // amount en céntimos
//   stripe_secret_key  o secret_key,
//   woocommerce_url,
//   woocommerce_consumer_key o consumer_key,
//   woocommerce_consumer_secret o consumer_secret
// }
router.post('/', async (req, res) => {
  // 1) Validar cabecera
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'x-zendesk-secret inválido' });
  }

  // 2) Leer campos (viejos y nuevos)
  const {
    // Stripe
    stripe_secret_key: stripeKeyNew, secret_key,
    // WooCommerce
    woocommerce_consumer_key: wooKeyNew, consumer_key,
    woocommerce_consumer_secret: wooSecretNew, consumer_secret,
    // Obligatorios
    orderId, chargeId, amount, woocommerce_url
  } = req.body;

  const stripe_secret_key = stripeKeyNew || secret_key;
  const woocommerce_consumer_key    = wooKeyNew || consumer_key;
  const woocommerce_consumer_secret = wooSecretNew || consumer_secret;

  // 3) Validaciones
  if (!orderId || !chargeId || amount == null) {
    return res.status(400).json({ error: 'Falta orderId, chargeId o amount.' });
  }
  if (!stripe_secret_key) {
    return res.status(400).json({ error: 'Falta stripe_secret_key (o secret_key).' });
  }
  if (!woocommerce_url || !woocommerce_consumer_key || !woocommerce_consumer_secret) {
    return res.status(400).json({ error: 'Faltan parámetros de WooCommerce.' });
  }

  try {
    // 4) Reembolso en Stripe
    const stripe = new Stripe(stripe_secret_key, { apiVersion: '2022-11-15' });
    const refund = await stripe.refunds.create({
      charge: chargeId,
      amount  // céntimos
    });

    // 5) Inicializar WC REST API
    const wcApi = new WooCommerceRestApi({
      url:              woocommerce_url,
      consumerKey:      woocommerce_consumer_key,
      consumerSecret:   woocommerce_consumer_secret,
      version:          'wc/v3'
    });

    // 6) Registrar reembolso en WooCommerce
    //    amountDecimal debe ser un number, no string
    const amountDecimal = parseFloat((amount / 100).toFixed(2));
    await wcApi.post(`orders/${orderId}/refunds`, {
      refund: {
        amount: amountDecimal,
        reason: 'Reembolso desde Zendesk'
      }
    });

    // 7) Marcar pedido como "refunded"
    await wcApi.put(`orders/${orderId}`, {
      status: 'refunded'
    });

    // 8) Responder al frontend
    return res.json({ success: true, refund });
  } catch (err) {
    console.error('Error en refund-stripe:', err.response?.data || err.message);
    const message = err.response?.data?.message || err.message;
    return res.status(500).json({ success: false, error: message });
  }
});

module.exports = router;
