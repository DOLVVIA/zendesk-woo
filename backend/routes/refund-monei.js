// backend/routes/refund-monei.js
const express = require('express');
const aws4    = require('aws4');
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
    // 3) Construir la URL de MONEI
    const url = new URL(`https://api.monei.com/v1/charges/${chargeId}/refunds`);

    // 4) Preparamos la request para aws4.sign
    const opts = {
      host:    url.host,
      path:    url.pathname,
      method:  'POST',
      service: 'execute-api',       // AWS API Gateway usa este servicio
      region:  'eu-west-1',         // región fija para MONEI
      headers: {
        'Content-Type':  'application/json',
        'Authorization': monei_api_key    // <— aquí, igual que en GraphQL
      },
      body: JSON.stringify({ amount })
    };

    // 5) Firmamos con AWS SigV4 (añade X-Amz-* y Signature)
    aws4.sign(opts, {
      accessKeyId:     process.env.MONEI_API_ACCESS_KEY,
      secretAccessKey: process.env.MONEI_API_SECRET_KEY
    });

    // 6) Ejecutamos el fetch con los headers ya firmados
    const response = await fetch(url.href, {
      method:  opts.method,
      headers: opts.headers,
      body:    opts.body
    });

    const json = await response.json();
    if (!response.ok) {
      console.error('❌ Error MONEI refund:', json);
      return res
        .status(response.status)
        .json({ success: false, error: json.message || 'Error desconocido' });
    }

    // 7) Devolvemos el resultado al frontend
    return res.json({ success: true, refund: json });

  } catch (err) {
    console.error('❌ Error refund-monei:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
