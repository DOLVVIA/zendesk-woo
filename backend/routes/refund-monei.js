// routes/refund-monei.js

const express = require('express');
const fetch   = require('node-fetch');
const aws4    = require('aws4');

const router = express.Router();

// POST /api/refund-monei
// Body JSON: { orderId, chargeId, amount, monei_api_key, monei_api_secret }
router.post('/', async (req, res) => {
  // 1) Validar x-zendesk-secret
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'x-zendesk-secret inválido' });
  }

  // 2) Leer campos
  const {
    orderId,
    chargeId,
    amount,
    monei_api_key,
    monei_api_secret
  } = req.body;

  if (!orderId || !chargeId || amount == null) {
    return res.status(400).json({ error: 'Falta orderId, chargeId o amount.' });
  }
  if (!monei_api_key || !monei_api_secret) {
    return res.status(400).json({ error: 'Falta monei_api_key o monei_api_secret.' });
  }

  try {
    // 3) Preparamos la request firmada (AWS SigV4)
    const REGION  = 'eu-west-1';
    const SERVICE = 'execute-api';
    const HOST    = 'api.monei.com';
    const PATH    = `/v1/charges/${chargeId}/refunds`;

    const body = JSON.stringify({ amount });

    // Ponemos el x-monei-api-key *antes* de firmar
    const awsOpts = {
      host:    HOST,
      path:    PATH,
      service: SERVICE,
      region:  REGION,
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'x-monei-api-key':  monei_api_key,
      },
      body
    };

    // Firmamos con aws4 usando tanto accessKeyId como secretAccessKey
    aws4.sign(awsOpts, {
      accessKeyId:     monei_api_key,
      secretAccessKey: monei_api_secret
    });

    // 4) Hacemos la llamada a MONEI
    const response = await fetch(`https://${HOST}${PATH}`, {
      method:  awsOpts.method,
      headers: awsOpts.headers,
      body:    awsOpts.body
    });

    const json = await response.json();
    if (!response.ok) {
      console.error('❌ Error MONEI refund:', json);
      return res
        .status(response.status)
        .json({ success: false, error: json.message || 'Error desconocido' });
    }

    // 5) Devolvemos el refund a Zendesk
    res.json({ success: true, refund: json });

  } catch (err) {
    console.error('❌ Excepción en refund-monei:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
