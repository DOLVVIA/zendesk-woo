const express = require('express');
const fetch = require('node-fetch'); // npm install node-fetch@2
const router = express.Router();

router.get('/', async (req, res) => {
  // 1) Seguridad
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Parámetros
  const clientId = req.query.paypal_client_id;
  const clientSecret = req.query.paypal_secret;
  const email = (req.query.email || '').toLowerCase();
  const mode = req.query.paypal_mode === 'live' ? 'live' : 'sandbox';

  if (!clientId || !clientSecret || !email) {
    return res.status(400).json({
      error: 'Faltan paypal_client_id, paypal_secret o email en la query.'
    });
  }

  // 3) Base URL
  const baseUrl = mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  // 4) Autenticación
  let accessToken;
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(500).json({ error: tokenJson.error_description || tokenJson.error });
    }

    accessToken = tokenJson.access_token;
  } catch (e) {
    console.error('❌ Error autenticando con PayPal:', e);
    return res.status(500).json({ error: 'Error autenticando en PayPal.' });
  }

  // 5) Rango: últimos 90 días en bloques de 30
  const now = new Date();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const allTx = [];

  const dayMs = 24 * 60 * 60 * 1000;
  const chunkMs = 30 * dayMs;

  try {
    for (let start = new Date(ninetyDaysAgo); start < now; start = new Date(start.getTime() + chunkMs)) {
      const end = new Date(Math.min(start.getTime() + chunkMs - 1, now.getTime()));
      let page = 1;
      const pageSize = 50;

      while (true) {
        const url = new URL(`${baseUrl}/v1/reporting/transactions`);
        url.searchParams.set('start_date', start.toISOString());
        url.searchParams.set('end_date', end.toISOString());
        url.searchParams.set('fields', 'all');
        url.searchParams.set('page_size', pageSize);
        url.searchParams.set('page', page);

        const rptRes = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        const rptJson = await rptRes.json();
        if (!rptRes.ok) {
          throw new Error(rptJson.error_description || JSON.stringify(rptJson));
        }

        const txs = rptJson.transaction_details || [];
        allTx.push(...txs);

        if (txs.length < pageSize) break;
        page++;
      }
    }
  } catch (e) {
    console.error('❌ Error al listar transacciones:', e);
    return res.status(500).json({ error: 'Error consultando transacciones PayPal.' });
  }

  // 6) Separar pagos y reembolsos
  const pagos = [];
  const reembolsos = [];

  allTx.forEach(tx => {
    const code = tx.transaction_info?.transaction_event_code;
    const refId = tx.transaction_info?.paypal_reference_id;
    const payer = tx.payer_info?.email_address?.toLowerCase();

    if (!payer || payer !== email) return;

    if (code?.startsWith('T11')) {
      // Es un reembolso
      reembolsos.push({
        id: refId,
        amount: parseFloat(tx.transaction_info.transaction_amount.value)
      });
    } else {
      pagos.push(tx);
    }
  });

  // 7) Enriquecer pagos con info de reembolso
  const output = pagos.map(tx => {
    const id = tx.transaction_info.transaction_id;
    const match = reembolsos.find(r => r.id === id);
    const refunded = match?.amount || 0;

    return {
      id,
      status: tx.transaction_info.transaction_status,
      amount: {
        value: tx.transaction_info.transaction_amount.value,
        currency_code: tx.transaction_info.transaction_amount.currency_code
      },
      refunded_amount: refunded.toFixed(2),
      is_refunded: refunded > 0,
      date: tx.transaction_info.transaction_initiation_date
    };
  });

  res.json(output);
});

module.exports = router;
