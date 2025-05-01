// backend/routes/get-stripe-charges.js

const express = require('express');
const Stripe = require('stripe');
const router = express.Router();

// GET /api/get-stripe-charges?email=cliente@ejemplo.com&stripe_secret_key=tu_clave_secreta
router.get('/', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros dinámicos de req.query
  const { email, stripe_secret_key } = req.query;

  // 3) Validaciones básicas
  if (!email) {
    return res.status(400).json({ error: 'Falta el parámetro email en query.' });
  }
  if (!stripe_secret_key) {
    return res.status(400).json({
      error: 'Falta stripe_secret_key en query para autenticar con Stripe.'
    });
  }

  try {
    // 4) Inicializar Stripe dinámicamente
    const stripe = new Stripe(stripe_secret_key, { apiVersion: '2022-11-15' });

    // 5) Buscar cliente por email
    const custSearch = await stripe.customers.search({
      query: `email:'${email}'`,
      limit: 1
    });

    if (!custSearch.data.length) {
      // Ningún cliente encontrado → devolvemos array vacío
      return res.json([]);
    }

    const customer = custSearch.data[0];

    // 6) Listar cargos del cliente
    const chargesList = await stripe.charges.list({
      customer: customer.id,
      limit: 20
    });

    // 7) Devolver array de cargos
    res.json(chargesList.data);
  } catch (err) {
    console.error('Error al buscar clientes o cargos en Stripe:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
