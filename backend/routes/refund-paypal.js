const express = require('express');
const paypal  = require('@paypal/checkout-server-sdk');
const router  = express.Router();

router.post('/', async (req, res) => {
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  const {
    transactionId,
    amount,
    currency,
    paypal_client_id: clientId,
    paypal_secret: clientSecret,
    paypal_mode = 'sandbox'
  } = req.body;

  if (!transactionId || !amount || !clientId || !clientSecret) {
    return res.status(400).json({ error: 'Falta transactionId, amount o credenciales de PayPal' });
  }

  try {
    const env = paypal_mode === 'live'
      ? new paypal.core.LiveEnvironment(clientId, clientSecret)
      : new paypal.core.SandboxEnvironment(clientId, clientSecret);

    const client = new paypal.core.PayPalHttpClient(env);

    const request = new paypal.payments.CapturesRefundRequest(transactionId);
    request.requestBody({
      amount: {
        value: amount,
        currency_code: currency || 'EUR'
      }
    });

    const response = await client.execute(request);

    return res.json({
      success: true,
      refund: {
        id: response.result.id,
        amount: response.result.amount?.value,
        status: response.result.status
      }
    });
  } catch (err) {
    console.error('⚠️ Error en refund-paypal:', err);
    const message = err?.message || 'Error inesperado';
    return res.status(err?.statusCode || 500).json({ success: false, error: message });
  }
});

module.exports = router;