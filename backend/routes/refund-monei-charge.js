const express = require('express');
const fetch   = require('node-fetch');
const router  = express.Router();

// POST /api/refund-monei-charge
// Body JSON: { chargeId: string, amount: number }  (amount en céntimos)
// Header: x-monei-api-key: pk_live_xxx
// Header: x-zendesk-secret: <tu_shared_secret>
router.post('/', async (req, res) => {
  // 1) Validar seguridad
  const zendeskSecret = req.get('x-zendesk-secret');
  if (!zendeskSecret || zendeskSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer payload y API key Monei
  const { chargeId, amount } = req.body;
  const moneiApiKey = req.get('x-monei-api-key');
  if (!moneiApiKey) {
    return res.status(400).json({ error: 'Falta x-monei-api-key en headers.' });
  }
  if (!chargeId || typeof amount !== 'number') {
    return res.status(400).json({ error: 'Cuerpo inválido: necesita chargeId y amount (entero en céntimos).' });
  }

  try {
    // 3) Llamada al endpoint de refund de Monei
    const url = `https://api.monei.com/v1/payments/${chargeId}/refund`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${moneiApiKey}`,   // con prefijo Bearer
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amount   // <-- entero en céntimos
      })
    });

    const result = await response.json();

    // 4) Manejo de errores
    if (!response.ok) {
      console.error('❌ Monei refund error:', result);
      return res.status(response.status).json({
        success: false,
        error: result.message || JSON.stringify(result)
      });
    }

    // 5) OK: devolvemos el objeto refund
    res.json({
      success: true,
      refund: result
    });

  } catch (err) {
    console.error('❌ Error en refund-monei-charge:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
