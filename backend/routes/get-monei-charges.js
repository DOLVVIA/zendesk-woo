// backend/routes/get-monei-charges.js

const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// GET /api/get-monei-charges?email=cliente@ejemplo.com&monei_api_key=pk_live_xxx
router.get('/', async (req, res) => {
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  const { email, monei_api_key } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Falta el parámetro email en query.' });
  }

  if (!monei_api_key) {
    return res.status(400).json({
      error: 'Falta monei_api_key en query para autenticar con MONEI.'
    });
  }

  try {
    const response = await fetch('https://api.monei.com/v1/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${monei_api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          query {
            charges(filter: { customerEmail: { match: "${email}" } }) {
              total
              items {
                id
                status
                amount
                currency
                createdAt
                paymentMethod
              }
            }
          }
        `
      })
    });

    const result = await response.json();

    if (result.errors) {
      console.error('Errores de MONEI:', result.errors);
      return res.status(500).json({ error: 'Error al consultar MONEI', details: result.errors });
    }

    res.json(result.data.charges.items);
  } catch (err) {
    console.error('Error al llamar a MONEI:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
