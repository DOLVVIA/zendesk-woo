// backend/routes/bbva-transfer.js
const express = require('express');
const fetch   = require('node-fetch');       // npm install node-fetch@2
const router  = express.Router();

const ASPSP    = 'BBVA';                      // Identificador de tu banco
const BASE_URL = process.env.BBVA_BASE_URL;   // ej. https://api.apis-i.redsys.es/psd2/xs2a/nodos

// POST /api/bbva-transfer
// Body: { creditorIban, creditorName, amount, remittanceInfo }
router.post('/', async (req, res) => {
  // 1) Seguridad
  const secret = req.get('x-zendesk-secret');
  if (!secret || secret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2) Leer payload
  const { creditorIban, creditorName, amount, remittanceInfo } = req.body;
  if (!creditorIban || !creditorName || !amount) {
    return res.status(400).json({ error: 'Faltan datos de la transferencia.' });
  }

  try {
    // 3) Token client_credentials
    const creds = Buffer.from(`${process.env.BBVA_CLIENT_ID}:${process.env.BBVA_CLIENT_SECRET}`).toString('base64');
    const tokRes = await fetch(`${process.env.BBVA_OAUTH_URL}`, {
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

    // 4) Preparar cuerpo de la orden SEPA
    const idempotencyKey = req.get('X-Request-ID') || require('crypto').randomUUID();
    const body = {
      instructedAmount: {
        currency: 'EUR',
        amount:   amount.toString()
      },
      debtorAccount: {        // tu cuenta de empresa, definida en ENV
        iban: process.env.BBVA_DEBTOR_IBAN
      },
      creditorAccount: {      // IBAN del cliente
        iban: creditorIban
      },
      creditorName: creditorName,
      remittanceInformationUnstructured: remittanceInfo || ''
    };

    // 5) Llamada al endpoint
    const payRes = await fetch(
      `${BASE_URL}/${ASPSP}/v1.1/payments/sepa-credit-transfers`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type':  'application/json',
          'X-Request-ID':  idempotencyKey
        },
        body: JSON.stringify(body)
      }
    );
    const payJson = await payRes.json();
    if (!payRes.ok) throw new Error(payJson.error || JSON.stringify(payJson));

    // 6) Éxito
    return res.json({
      success: true,
      payment: payJson
    });

  } catch (err) {
    console.error('❌ Error BBVA transfer:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
