// backend/routes/get-stripe-charges.js

const express = require('express');
const Stripe = require('stripe');
const router = express.Router();

// GET /api/get-stripe-charges?email=cliente@ejemplo.com&stripe_secret_key=tu_clave_secreta
router.get('/', async (req, res) => {
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  const { email, stripe_secret_key } = req.query;

  if (!email || !stripe_secret_key) {
    return res.status(400).json({
      error: 'Faltan parámetros: email y stripe_secret_key son obligatorios.'
    });
  }

  try {
    const stripe = new Stripe(stripe_secret_key, { apiVersion: '2022-11-15' });

    // Buscar hasta 100 clientes con ese email
    const customers = await stripe.customers.search({
      query: `email:'${email}'`,
      limit: 100
    });

    if (!customers.data.length) {
      return res.json([]); // No hay clientes
    }

    const allCharges = [];

    // Recorrer cada cliente y obtener hasta 100 cargos
    for (const customer of customers.data) {
      const charges = await stripe.charges.list({
        customer: customer.id,
        limit: 100
      });
      allCharges.push(...charges.data);
    }

    // Ordenar por fecha descendente
    allCharges.sort((a, b) => b.created - a.created);

    res.json(allCharges);
  } catch (err) {
    console.error('Error al obtener cargos de Stripe:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
