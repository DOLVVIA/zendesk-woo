// backend/routes/callbell.js
const express = require('express');
const fetch   = require('node-fetch');
const router  = express.Router();
const API     = 'https://api.callbell.eu/v1';

// Middleware para validar x-zendesk-secret y leer token+channel_uuid de headers
function authCallbell(req, res, next) {
  // 1) Zendesk shared secret
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }
  // 2) Token de Callbell (del frontend)
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
  const { templateId, orderNumber, phone } = req.body;
  if (!templateId || !orderNumber || !phone) {
    return res.status(400).json({ error: 'Faltan templateId, orderNumber o phone' });
  }

  try {
    const payload = {
      channel_uuid: req.cbChannelUid,
      to:           phone,
      templateId,
      variables:    { orderNumber }
    };
    console.log('[Callbell] Sending message →', payload);
    const resp = await fetch(`${API}/messages`, {
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
