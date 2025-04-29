const express = require('express');
const router = express.Router();
const { obtenerPedidosPorEmail } = require('../utils/woocommerce');

router.get('/buscar-pedidos', async (req, res) => {
  const { email } = req.query;
  console.log("📩 Email recibido en backend:", email); // Log de entrada

  if (!email) {
    return res.status(400).json({ error: 'El parámetro email es obligatorio.' });
  }

  try {
    console.log("🔍 Llamando a obtenerPedidosPorEmail...");
    const pedidos = await obtenerPedidosPorEmail(email);
    console.log("📦 Pedidos obtenidos:", pedidos); // Resultado

    res.json({ email, pedidos });
  } catch (error) {
    console.error("🧨 ERROR en la ruta /buscar-pedidos:", error.message || error);
    res.status(500).json({ error: 'Error al obtener los pedidos reales.' });
  }
});

module.exports = router;
