// backend/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Log de arranque del servidor
console.log('🔔 [App] Iniciando backend/app.js');

const app = express();

// Middleware global de logging: registra cada petición entrante
app.use((req, res, next) => {
  console.log(`→ [GLOBAL] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Middlewares estándar
app.use(cors());
app.use(express.json());

// Importación de rutas
console.log('🔔 [App] Importando rutas de API');
const buscarPedidosRoute         = require('./routes/orders');
const editarDireccionRoutes      = require('./routes/editar-ruta');
const getVariacionesRoutes       = require('./routes/get-variaciones');
const editarItemRoutes           = require('./routes/editar-item');
const cambiarEstadoRoutes        = require('./routes/cambiar-estado');
const getEstadosRoutes           = require('./routes/get-estados');
const eliminarItemRoutes         = require('./routes/eliminar-item');
const anadirItemRoutes           = require('./routes/anadir-item');
const getProductosRoutes         = require('./routes/get-productos');
const getCiudadesRoutes          = require('./routes/get-ciudades');
const getProvinciasRoutes        = require('./routes/get-provincias');
const getStripeChargesRoutes     = require('./routes/get-stripe-charges');
const refundStripeRoutes         = require('./routes/refund-stripe');
const getPayPalTransactionsRoutes = require('./routes/get-paypal-transactions');
const refundPayPalRoutes         = require('./routes/refund-paypal');
const bbvaRoutes                 = require('./routes/bbva-transfer');
const callbellRoutes             = require('./routes/callbell');

// Montaje de rutas con logs
console.log('🔔 [App] Montando ruta GET /api/buscar-pedidos');
app.use('/api/buscar-pedidos', buscarPedidosRoute);
console.log('🔔 [App] Montando ruta PUT /api/editar-direccion');
app.use('/api/editar-direccion', editarDireccionRoutes);
console.log('🔔 [App] Montando ruta GET /api/get-variaciones');
app.use('/api/get-variaciones', getVariacionesRoutes);
console.log('🔔 [App] Montando ruta PUT /api/editar-item');
app.use('/api/editar-item', editarItemRoutes);
console.log('🔔 [App] Montando ruta PUT /api/cambiar-estado');
app.use('/api/cambiar-estado', cambiarEstadoRoutes);
console.log('🔔 [App] Montando ruta GET /api/get-estados');
app.use('/api/get-estados', getEstadosRoutes);
console.log('🔔 [App] Montando ruta DELETE /api/eliminar-item');
app.use('/api/eliminar-item', eliminarItemRoutes);
console.log('🔔 [App] Montando ruta POST /api/anadir-item');
app.use('/api/anadir-item', anadirItemRoutes);
console.log('🔔 [App] Montando ruta GET /api/get-productos');
app.use('/api/get-productos', getProductosRoutes);
console.log('🔔 [App] Montando ruta GET /api/get-ciudades');
app.use('/api/get-ciudades', getCiudadesRoutes);
console.log('🔔 [App] Montando ruta GET /api/get-provincias');
app.use('/api/get-provincias', getProvinciasRoutes);
console.log('🔔 [App] Montando ruta GET /api/get-stripe-charges');
app.use('/api/get-stripe-charges', getStripeChargesRoutes);
console.log('🔔 [App] Montando ruta POST /api/refund-stripe');
app.use('/api/refund-stripe', refundStripeRoutes);
console.log('🔔 [App] Montando ruta GET /api/get-paypal-transactions');
app.use('/api/get-paypal-transactions', getPayPalTransactionsRoutes);
console.log('🔔 [App] Montando ruta POST /api/refund-paypal');
app.use('/api/refund-paypal', refundPayPalRoutes);
console.log('🔔 [App] Montando ruta POST /api/bbva-transfer');
app.use('/api/bbva-transfer', bbvaRoutes);
console.log('🔔 [App] Montando ruta /api/callbell');
app.use('/api/callbell', callbellRoutes);

// Servir frontend estático
app.use('/', express.static(path.join(__dirname, '../frontend')));
console.log('🔔 [App] Configuración de rutas estáticas completada');

// Levantar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
