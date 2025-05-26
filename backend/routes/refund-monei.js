// backend/routes/refund-monei.js

const express = require('express');
const fetch   = require('node-fetch');
const aws4    = require('aws4');

const router = express.Router();

// POST /api/refund-monei
// Body JSON: { orderId, chargeId, amount, monei_api_key }
router.post('/', async (req, res) => {
  // 1) Validar cabecera
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'x-zendesk-secret inválido' });
  }

  // 2) Leer y validar campos
  const { monei_api_key, orderId, chargeId, amount } = req.body;
  if (!orderId || !chargeId || amount == null) {
    return res.status(400).json({ error: 'Falta orderId, chargeId o amount.' });
  }
  if (!monei_api_key) {
    return res.status(400).json({ error: 'Falta monei_api_key.' });
  }

  try {
    // 3) Montar los parámetros de aws4
    const HOST = 'api.monei.com';
    const PATH = `/v1/charges/${chargeId}/refunds`;
    const BODY = JSON.stringify({ amount });

    const awsOpts = {
      host:    HOST,
      path:    PATH,
      service: 'execute-api',
      region:  'us-east-1',         // ← REGION CORRECTA PARA API.GATEWAY de MONEI
      method:  'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: BODY
    };

    // 4) Firmar la petición
    aws4.sign(awsOpts, {
      accessKeyId:     monei_api_key,
      secretAccessKey: ''           // MONEI sólo usa API key como Access Key, la parte secreta queda vacía
    });

    // 5) Enviar la petición a MONEI
    const response = await fetch(`https://${HOST}${PATH}`, {
      method:  awsOpts.method,
      headers: awsOpts.headers,
      body:    BODY
    });
    const json = await response.json();

    if (!response.ok) {
      console.error('❌ Error MONEI refund:', json);
      return res
        .status(response.status)
        .json({ success: false, error: json.message || 'Error desconocido' });
    }

    // 6) Devolver resultado al frontend
    return res.json({ success: true, refund: json });

  } catch (err) {
    console.error('❌ Error refund-monei:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
