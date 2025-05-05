// backend/routes/callbell.js
const express = require('express');
const fetch   = require('node-fetch');
const router  = express.Router();
const API     = 'https://api.callbell.eu/v1';

// Middleware para validar x-zendesk-secret y leer token+channel_uuid de headers
function authCallbell(req, res, next) {
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }
  const token   = req.get('x-callbell-token');
  const channel = req.get('x-callbell-channel-uuid');
  if (!token || !channel) {
    return res.status(400).json({ error: 'Falta x-callbell-token o x-callbell-channel-uuid' });
  }
  req.cbToken      = token;
  req.cbChannelUid = channel;
  next();
}

// GET /api/callbell/templates
router.get('/templates', authCallbell, async (req, res) => {
  try {
    const url = `${API}/templates?channel_uuid=${req.cbChannelUid}`;
    console.log('[Callbell] GET Templates →', url);
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${req.cbToken}` }
    });
    if (!resp.ok) {
      const txt = await resp.text();
      console.error('[Callbell] templates error:', txt);
      return res.status(resp.status).json({ error: txt });
    }
    const data = await resp.json();
    return res.json({ templates: data.templates });
  } catch (err) {
    console.error('[Callbell] Exception fetching templates:', err);
    return res.status(500).json({ error: 'Error al obtener plantillas' });
  }
});

// POST /api/callbell/send
router.post('/send', authCallbell, async (req, res) => {
  // Línea añadida para debugging
  console.log('[Callbell] Request body →', req.body);

  // Destructure body usando snake_case
  const { template_id, orderNumber, phone } = req.body;

  if (!template_id || !orderNumber || !phone) {
    return res.status(400).json({ error: 'Faltan template_id, orderNumber o phone' });
  }

  try {
    // URL correcta incluyendo el channel_uuid
    const url = `${API}/channels/${req.cbChannelUid}/messages`;

    // Payload sin channel_uuid
    const payload = {
      to:           phone,
      template_id,
      variables:    { orderNumber }
    };

    console.log('[Callbell] Sending message →', url, payload);

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${req.cbToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error('[Callbell] send error:', txt);
      return res.status(resp.status).json({ error: txt });
    }
    const data = await resp.json();
    return res.json(data);
  } catch (err) {
    console.error('[Callbell] Exception sending message:', err);
    return res.status(500).json({ error: 'Error interno al enviar mensaje' });
  }
});

module.exports = router;
