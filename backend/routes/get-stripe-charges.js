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

  if (!email) {
    return res.status(400).json({ error: 'Falta el parámetro email en query.' });
  }
  if (!stripe_secret_key) {
    return res.status(400).json({
      error: 'Falta stripe_secret_key en query para autenticar con Stripe.'
    });
  }

  try {
    const stripe = new Stripe(stripe_secret_key, { apiVersion: '2022-11-15' });

    // Buscar cliente por email
    const customers = await stripe.customers.search({
      query: `email:"${email}"`,
      limit: 1
    });

    if (!customers.data.length) {
      return res.json([]);
    }

    const customerId = customers.data[0].id;

    // Paginación para obtener todos los cargos del cliente
    let charges = [];
    let hasMore = true;
    let startingAfter = null;

    while (hasMore && charges.length < 1000) {
      const response = await stripe.charges.list({
        customer: customerId,
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {})
      });

      charges.push(...response.data);
      hasMore = response.has_more;
      if (response.data.length) {
        startingAfter = response.data[response.data.length - 1].id;
      }
    }

    // Opcional: ordenar por fecha de creación descendente
    charges.sort((a, b) => b.created - a.created);

    res.json(charges);
  } catch (err) {
    console.error('Error al buscar clientes o cargos en Stripe:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
