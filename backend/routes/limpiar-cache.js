const express = require('express');
const NodeCache = require('node-cache');
const router = express.Router();

// Reutilizamos el mismo caché
const cache = require('../cache');

router.post('/', (req, res) => {
  const secret = req.get('x-zendesk-secret');

  // Logs de depuración
  console.log('🔐 Recibido en x-zendesk-secret:', secret);
  console.log('🔐 Esperado desde env:', process.env.ZENDESK_SHARED_SECRET);

  if (!secret || secret !== process.env.ZENDESK_SHARED_SECRET) {
    console.warn('❌ x-zendesk-secret inválido');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  cache.flushAll(); // 🔥 Limpia toda la caché
  console.log('🧹 Caché vaciada correctamente');
  res.json({ success: true, message: 'Caché limpiada correctamente.' });
});

module.exports = router;
