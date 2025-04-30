// backend/app.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Importación de rutas
const ordersRoutes = require('./routes/orders');
const editarDireccionRoutes  = require('./routes/editar-direccion');
const getVariacionesRoutes   = require('./routes/get-variaciones');
const editarItemRoutes       = require('./routes/editar-item');
const cambiarEstadoRoutes    = require('./routes/cambiar-estado');
const getEstadosRoutes       = require('./routes/get-estados');
const eliminarItemRoutes     = require('./routes/eliminar-item');
const anadirItemRoutes       = require('./routes/anadir-item');
const getProductosRoutes     = require('./routes/get-productos');
const getCiudadesRoutes      = require('./routes/get-ciudades');
const getProvinciasRoutes    = require('./routes/get-provincias');
const getStripeChargesRoutes = require('./routes/get-stripe-charges');
const refundStripeRoutes     = require('./routes/refund-stripe');
const paypalRoutes           = require('./routes/paypal');
const refundPaypalRoutes     = require('./routes/refund-paypal');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rutas de API
app.use('/api', require('./routes/orders'));   // GET  /api/buscar-pedidos
app.use('/api', editarDireccionRoutes);  // PUT  /api/editar-direccion
app.use('/api', getVariacionesRoutes);   // GET  /api/get-variaciones
app.use('/api', editarItemRoutes);       // PUT  /api/editar-item
app.use('/api', cambiarEstadoRoutes);    // PUT  /api/cambiar-estado
app.use('/api', getEstadosRoutes);       // GET  /api/get-estados
app.use('/api', eliminarItemRoutes);     // DELETE /api/eliminar-item
app.use('/api', anadirItemRoutes);       // POST   /api/anadir-item
app.use('/api', getProductosRoutes);     // GET  /api/get-productos
app.use('/api', getCiudadesRoutes);      // GET  /api/get-ciudades
app.use('/api', getProvinciasRoutes);    // GET  /api/get-provincias
app.use('/api', getStripeChargesRoutes); // GET  /api/get-stripe-charges
app.use('/api', refundStripeRoutes);     // POST /api/refund-stripe
app.use('/api', paypalRoutes);           // GET  /api/get-paypal-transaction
app.use('/api', refundPaypalRoutes);     // POST /api/refund-paypal

// Servir frontend estático
app.use('/', express.static(path.join(__dirname, '../frontend')));

// Levantar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
