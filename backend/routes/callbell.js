// backend/routes/callbell.js

require('dotenv').config();
const express       = require('express');
const router        = express.Router();
const fetch         = require('node-fetch');
const CALLBELL_API  = 'https://api.callbell.eu/v1';

// Middleware para validar x-zendesk-secret y leer token/uuid desde env
function authCallbell(req, res, next) {
  // 1) Comprueba el secreto de Zendesk
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Lee el token de Callbell
  const cbToken = process.env.CALLBELL_TOKEN;
  if (!cbToken) {
    return res.status(500).json({ error: 'Falta configurar CALLBELL_TOKEN' });
  }
  req.cbToken = cbToken;

  // 3) Lee el UUID de canal
  const cbChannel = process.env.CALLBELL_CHANNEL_UUID;
  if (!cbChannel) {
    return res.status(500).json({ error: 'Falta configurar CALLBELL_CHANNEL_UUID' });
  }
  req.cbChannel = cbChannel;

  next();
}

// GET /api/callbell/templates
router.get('/templates', authCallbell, async (req, res) => {
  try {
    const resp = await fetch(`${CALLBELL_API}/templates`, {
      headers: { Authorization: `Bearer ${req.cbToken}` }
    });
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: text });
    }
    const { templates } = await resp.json();
    res.json({ templates });
  } catch (err) {
    console.error('Error fetching Callbell templates:', err);
    res.status(500).json({ error: 'Error al obtener plantillas' });
  }
});

// POST /api/callbell/send
router.post('/send', authCallbell, async (req, res) => {
  const { templateId, orderNumber, phone } = req.body;

  // Validaciones
  if (!templateId)   return res.status(400).json({ error: 'Falta templateId' });
  if (!orderNumber)  return res.status(400).json({ error: 'Falta orderNumber' });
  if (!phone)        return res.status(400).json({ error: 'Falta número de teléfono' });

  try {
    console.log(`🔔 [Callbell] Enviando a canal=${req.cbChannel}, tel=${phone}, tpl=${templateId}`);
    const resp = await fetch(`${CALLBELL_API}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${req.cbToken}`
      },
      body: JSON.stringify({
        channelUuid: req.cbChannel,
        to:          phone,
        templateId,
        variables:   { orderNumber }
      })
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('❌ Error sending Callbell message:', text);
      return res.status(resp.status).json({ error: text });
    }

    const data = await resp.json();
    console.log('✅ Mensaje enviado:', data);
    res.json(data);

  } catch (err) {
    console.error('Error en /api/callbell/send:', err);
    res.status(500).json({ error: 'Error interno al enviar mensaje' });
  }
});

module.exports = router;
