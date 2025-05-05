// backend/routes/callbell.js
console.log('🔔 [Callbell] Router cargando módulo');

const express = require('express');
const router  = express.Router();
const fetch   = require('node-fetch');
const CALLBELL_API = 'https://api.callbell.eu/v1';

// Middleware para validar x-zendesk-secret y leer token desde header
function authCallbell(req, res, next) {
  console.log(`🔔 [Callbell] authCallbell: ${req.method} ${req.path}`);
  const incomingSecret = req.get('x-zendesk-secret');
  console.log(`    → x-zendesk-secret: ${incomingSecret ? 'Provided' : 'Missing'}`);
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    console.log('    ❌ Zendesk secret inválido');
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }
  const token = req.get('x-callbell-token');
  console.log(`    → x-callbell-token: ${token ? 'Provided' : 'Missing'}`);
  if (!token) {
    console.log('    ❌ Falta header x-callbell-token');
    return res.status(400).json({ error: 'Falta header x-callbell-token' });
  }
  req.cbToken = token;
  next();
}

// GET /api/callbell/templates
router.get('/templates', authCallbell, async (req, res) => {
  console.log(`🔔 [Callbell] GET /templates invocado`);
  try {
    const resp = await fetch(`${CALLBELL_API}/templates`, {
      headers: { Authorization: `Bearer ${req.cbToken}` }
    });
    console.log(`    → Llamada a Callbell /templates, status ${resp.status}`);
    if (!resp.ok) {
      const txt = await resp.text();
      console.log('    ❌ Error en Callbell /templates:', txt);
      return res.status(resp.status).json({ error: txt });
    }
    const data = await resp.json();
    console.log(`    → Plantillas recibidas: ${data.templates.length}`);
    res.json({ templates: data.templates });
  } catch (err) {
    console.error('    ❌ Exception fetching Callbell templates:', err);
    res.status(500).json({ error: 'Error al obtener plantillas' });
  }
});

// POST /api/callbell/send
router.post('/send', authCallbell, async (req, res) => {
  console.log(`🔔 [Callbell] POST /send invocado`);
  console.log(`    → Body recibido:`, req.body);
  const { templateId, orderNumber, phone } = req.body;

  if (!templateId) {
    console.log('    ❌ Falta templateId');
    return res.status(400).json({ error: 'Falta templateId' });
  }
  if (!orderNumber) {
    console.log('    ❌ Falta orderNumber');
    return res.status(400).json({ error: 'Falta orderNumber' });
  }
  if (!phone) {
    console.log('    ❌ Falta número de teléfono');
    return res.status(400).json({ error: 'Falta número de teléfono' });
  }

  try {
    console.log(`    → Enviando mensaje a ${phone} usando plantilla ${templateId}`);
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
    console.log(`    → Llamada a Callbell /messages, status ${resp.status}`);
    if (!resp.ok) {
      const text = await resp.text();
      console.error('    ❌ Error sending Callbell message:', text);
      return res.status(resp.status).json({ error: text });
    }
    const data = await resp.json();
    console.log('    → Mensaje enviado, respuesta Callbell:', data);
    res.json(data);
  } catch (err) {
    console.error('    ❌ Exception en /api/callbell/send:', err);
    res.status(500).json({ error: 'Error interno al enviar mensaje' });
  }
});

module.exports = router;
