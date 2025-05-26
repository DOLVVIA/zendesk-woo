// backend/routes/get-monei-charges.js

const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// GET /api/get-monei-charges?email=cliente@ejemplo.com
// Header: x-monei-api-key: pk_live_xxx

router.get('/', async (req, res) => {
  // 1) Validación de seguridad
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Parámetros
  const { email } = req.query;
  const moneiApiKey = req.get('x-monei-api-key');

  if (!email) {
    return res.status(400).json({ error: 'Falta el parámetro email en query.' });
  }

  if (!moneiApiKey) {
    return res.status(400).json({ error: 'Falta x-monei-api-key en headers.' });
  }

  try {
    // 3) Llamada a MONEI GraphQL API
    const response = await fetch('https://api.monei.com/v1/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${moneiApiKey}`,
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

    // 4) Validación de respuesta
    if (result.errors || !result.data || !result.data.charges) {
      console.error('❌ Error al consultar MONEI:', result.errors || result);
      return res.status(500).json({ error: 'Respuesta inválida de MONEI', details: result.errors || result });
    }

    // 5) Éxito
    res.json(result.data.charges.items);

  } catch (err) {
    console.error('❌ Error al llamar a MONEI:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
