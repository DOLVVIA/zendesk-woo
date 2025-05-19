require('dotenv').config();
const express = require('express');
const Stripe = require('stripe');

const router = express.Router();

// POST /api/refund-stripe
// Body JSON:
// {
//   orderId, chargeId, amount,                  // amount en céntimos
//   stripe_secret_key  o secret_key
// }
router.post('/', async (req, res) => {
  // 1) Validar cabecera
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'x-zendesk-secret inválido' });
  }

  // 2) Leer campos
  const {
    stripe_secret_key: stripeKeyNew,
    secret_key,
    orderId,
    chargeId,
    amount
  } = req.body;

  const stripe_secret_key = stripeKeyNew || secret_key;

  // 3) Validaciones
  if (!orderId || !chargeId || amount == null) {
    return res.status(400).json({ error: 'Falta orderId, chargeId o amount.' });
  }
  if (!stripe_secret_key) {
    return res.status(400).json({ error: 'Falta stripe_secret_key (o secret_key).' });
  }

  try {
    // 4) Reembolso en Stripe
    const stripe = new Stripe(stripe_secret_key, { apiVersion: '2022-11-15' });
    const refund = await stripe.refunds.create({
      charge: chargeId,
      amount // céntimos
    });

    // 5) Responder al frontend
    return res.json({ success: true, refund });
  } catch (err) {
    console.error('Error en refund-stripe:', err.response?.data || err.message);
    const message = err.response?.data?.message || err.message;
    return res.status(500).json({ success: false, error: message });
  }
});

module.exports = router;
