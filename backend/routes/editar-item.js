// backend/routes/editar-item.js

const express = require('express');
const router = express.Router();
const { fetchOrderById, updateOrder } = require('../utils/woocommerce');

// PUT /api/editar-item?order_id=123&line_index=0&variation_id?&quantity=...&total?&price_incl_tax?&vat_rate?&woocommerce_url=...&consumer_key=...&consumer_secret=...
router.put('/', async (req, res) => {
  // 1) Validar cabecera x-zendesk-secret
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer parámetros de req.query
  const {
    order_id,
    line_index,
    variation_id,
    quantity,
    total,
    price_incl_tax,
    vat_rate,
    woocommerce_url,
    consumer_key,
    consumer_secret
  } = req.query;

  // 3) Validaciones básicas
  if (!order_id || line_index === undefined) {
    return res.status(400).json({ error: 'Faltan order_id o line_index en query.' });
  }
  if (quantity === undefined) {
    return res.status(400).json({ error: 'Falta quantity en query.' });
  }
  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({ error: 'Faltan parámetros de conexión. Incluye woocommerce_url, consumer_key y consumer_secret en query.' });
  }

  try {
    // 4) Traer pedido y guardar estado original
    const order = await fetchOrderById(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id
    );
    const originalStatus = order.status;

    // 5) Identificar la línea antigua
    const oldLine = order.line_items[line_index];
    if (!oldLine) {
      return res.status(400).json({ error: 'Índice de línea inválido.' });
    }

    // 6) Calcular precios excluye IVA e impuestos si se provee price_incl_tax y vat_rate
    let priceExcl = null;
    let subtotalExcl = null;
    let totalTax = null;
    let totalLine = null;

    if (price_incl_tax != null && vat_rate != null) {
      const incl = parseFloat(price_incl_tax);
      const rate = parseFloat(vat_rate) / 100;
      // precio sin IVA por unidad
      priceExcl = parseFloat((incl / (1 + rate)).toFixed(2));
      // IVA por unidad
      const taxPerUnit = parseFloat((incl - priceExcl).toFixed(2));
      // totales de línea
      subtotalExcl = parseFloat((priceExcl * Number(quantity)).toFixed(2));
      totalTax = parseFloat((taxPerUnit * Number(quantity)).toFixed(2));
      totalLine = parseFloat((subtotalExcl + totalTax).toFixed(2));
    } else if (total != null) {
      // antiguo flujo: total asumido como subtotal excl. IVA
      subtotalExcl = parseFloat(total);
      priceExcl = parseFloat((subtotalExcl / Number(quantity)).toFixed(2));
      totalLine = subtotalExcl;
      totalTax = parseFloat(oldLine.total_tax) || 0;
    } else {
      return res.status(400).json({ error: 'Falta total o price_incl_tax + vat_rate en query.' });
    }

    // 7) Construir la nueva línea con campos de precio e impuestos
    const newLine = {
      product_id: oldLine.product_id,
      quantity: Number(quantity),
      ...(variation_id != null ? { variation_id: Number(variation_id) } : {}),
      price: priceExcl.toString(),
      subtotal: subtotalExcl.toString(),
      total: totalLine.toString(),
      subtotal_tax: totalTax.toString(),
      total_tax: totalTax.toString(),
      taxes: [
        {
          id: oldLine.taxes?.[0]?.id || 0,
          total: totalTax.toString(),
          subtotal: totalTax.toString()
        }
      ]
    };

    // 8) Preparar array de actualizaciones
    const lineUpdates = [
      { id: oldLine.id, quantity: 0 }, // elimina la línea vieja
      newLine                           // añade la nueva
    ];

    // 9) Primera actualización: status 'pending' para forzar recálculo
    await updateOrder(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id,
      {
        status: 'pending',
        line_items: lineUpdates
      }
    );

    // 10) Segunda actualización: restaurar estado original y aplicar líneas
    const updated = await updateOrder(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id,
      {
        status: originalStatus,
        line_items: lineUpdates
      }
    );

    // 11) Devolver pedido actualizado
    res.json(updated);

  } catch (err) {
    console.error('Error al editar item del pedido:', err.response?.data || err.message);
    res.status(500).json({ error: 'No se pudo actualizar el artículo del pedido.' });
  }
});

module.exports = router;