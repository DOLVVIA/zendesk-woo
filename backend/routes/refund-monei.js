const express = require('express');
const fetch = require('node-fetch');

const router = express.Router();

// POST /api/refund-monei
// Body JSON:
// {
//   orderId, chargeId, amount,                  // amount en céntimos
//   monei_api_key
// }
router.post('/', async (req, res) => {
  // 1) Validar cabecera
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'x-zendesk-secret inválido' });
  }

  // 2) Leer campos
  const { monei_api_key, orderId, chargeId, amount } = req.body;

  // 3) Validaciones
  if (!orderId || !chargeId || amount == null) {
    return res.status(400).json({ error: 'Falta orderId, chargeId o amount.' });
  }
  if (!monei_api_key) {
    return res.status(400).json({ error: 'Falta monei_api_key.' });
  }

  try {
    // 4) Petición POST a la API de MONEI
    const response = await fetch(`https://api.monei.com/v1/charges/${chargeId}/refunds`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${monei_api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount }) // céntimos
    });

    const json = await response.json();

    if (!response.ok) {
      console.error('❌ Error MONEI refund:', json);
      return res.status(response.status).json({ success: false, error: json.message || 'Error desconocido' });
    }

    // 5) Devolver resultado
    return res.json({ success: true, refund: json });
  } catch (err) {
    console.error('❌ Error refund-monei:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
