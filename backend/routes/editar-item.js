// backend/routes/editar-item.js

const express = require('express');
const router = express.Router();
const { fetchOrderById, updateOrder } = require('../utils/woocommerce');

// PUT /api/editar-item?order_id=123&line_index=0&variation_id?&quantity=...&price_incl_tax?&vat_rate?&woocommerce_url=...&consumer_key=...&consumer_secret=...
router.put('/', async (req, res) => {
  // 1) Seguridad
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Parámetros
  const {
    order_id,
    line_index,
    variation_id,
    quantity,
    price_incl_tax,
    vat_rate,
    woocommerce_url,
    consumer_key,
    consumer_secret
  } = req.query;

  // 3) Validaciones
  if (!order_id || line_index == null) {
    return res.status(400).json({ error: 'Faltan order_id o line_index.' });
  }
  if (!quantity) {
    return res.status(400).json({ error: 'Falta quantity.' });
  }
  if (price_incl_tax == null || vat_rate == null) {
    return res.status(400).json({ error: 'Falta price_incl_tax o vat_rate.' });
  }
  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({ error: 'Faltan credenciales WooCommerce.' });
  }

  try {
    // 4) Traer pedido y línea original
    const order = await fetchOrderById(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id
    );
    const originalStatus = order.status;
    const oldLine = order.line_items[ Number(line_index) ];
    if (!oldLine) {
      return res.status(400).json({ error: 'Índice de línea inválido.' });
    }

    // 5) Calcular precios (sin IVA + impuestos)
    const incl      = parseFloat(price_incl_tax);
    const rate      = parseFloat(vat_rate) / 100;
    const priceExcl = parseFloat((incl / (1 + rate)).toFixed(2));
    const taxUnit   = parseFloat((incl - priceExcl).toFixed(2));
    const qtyNum    = Number(quantity);
    const subtotal  = parseFloat((priceExcl * qtyNum).toFixed(2));
    const totalTax  = parseFloat((taxUnit * qtyNum).toFixed(2));
    const totalLine = parseFloat((subtotal + totalTax).toFixed(2));

    // 6) Construir la NUEVA línea (como hacías antes)
    const newLine = {
      product_id:   oldLine.product_id,
      quantity:     qtyNum,
      ...(variation_id ? { variation_id: Number(variation_id) } : {}),
      price:        priceExcl.toString(),
      subtotal:     subtotal.toString(),
      total:        totalLine.toString(),
      subtotal_tax: totalTax.toString(),
      total_tax:    totalTax.toString(),
      taxes: [
        {
          id:       oldLine.taxes?.[0]?.id || 0,
          total:    totalTax.toString(),
          subtotal: totalTax.toString()
        }
      ]
    };

    // 7) Línea de eliminación + línea nueva
    const lineUpdates = [
      { id: oldLine.id, quantity: 0 },
      newLine
    ];

    // 8) Paso a PENDING + actualizar líneas
    await updateOrder(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id,
      { status: 'pending', line_items: lineUpdates }
    );

    // 9) Restaurar estado original + volver a aplicar
    const updated = await updateOrder(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id,
      { status: originalStatus, line_items: lineUpdates }
    );

    // 10) Responder al cliente
    return res.json(updated);

  } catch (err) {
    console.error('Error al editar item del pedido:', err.response?.data || err.message);
    return res.status(500).json({ error: 'No se pudo actualizar el artículo.' });
  }
});

module.exports = router;
