// backend/app.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// 1) RESPONDER manualmente las solicitudes OPTIONS (preflight)
app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://dolviasi.zendesk.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-zendesk-secret');
  res.sendStatus(200);
});

// 2) Middleware CORS
app.use(cors({
  origin: 'https://dolviasi.zendesk.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-zendesk-secret']
}));

// 3) Saltar validación de secret en preflight OPTIONS
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  const expected = process.env.ZENDESK_SHARED_SECRET;
  const provided = req.get('x-zendesk-secret');
  if (!expected || provided !== expected) {
    return res.status(403).json({ error: 'Forbidden: cabecera x-zendesk-secret inválida' });
  }
  next();
});

// 4) JSON parser
app.use(express.json());

// 5) Ruta de prueba
app.get(['/api/ping', '/ping'], (req, res) => {
  res.json({ status: 'ok', mensaje: 'Railway responde correctamente 🚀' });
});

// 6) Importar routers
const buscarPedidosRoute           = require('./routes/orders');
const editarDireccionRoutes        = require('./routes/editar-ruta');
const getVariacionesRoutes         = require('./routes/get-variaciones');
const editarItemRoutes             = require('./routes/editar-item');
const cambiarEstadoRoutes          = require('./routes/cambiar-estado');
const getEstadosRoutes             = require('./routes/get-estados');
const eliminarItemRoutes           = require('./routes/eliminar-item');
const anadirItemRoutes             = require('./routes/anadir-item');
const getProductosRoutes           = require('./routes/get-productos');
const getCiudadesRoutes            = require('./routes/get-ciudades');
const getProvinciasRoutes          = require('./routes/get-provincias');
const getStripeChargesRoutes       = require('./routes/get-stripe-charges');
const refundStripeRoutes           = require('./routes/refund-stripe');
const getPayPalTransactionsRoutes  = require('./routes/get-paypal-transactions');
const refundPayPalRoutes           = require('./routes/refund-paypal');
const bbvaRoutes                   = require('./routes/bbva-transfer');
const buscarPedidosAvanzadoRoutes  = require('./routes/buscar-pedido-avanzado');
const limpiarCacheRoute            = require('./routes/limpiar-cache');
const getMoneiChargesRoutes        = require('./routes/get-monei-charges');
const refundMoneiRoutes            = require('./routes/refund-monei');

// 7) Montar rutas con y sin `/api`
[
  ['buscar-pedidos',           buscarPedidosRoute],
  ['editar-direccion',         editarDireccionRoutes],
  ['get-variaciones',          getVariacionesRoutes],
  ['editar-item',              editarItemRoutes],
  ['cambiar-estado',           cambiarEstadoRoutes],
  ['get-estados',              getEstadosRoutes],
  ['eliminar-item',            eliminarItemRoutes],
  ['anadir-item',              anadirItemRoutes],
  ['get-productos',            getProductosRoutes],
  ['get-ciudades',             getCiudadesRoutes],
  ['get-provincias',           getProvinciasRoutes],
  ['get-stripe-charges',       getStripeChargesRoutes],
  ['refund-stripe',            refundStripeRoutes],
  ['get-paypal-transactions',  getPayPalTransactionsRoutes],
  ['refund-paypal',            refundPayPalRoutes],
  ['bbva-transfer',            bbvaRoutes],
  ['buscar-pedido-avanzado',   buscarPedidosAvanzadoRoutes],
  ['limpiar-cache',            limpiarCacheRoute],
  ['get-monei-charges',        getMoneiChargesRoutes],
  ['refund-monei',             refundMoneiRoutes],
].forEach(([route, router]) => {
  app.use(`/api/${route}`, router);
  app.use(`/${route}`, router);
});

// 8) Servir frontend estático (si aplica)
app.use(express.static(path.join(__dirname, '../frontend')));

// 9) Levantar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});
