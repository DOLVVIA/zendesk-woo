// backend/routes/callbell.js
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// 1) Validar cabecera x-zendesk-secret (mismo que cambiar-estado)
router.use((req, res, next) => {
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }
  next();
});

// 2) GET /api/callbell/plantillas
//    Igual que en cambiar-estado lee de req.query, aquí no necesitas query
router.get('/plantillas', async (req, res) => {
  try {
    const response = await fetch('https://api.callbell.eu/v1/templates', {
      headers: {
        'Authorization': `Bearer ${process.env.CALLBELL_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    // Devolvemos un array (o { templates: [...] } si quieres)
    res.json(data.templates || data);
  } catch (err) {
    console.error('Error al obtener plantillas:', err);
    res.status(500).json({ error: 'Error interno al obtener plantillas' });
  }
});

// 3) POST /api/callbell/enviar-mensaje
router.post('/enviar-mensaje', async (req, res) => {
  const { to, template_uuid, template_values } = req.body;
  if (!to || !template_uuid) {
    return res.status(400).json({ error: 'Falta "to" o "template_uuid" en body' });
  }
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
        template_values: template_values || []
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    console.error('Error al enviar mensaje:', err);
    res.status(500).json({ error: 'Error interno al enviar mensaje' });
  }
});

module.exports = router;
