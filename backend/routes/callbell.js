const express = require('express');
const router  = express.Router();
const fetch   = require('node-fetch');
const CALLBELL_API = 'https://api.callbell.eu/v1';

// Middleware para validar x-zendesk-secret y leer token desde header
function authCallbell(req, res, next) {
  // 1) Comprueba el secreto de Zendesk
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }
  // 2) Lee el token de Callbell enviado por el front
  const token = req.get('x-callbell-token');
  if (!token) {
    return res.status(400).json({ error: 'Falta header x-callbell-token' });
  }
  req.cbToken = token;
  next();
}

// GET /api/callbell/templates
router.get('/templates', authCallbell, async (req, res) => {
  try {
    const resp = await fetch(`${CALLBELL_API}/templates`, {
      headers: { Authorization: `Bearer ${req.cbToken}` }
    });
    if (!resp.ok) {
      return res.status(resp.status).json({ error: await resp.text() });
    }
    const data = await resp.json();
    res.json({ templates: data.templates });
  } catch (err) {
    console.error('Error fetching Callbell templates:', err);
    res.status(500).json({ error: 'Error al obtener plantillas' });
  }
});

// POST /api/callbell/send
router.post('/send', authCallbell, async (req, res) => {
  const { templateId, orderNumber, phone } = req.body;

  // 1) Validaciones básicas
  if (!templateId) {
    return res.status(400).json({ error: 'Falta templateId' });
  }
  if (!orderNumber) {
    return res.status(400).json({ error: 'Falta orderNumber' });
  }
  if (!phone) {
    return res.status(400).json({ error: 'Falta número de teléfono' });
  }

  try {
    // 2) Envía el mensaje a través de la API de Callbell
    const resp = await fetch(`${CALLBELL_API}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${req.cbToken}`
      },
      body: JSON.stringify({
        to:         phone,
        templateId,
        variables: { orderNumber }
      })
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('Error sending Callbell message:', text);
      return res.status(resp.status).json({ error: text });
    }

    const data = await resp.json();
    res.json(data);

  } catch (err) {
    console.error('Error en /api/callbell/send:', err);
    res.status(500).json({ error: 'Error interno al enviar mensaje' });
  }
});

module.exports = router;
