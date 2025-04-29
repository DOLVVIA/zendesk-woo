// backend/routes/refund-stripe.js
const express = require('express');
const router  = express.Router();
const Stripe  = require('stripe');

// Inicializamos Stripe con `new Stripe(key, options)`
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15', // o la versión que uses en tu cuenta
});

// POST /api/refund-stripe
// Body JSON: { chargeId: string, amount: number }
router.post('/refund-stripe', async (req, res) => {
  const { chargeId, amount } = req.body;
  if (!chargeId || amount == null) {
    return res.status(400).json({ error: 'Falta chargeId o amount en el body.' });
  }
  try {
    const refund = await stripe.refunds.create({
      charge: chargeId,
      amount  // en céntimos
    });
    res.json({ success: true, refund });
  } catch (err) {
    console.error('Error refund Stripe:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
