const express = require('express');
const router = express.Router();
const cache = require('../cache');

router.post('/', (req, res) => {
  console.log('📥 LLEGÓ A /limpiar-cache');

  const secret = req.get('x-zendesk-secret');
  console.log('🔐 RECIBIDO:', secret);
  console.log('🔐 ENV ESPERADO:', process.env.ZENDESK_SHARED_SECRET);

  if (!secret || secret !== process.env.ZENDESK_SHARED_SECRET) {
    console.warn('❌ x-zendesk-secret inválido');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  cache.flushAll();
  console.log('🧹 Caché vaciada correctamente');
  res.json({ success: true, message: 'Caché limpiada correctamente.' });
});

module.exports = router;
