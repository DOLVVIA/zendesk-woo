const express = require('express');
const router = express.Router();
const paypal = require('@paypal/checkout-server-sdk');
const { authorizeZendesk } = require('../middleware/auth'); // tu middleware de validación

// Inicializa el cliente de PayPal usando las credenciales de entorno
function createPayPalClient() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_SECRET;
  // Para producción usa LiveEnvironment, para pruebas SandboxEnvironment
  const environment = new paypal.core.SandboxEnvironment(clientId, clientSecret);
  return new paypal.core.PayPalHttpClient(environment);
}

router.get('/', authorizeZendesk, async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'Falta el parámetro email' });
  }

  try {
    const client = createPayPalClient();
    // Buscar transacciones en los últimos 30 días (ajusta fechas según necesites)
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date().toISOString();

    const request = new paypal.reporting.TransactionsSearchRequest();
    request.queryParams({
      start_date: startDate,
      end_date:   endDate,
      payer_email: email,
      page_size: 20,
    });

    const response = await client.execute(request);
    // Devuelve la lista de transacciones
    res.json(response.result.transaction_details);
  } catch (err) {
    console.error('Error buscando transacciones PayPal:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
