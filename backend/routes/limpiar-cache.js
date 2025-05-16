const express = require('express');
const NodeCache = require('node-cache');
const router = express.Router();

// Reutilizamos el mismo caché
const cache = require('../cache'); // <- ahora te explico este detalle

router.post('/', (req, res) => {
  const secret = req.get('x-zendesk-secret');
  if (!secret || secret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  cache.flushAll(); // 🔥 Limpia toda la caché
  res.json({ success: true, message: 'Caché limpiada correctamente.' });
});

module.exports = router;
