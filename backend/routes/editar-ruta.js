const express = require('express');
const router = express.Router();
const { api } = require('../utils/woocommerce');

router.put('/editar-direccion', async (req, res) => {
  console.log('📥 /api/editar-direccion recibe body:', req.body);

  // Leemos el order_id en vez de email
  const { order_id } = req.query;
  const { billing, shipping } = req.body;

  try {
    // Actualiza la dirección directamente en la orden (invitados o registrados)
    const resp = await api.put(`orders/${order_id}`, { billing, shipping });
    res.status(200).json({
      message: 'Dirección del pedido actualizada',
      data: resp.data
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Error al actualizar la dirección del pedido' });
  }
});

module.exports = router;