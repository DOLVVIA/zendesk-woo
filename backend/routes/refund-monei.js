// backend/routes/refund-monei.js
const express = require('express');
const fetch   = require('node-fetch');

const router = express.Router();

// POST /api/refund-monei
// Body: { orderId, chargeId, amount, monei_api_key }
router.post('/', async (req, res) => {
  // 1) Validar cabecera de Zendesk
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'x-zendesk-secret inválido' });
  }

  // 2) Leer y validar payload
  const { monei_api_key, orderId, chargeId, amount } = req.body;
  if (!orderId || !chargeId || amount == null) {
    return res.status(400).json({ error: 'Falta orderId, chargeId o amount.' });
  }
  if (!monei_api_key) {
    return res.status(400).json({ error: 'Falta monei_api_key.' });
  }

  try {
    // 3) Montamos el Basic Auth
    const basicAuth = Buffer.from(`${monei_api_key}:`).toString('base64');

    // 4) Llamada a MONEI
    const response = await fetch(
      `https://api.monei.com/v1/charges/${chargeId}/refunds`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type':  'application/json'
        },
        body: JSON.stringify({ amount })
      }
    );

    const json = await response.json();
    if (!response.ok) {
      console.error('❌ Error MONEI refund:', json);
      return res
        .status(response.status)
        .json({ success: false, error: json.message || 'Error desconocido' });
    }

    // 5) Devolver al frontend
    return res.json({ success: true, refund: json });

  } catch (err) {
    console.error('❌ Error refund-monei:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
