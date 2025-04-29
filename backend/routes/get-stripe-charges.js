// backend/routes/get-stripe-charges.js
const express = require('express');
const router  = express.Router();
const Stripe  = require('stripe');

// Inicializa Stripe con la clave de tu .env
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15',
});

// GET /api/get-stripe-charges?email=cliente@ejemplo.com
router.get('/get-stripe-charges', async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'Falta el parámetro email.' });
  }

  try {
    // 1) Buscamos al cliente en Stripe por email
    const custSearch = await stripe.customers.search({
      query: `email:'${email}'`,
      limit: 1
    });
    if (!custSearch.data.length) {
      return res.json([]);  // ningún cliente → array vacío
    }
    const customer = custSearch.data[0];

    // 2) Listamos sus cargos
    const chargesList = await stripe.charges.list({
      customer: customer.id,
      limit:    20
    });

    // 3) Devolvemos el array de cargos
    res.json(chargesList.data);
  } catch (err) {
    console.error('Error al buscar clientes o cargos en Stripe:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
