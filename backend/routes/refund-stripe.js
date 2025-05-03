const express = require('express');
const Stripe = require('stripe');
const router = express.Router();

// Ahora atendemos POST /api/refund-stripe   <— ojo al cambio aquí
router.post('/', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros del body
  const { chargeId, amount, stripe_secret_key } = req.body;

  // 3) Validaciones básicas
  if (!chargeId || amount == null) {
    return res.status(400).json({ error: 'Falta chargeId o amount en el body.' });
  }
  if (!stripe_secret_key) {
    return res.status(400).json({
      error: 'Falta stripe_secret_key en el body para autenticar con Stripe.'
    });
  }

  try {
    // 4) Inicializar Stripe dinámicamente
    const stripe = new Stripe(stripe_secret_key, {
      apiVersion: '2022-11-15'
    });

    // 5) Crear el reembolso
    const refund = await stripe.refunds.create({
      charge: chargeId,
      amount   // en céntimos
    });

    // 6) Devolver resultado
    res.json({ success: true, refund });
  } catch (err) {
    console.error('Error al procesar refund Stripe:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
