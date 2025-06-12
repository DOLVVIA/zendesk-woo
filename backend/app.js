// backend/app.js

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

// Importación de rutas
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

const app = express();

// ─── 1) CORS ────────────────────────────────────────────────────────────────
// Permitimos el header x-zendesk-secret (y mantengo tu cors original para que no falte nada)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-zendesk-secret'
  );
  next();
});
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','x-zendesk-secret'],
}));

// ─── 2) Parseo de JSON ─────────────────────────────────────────────────────
app.use(express.json());

// ─── 3) Validación de la cabecera secreta ──────────────────────────────────
app.use((req, res, next) => {
  const expected = process.env.ZENDESK_SHARED_SECRET;
  const provided = req.headers['x-zendesk-secret'];
  if (!expected || provided !== expected) {
    return res.status(403).json({ error: 'Forbidden: cabecera x-zendesk-secret inválida' });
  }
  next();
});

// ─── 4) Ruta de prueba ──────────────────────────────────────────────────────
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', mensaje: 'Railway responde correctamente 🚀' });
});

// ─── 5) Rutas de API ────────────────────────────────────────────────────────
app.use('/api/buscar-pedidos',           buscarPedidosRoute);
app.use('/api/editar-direccion',         editarDireccionRoutes);
app.use('/api/get-variaciones',          getVariacionesRoutes);
app.use('/api/editar-item',              editarItemRoutes);
app.use('/api/cambiar-estado',           cambiarEstadoRoutes);
app.use('/api/get-estados',              getEstadosRoutes);
app.use('/api/eliminar-item',            eliminarItemRoutes);
app.use('/api/anadir-item',              anadirItemRoutes);
app.use('/api/get-productos',            getProductosRoutes);
app.use('/api/get-ciudades',             getCiudadesRoutes);
app.use('/api/get-provincias',           getProvinciasRoutes);
app.use('/api/get-stripe-charges',       getStripeChargesRoutes);
app.use('/api/refund-stripe',            refundStripeRoutes);
app.use('/api/get-paypal-transactions',  getPayPalTransactionsRoutes);
app.use('/api/refund-paypal',            refundPayPalRoutes);
app.use('/api/bbva-transfer',            bbvaRoutes);
app.use('/api/buscar-pedido-avanzado',   buscarPedidosAvanzadoRoutes);
app.use('/api/limpiar-cache',            limpiarCacheRoute);
app.use('/api/get-monei-charges',        getMoneiChargesRoutes);
app.use('/api/refund-monei',             refundMoneiRoutes);

// ─── 6) Frontend estático ──────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── 7) Levantar servidor ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});
