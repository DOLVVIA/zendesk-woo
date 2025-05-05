// backend/routes/callbell.js
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// Middleware para validar x-zendesk-secret
function validateZendeskSecret(req, res, next) {
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }
  next();
}

// Aplica la validación a todas las rutas de este router
router.use(validateZendeskSecret);

// 1) GET todas las plantillas de Callbell
router.get('/plantillas', async (req, res) => {
  try {
    const response = await fetch('https://api.callbell.eu/v1/templates', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CALLBELL_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (error) {
    console.error('Error al obtener plantillas:', error);
    res.status(500).json({ error: 'Error interno al obtener plantillas' });
  }
});

// 2) POST para enviar un mensaje con plantilla
router.post('/enviar-mensaje', async (req, res) => {
  const { to, template_uuid, template_values } = req.body;
  try {
    const response = await fetch('https://api.callbell.eu/v1/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CALLBELL_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to,
        from: 'whatsapp',
        type: 'template',
        channel_uuid: process.env.CALLBELL_CHANNEL_UUID,
        template_uuid,
        template_values
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({ error: 'Error interno al enviar mensaje' });
  }
});

module.exports = router;
