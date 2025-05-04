// backend/routes/anadir-item.js

const express = require('express');
const router = express.Router();
const { fetchOrderById, updateOrder } = require('../utils/woocommerce');

// POST /api/anadir-item?order_id=XXX
// Body JSON:
// {
//   product_id:    number,
//   variation_id?: number,
//   quantity:      number,
//   price?:        string,  // precio unitario sin IVA, ej "19.99"
//   subtotal?:     string,  // subtotal sin IVA, ej "39.98"
//   total?:        string,  // total sin IVA, ej "39.98"
//   subtotal_tax?: string,  // imp. total, ej "7.99"
//   total_tax?:    string,  // imp. total, ej "7.99"
//   woocommerce_url: string,
//   consumer_key:    string,
//   consumer_secret: string
// }
router.post('/', async (req, res) => {
  // 1) Seguridad
  const incomingSecret = req.get('x-zendesk-secret');
  if (!incomingSecret || incomingSecret !== process.env.ZENDESK_SHARED_SECRET) {
    console.error('⛔ Seguridad: x-zendesk-secret inválido');
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }

  // 2) Leer params
  const { order_id } = req.query;
  const {
    product_id,
    variation_id,
    quantity,
    price,
    subtotal,
    total,
    subtotal_tax,
    total_tax,
    woocommerce_url,
    consumer_key,
    consumer_secret
  } = req.body;

  // 3) Validaciones
  if (!order_id) {
    console.error('❌ Faltó order_id en query.');
    return res.status(400).json({ error: 'Falta order_id en query.' });
  }
  if (!product_id || quantity == null) {
    console.error('❌ Faltan product_id o quantity en body.');
    return res.status(400).json({
      error: 'Faltan parámetros: al menos product_id y quantity en body.'
    });
  }
  if (!woocommerce_url || !consumer_key || !consumer_secret) {
    console.error('❌ Faltan credenciales WooCommerce en body.');
    return res.status(400).json({
      error: 'Faltan credenciales WooCommerce en body.'
    });
  }

  try {
    // 4) Traer pedido original
    console.log('⏳ Fetching pedido', order_id);
    const order = await fetchOrderById(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id
    );
    const originalStatus = order.status;
    console.log('✅ Pedido original cargado con estado:', originalStatus);

    // 5) Construir línea
    const lineItem = {
      product_id: Number(product_id),
      quantity:   Number(quantity),
      ...(variation_id != null ? { variation_id: Number(variation_id) } : {})
    };
    if (price != null)        lineItem.price        = price;
    if (subtotal != null)     lineItem.subtotal     = subtotal;
    if (total != null)        lineItem.total        = total;
    if (subtotal_tax != null) lineItem.subtotal_tax = subtotal_tax;
    if (total_tax != null)    lineItem.total_tax    = total_tax;
    if (subtotal_tax != null && total_tax != null) {
      lineItem.taxes = [{
        id:       order.line_items[0]?.taxes?.[0]?.id || 0,
        total:    total_tax,
        subtotal: subtotal_tax
      }];
    }
    console.log('⏳ Línea construida para añadir:', lineItem);

    // 6) Poner a PENDING **sin** tocar line_items
    console.log('⏳ Actualizando a PENDING (sin añadir línea)…');
    await updateOrder(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id,
      { status: 'pending' }
    );
    console.log('✅ Pedido en pending');

    // 7) Restaurar estado original **añadiendo** solo una vez la línea
    console.log('⏳ Restaurando estado original y añadiendo línea…');
    const updated = await updateOrder(
      { woocommerce_url, consumer_key, consumer_secret },
      order_id,
      {
        status:     originalStatus,
        line_items: [ lineItem ]
      }
    );
    console.log('✅ Estado restaurado y línea añadida');

    // 8) Devolver el pedido actualizado
    return res.json(updated);

  } catch (err) {
    console.error(
      '❌ Error al añadir item al pedido:',
      err.response?.data || err.message
    );
    return res.status(500).json({
      error: 'No se pudo añadir el artículo al pedido.'
    });
  }
});

module.exports = router;
