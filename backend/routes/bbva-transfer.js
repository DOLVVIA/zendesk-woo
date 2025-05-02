// backend/routes/bbva-transfer.js

const express = require('express');
const fetch   = require('node-fetch');       // npm install node-fetch@2
const router  = express.Router();
const crypto  = require('crypto');

const ASPSP    = 'BBVA';
const BASE_URL = process.env.BBVA_BASE_URL;   // e.g. https://api.apis-i.redsys.es/psd2/xs2a/nodos

// POST /api/bbva-transfer
// Body: { creditorIban, creditorName, amount, remittanceInfo }
router.post('/', async (req, res) => {
  // 1) Seguridad
  const secret = req.get('x-zendesk-secret');
  if (!secret || secret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  }

  // 2) Leer payload
  const { creditorIban, creditorName, amount, remittanceInfo } = req.body;
  if (!creditorIban || !creditorName || !amount) {
    return res.status(400).json({ success: false, error: 'MISSING_DATA' });
  }

  // 3) Validación de límite por transferencia
  if (amount > 100) {
    return res.status(400).json({
      success: false,
      error: 'LIMIT_EXCEEDED',
      message: 'No puedes enviar más de 100 € por transferencia.'
    });
  }

  try {
    // 4) Obtener token (client_credentials)
    const creds = Buffer.from(
      `${process.env.BBVA_CLIENT_ID}:${process.env.BBVA_CLIENT_SECRET}`
    ).toString('base64');

    const tokRes = await fetch(process.env.BBVA_OAUTH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type':  'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials&scope=payments'
    });
    const tokJson = await tokRes.json();
    if (!tokRes.ok) throw new Error(tokJson.error || JSON.stringify(tokJson));
    const accessToken = tokJson.access_token;

    // 5) Crear el payload SEPA
    const idempotencyKey = req.get('X-Request-ID') || crypto.randomUUID();
    const body = {
      instructedAmount: {
        currency: 'EUR',
        amount:   amount.toFixed(2)
      },
      debtorAccount: {
        iban: process.env.BBVA_DEBTOR_IBAN
      },
      creditorAccount: {
        iban: creditorIban
      },
      creditorName,
      remittanceInformationUnstructured: remittanceInfo || ''
    };

    // 6) Llamada al API
    const payRes = await fetch(
      `${BASE_URL}/${ASPSP}/v1.1/payments/sepa-credit-transfers`,
      {
        method: 'POST',
        headers: {
          'Authorization':    `Bearer ${accessToken}`,
          'Content-Type':     'application/json',
          'X-Request-ID':     idempotencyKey
        },
        body: JSON.stringify(body)
      }
    );
    const payJson = await payRes.json();
    if (!payRes.ok) {
      throw new Error(
        payJson.error?.message ||
        JSON.stringify(payJson)
      );
    }

    // 7) Responder éxito
    return res.json({ success: true, payment: payJson });
  }
  catch (err) {
    console.error('❌ Error BBVA transfer:', err);
    return res.status(500).json({
      success: false,
      error: 'TRANSFER_FAILED',
      message: err.message
    });
  }
});

module.exports = router;
