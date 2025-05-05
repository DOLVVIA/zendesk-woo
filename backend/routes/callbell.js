// backend/routes/callbell.js
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// 1) GET PLANTILLAS CALLBELL
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
// :contentReference[oaicite:0]{index=0}

// 2) ENVIAR MENSAJE CALLBELL
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
// :contentReference[oaicite:1]{index=1}

module.exports = router;
