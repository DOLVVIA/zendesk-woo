const express = require('express');
const router  = express.Router();
const fetch   = require('node-fetch');
const CALLBELL_API = 'https://api.callbell.eu/v1';

// Middleware para validar secreto y leer token+channel_uuid desde env
function authCallbell(req, res, next) {
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }
  const token   = process.env.CALLBELL_TOKEN;
  const channel = process.env.CALLBELL_CHANNEL_UUID;
  if (!token || !channel) {
    return res.status(500).json({ error: 'Falta configurar CALLBELL_TOKEN o CALLBELL_CHANNEL_UUID' });
  }
  req.cbToken      = token;
  req.cbChannelUid = channel;
  next();
}

// GET /api/callbell/templates
router.get('/templates', authCallbell, async (req, res) => {
  try {
    const url = `${CALLBELL_API}/templates?channel_uuid=${req.cbChannelUid}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${req.cbToken}` }
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(resp.status).json({ error: txt });
    }
    const data = await resp.json();
    // vienen como data.templates
    res.json({ templates: data.templates });
  } catch (err) {
    console.error('Error fetching Callbell templates:', err);
    res.status(500).json({ error: 'Error al obtener plantillas' });
  }
});

// POST /api/callbell/send
router.post('/send', authCallbell, async (req, res) => {
  const { templateId, orderNumber, phone } = req.body;
  if (!templateId || !orderNumber || !phone) {
    return res.status(400).json({ error: 'Faltan templateId, orderNumber o phone' });
  }

  try {
    // 1) Llamada a la API de Callbell
    const resp = await fetch(`${CALLBELL_API}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        Authorization:     `Bearer ${req.cbToken}`
      },
      body: JSON.stringify({
        channel_uuid: req.cbChannelUid,
        to:           phone,
        templateId,
        variables:    { orderNumber }
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
