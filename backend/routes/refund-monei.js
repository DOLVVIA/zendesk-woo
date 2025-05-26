// backend/routes/refund-monei.js
const express = require('express');
const fetch   = require('node-fetch');
const aws4    = require('aws4');
const url     = require('url');

const router = express.Router();

// POST /api/refund-monei
router.post('/', async (req, res) => {
  // 1) Validar x-zendesk-secret
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'x-zendesk-secret inválido' });
  }

  // 2) Leer campos
  const { monei_api_key, orderId, chargeId, amount } = req.body;
  if (!orderId || !chargeId || amount == null) {
    return res.status(400).json({ error: 'Falta orderId, chargeId o amount.' });
  }
  if (!monei_api_key) {
    return res.status(400).json({ error: 'Falta monei_api_key.' });
  }

  try {
    // 3) Preparamos la petición SigV4
    const endpoint = `https://api.monei.com/v1/charges/${chargeId}/refunds`;
    const { hostname, pathname } = url.parse(endpoint);

    const opts = {
      host: hostname,
      path: pathname,
      service: 'execute-api',
      region: 'eu-central-1',       // según documentación de MONEI
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    };

    // 4) Firmamos con aws4 (la API Key de MONEI actúa como accessKeyId,
    //    no necesitas secretAccessKey — déjalo vacío).
    aws4.sign(opts, {
      accessKeyId:     monei_api_key,
      secretAccessKey: ''
    });

    // 5) Ejecutamos el fetch ya con todos los headers SigV4
    const response = await fetch(endpoint, {
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

    // 6) Devolvemos al frontend
    return res.json({ success: true, refund: json });

  } catch (err) {
    console.error('❌ Error refund-monei:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
