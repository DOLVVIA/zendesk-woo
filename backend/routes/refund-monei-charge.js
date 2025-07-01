// backend/routes/refund-monei-charge.js

const express = require('express');
const fetch   = require('node-fetch');
const router  = express.Router();

/**
 * POST /api/refund-monei-charge
 *
 * Body JSON:
 *   {
 *     chargeId: string,    // ID del cargo en Monei
 *     amount: number,      // importe en céntimos (ej: 2999 para 29.99€)
 *     currency?: string    // opcional, por defecto 'EUR'
 *   }
 *
 * Headers:
 *   x-zendesk-secret: <tu_shared_secret>
 *   Authorization:    Bearer <monei_api_key>
 */
router.post('/', async (req, res) => {
  // 1) Validar secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Validar Authorization header
  const auth = req.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(400).json({ error: 'Falta header Authorization: Bearer <monei_api_key>' });
  }

  const { chargeId, amount, currency = 'EUR' } = req.body;
  if (!chargeId || typeof amount !== 'number') {
    return res.status(400).json({ error: 'Debe enviar chargeId y amount (number)' });
  }

  try {
    // 3) Llamada a la API REST de Monei para crear el refund
    const url = `https://api.monei.com/v1/charges/${encodeURIComponent(chargeId)}/refunds`;
    const mRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount, currency })
    });

    const mJson = await mRes.json();
    if (!mRes.ok) {
      console.error('❌ Monei refund error:', mRes.status, mJson);
      return res.status(mRes.status).json({ error: mJson.error || JSON.stringify(mJson) });
    }

    // 4) Devolver datos del refund
    return res.json({ success: true, refund: mJson.data });
  } catch (err) {
    console.error('❌ Error refund Monei:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
