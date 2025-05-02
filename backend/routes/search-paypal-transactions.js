// backend/routes/search-paypal-transactions.js
const express = require('express');
const paypal  = require('@paypal/checkout-server-sdk');
const router  = express.Router();

function createPayPalClient() {
  const id     = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  const mode   = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
  const env = mode === 'live'
    ? new paypal.core.LiveEnvironment(id, secret)
    : new paypal.core.SandboxEnvironment(id, secret);
  return new paypal.core.PayPalHttpClient(env);
}

router.get('/', async (req, res) => {
  // 1) Autorización Zendesk
  const zk = req.get('x-zendesk-secret');
  if (!zk || zk !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Zendesk secret inválido' });
  }

  // 2) Leer email y opcionalmente fechas
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ error: 'Falta parámetro email' });
  }
  // Por defecto última semana:
  const end   = new Date().toISOString();
  const start = new Date(Date.now() - 7*24*3600*1000).toISOString();

  try {
    const client = createPayPalClient();
    // 3) Llamada al Reporting API
    const reqRpt = new paypal.http.HttpRequest(
      `/v1/reporting/transactions?start_date=${start}&end_date=${end}&fields=all&page_size=50`
    );
    reqRpt.headers['Content-Type'] = 'application/json';
    const rptRes = await client.execute(reqRpt);
    const allTx = rptRes.result.transaction_details || [];

    // 4) Filtrar por email
    const matches = allTx.filter(tx =>
      tx.payer_info?.email_address === email
    );
    if (!matches.length) {
      return res.status(404).json({ error: 'No hay transacciones para ese email.' });
    }

    // 5) Mapear sólo los campos que necesitamos
    const out = matches.map(tx => ({
      id:       tx.transaction_info.transaction_id,
      status:   tx.transaction_info.transaction_status,
      amount:   tx.transaction_info.transaction_amount,
      date:     tx.transaction_info.transaction_initiation_date
    }));

    return res.json(out);

  } catch (err) {
    console.error('❌ Error Reporting API:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
