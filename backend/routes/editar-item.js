// backend/routes/editar-item.js

const express = require('express');
const router = express.Router();
const { fetchOrderById, updateOrder } = require('../utils/woocommerce');

// PUT /api/editar-item?order_id=123&line_index=0&variation_id?&quantity=...&price_incl_tax?&vat_rate?&woocommerce_url=...&consumer_key=...&consumer_secret=...
router.put('/', async (req, res) => {
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

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

  // Validaciones
  if (!order_id || line_index == null) {
    return res.status(400).json({ error: 'Faltan order_id o line_index.' });
  }
  if (!quantity) {
    return res.status(400).json({ error: 'Falta quantity.' });
  }
  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({
      error: 'Faltan credenciales WooCommerce en query.'
    });
  }

  try {
    // 1) Traer pedido original
    const order = await fetchOrderById(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id
    );
    const originalStatus = order.status;

    // 2) Identificar la línea y su ID
    const oldLine = order.line_items[ Number(line_index) ];
    if (!oldLine) {
      return res.status(400).json({ error: 'Índice de línea inválido.' });
    }
    const itemId = oldLine.id;  // ID real de la línea dentro del pedido

    // 3) Calcular precios
    let priceExcl, subtotalExcl, totalTax, totalLine;
    if (price_incl_tax != null && vat_rate != null) {
      const incl = parseFloat(price_incl_tax);
      const rate = parseFloat(vat_rate) / 100;
      priceExcl   = parseFloat((incl / (1 + rate)).toFixed(2));
      const taxU   = parseFloat((incl - priceExcl).toFixed(2));
      subtotalExcl = parseFloat((priceExcl * quantity).toFixed(2));
      totalTax     = parseFloat((taxU * quantity).toFixed(2));
      totalLine    = parseFloat((subtotalExcl + totalTax).toFixed(2));
    } else {
      return res.status(400).json({
        error: 'Debes pasar price_incl_tax y vat_rate.'
      });
    }

    // 4) Construir objeto de actualización de línea in-place
    const updatedLine = {
      id:           itemId,
      product_id:   oldLine.product_id,
      quantity:     Number(quantity),
      ...(variation_id ? { variation_id: Number(variation_id) } : {}),
      price:        priceExcl.toString(),
      subtotal:     subtotalExcl.toString(),
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

    // 5) Forzar pendiente + aplicar el cambio
    await updateOrder(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id,
      {
        status:     'pending',
        line_items: [ updatedLine ]
      }
    );

    // 6) Restaurar estado original
    const updated = await updateOrder(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id,
      {
        status:     originalStatus,
        line_items: [ updatedLine ]
      }
    );

    // 7) Devolver resultado
    res.json(updated);

  } catch (err) {
    console.error('Error al editar item del pedido:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudo actualizar el artículo.' });
  }
});

module.exports = router;
