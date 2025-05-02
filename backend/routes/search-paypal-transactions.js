// backend/routes/search-paypal-transactions.js
const express = require('express');
const paypal  = require('@paypal/checkout-server-sdk');
const router  = express.Router();

router.get('/', async (req, res) => {
  // 1) Seguridad: validar header x-zendesk-secret
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer credenciales y modo desde la query
  const clientId     = req.query.paypal_client_id;
  const clientSecret = req.query.paypal_secret;
  const mode         = (req.query.paypal_mode || 'live').toLowerCase();

  if (!clientId || !clientSecret) {
    return res
      .status(400)
      .json({ error: 'Faltan paypal_client_id o paypal_secret en la query.' });
  }

  // 3) Leer parámetro email (obligatorio)
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ error: 'Falta parámetro email en la query.' });
  }

  // 4) Inicializar PayPal SDK “al vuelo”
  const env = mode === 'sandbox'
    ? new paypal.core.SandboxEnvironment(clientId, clientSecret)
    : new paypal.core.LiveEnvironment(   clientId, clientSecret);
  const client = new paypal.core.PayPalHttpClient(env);

  // 5) Fechas para el Reporting API (por defecto última semana)
  const end   = encodeURIComponent(req.query.end_date   || new Date().toISOString());
  const start = encodeURIComponent(req.query.start_date || new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());

  try {
    // 6) Llamada al Reporting API
    const reqRpt = new paypal.http.HttpRequest(
      `/v1/reporting/transactions?start_date=${start}&end_date=${end}&fields=all&page_size=50`
    );
    reqRpt.headers['Content-Type'] = 'application/json';
    const rptRes = await client.execute(reqRpt);

    const allTx = rptRes.result.transaction_details || [];

    // 7) Filtrar por email del pagador
    const matches = allTx.filter(tx =>
      tx.payer_info?.email_address === email
    );

    // 8) Mapear sólo los campos necesarios
    const out = matches.map(tx => ({
      id:     tx.transaction_info.transaction_id,
      status: tx.transaction_info.transaction_status,
      amount: tx.transaction_info.transaction_amount,
      date:   tx.transaction_info.transaction_initiation_date
    }));

    return res.json(out);

  } catch (err) {
    console.error('❌ Error Reporting API:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
});

module.exports = router;
