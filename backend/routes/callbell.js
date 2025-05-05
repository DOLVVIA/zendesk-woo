const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

const CALLBELL_API = 'https://api.callbell.eu/v1';

// Middleware de autenticación con tu token de Callbell
function authCallbell(req, res, next) {
  const token = process.env.CALLBELL_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Falta configurar CALLBELL_TOKEN' });
  }
  req.cbToken = token;
  next();
}

// GET /api/callbell/templates
// Devuelve la lista de plantillas configuradas en Callbell
router.get('/templates', authCallbell, async (req, res) => {
  try {
    const resp = await fetch(`${CALLBELL_API}/templates`, {
      headers: {
        Authorization: `Bearer ${req.cbToken}`
      }
    });
    if (!resp.ok) {
      return res.status(resp.status).json({ error: await resp.text() });
    }
    const data = await resp.json();
    // data.templates es un array de { id, name, ... }
    res.json({ templates: data.templates });
  } catch (err) {
    console.error('Error fetching Callbell templates:', err);
    res.status(500).json({ error: 'Error al obtener plantillas' });
  }
});

// POST /api/callbell/send
// Body JSON: { templateId: string, orderNumber: number }
// Envia un mensaje usando la plantilla seleccionada
router.post('/send', authCallbell, async (req, res) => {
  const { templateId, orderNumber } = req.body;
  if (!templateId || !orderNumber) {
    return res.status(400).json({ error: 'Faltan templateId o orderNumber' });
  }

  try {
    // 1) Obtén el pedido para sacar el teléfono del cliente
    // (reemplaza esta parte con tu lógica de fetchOrderById si la tienes):
    const { fetchOrderById } = require('../utils/woocommerce');
    const order = await fetchOrderById(
      {
        woocommerce_url: req.body.woocommerce_url,
        consumer_key:    req.body.consumer_key,
        consumer_secret: req.body.consumer_secret
      },
      orderNumber
    );
    const phone = order.billing.phone;
    if (!phone) {
      return res.status(400).json({ error: 'El pedido no tiene teléfono' });
    }

    // 2) Llamada a la API de Callbell para enviar el mensaje
    const resp = await fetch(`${CALLBELL_API}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:   `Bearer ${req.cbToken}`
      },
      body: JSON.stringify({
        to: phone,
        templateId,
        variables: { orderNumber }
      })
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('Error sending Callbell message:', text);
      return res.status(500).json({ error: 'Error al enviar mensaje' });
    }
    const data = await resp.json();
    res.json(data);

  } catch (err) {
    console.error('Error en /api/callbell/send:', err);
    res.status(500).json({ error: 'Error interno al enviar mensaje' });
  }
});

module.exports = router;
