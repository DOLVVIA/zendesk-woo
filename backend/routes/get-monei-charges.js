// backend/routes/get-monei-charges.js

const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// GET /api/get-monei-charges?email=cliente@ejemplo.com
// Header:   x-monei-api-key: pk_live_xxx
// Header:   x-zendesk-secret: <tu_shared_secret>

router.get('/', async (req, res) => {
  // 1) Validar seguridad con x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Obtener email y API key desde headers seguros
  const { email } = req.query;
  const moneiApiKey = req.get('x-monei-api-key');

  // 3) Validaciones
  if (!email) {
    return res.status(400).json({ error: 'Falta el parámetro email en query.' });
  }
  if (!moneiApiKey) {
    return res.status(400).json({ error: 'Falta x-monei-api-key en headers.' });
  }

  try {
    // 4) Llamada segura a la API GraphQL de MONEI
    const response = await fetch('https://graphql.monei.com', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${moneiApiKey}`,  // ← prefijo "Bearer "
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
              }
            }
          }
        `
      })
    });

    const result = await response.json();

    // 5) Verificación robusta de errores
    if (result.errors || !result.data || !result.data.charges) {
      console.error('❌ Error al consultar MONEI:', JSON.stringify(result, null, 2));
      return res.status(500).json({
        error: 'Respuesta inválida de MONEI',
        details: result.errors || result
      });
    }

    // 6) Enviar cargos al frontend
    res.json(result.data.charges.items);

  } catch (err) {
    console.error('❌ Error al llamar a MONEI:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
