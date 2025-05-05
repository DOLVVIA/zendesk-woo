// backend/app.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Importación de rutas
const buscarPedidosRoute      = require('./routes/orders');
const editarDireccionRoutes   = require('./routes/editar-ruta');
const getVariacionesRoutes    = require('./routes/get-variaciones');
const editarItemRoutes        = require('./routes/editar-item');
const cambiarEstadoRoutes     = require('./routes/cambiar-estado');
const getEstadosRoutes        = require('./routes/get-estados');
const eliminarItemRoutes      = require('./routes/eliminar-item');
const anadirItemRoutes        = require('./routes/anadir-item');
const getProductosRoutes      = require('./routes/get-productos');
const getCiudadesRoutes       = require('./routes/get-ciudades');
const getProvinciasRoutes     = require('./routes/get-provincias');
const getStripeChargesRoutes  = require('./routes/get-stripe-charges');
const refundStripeRoutes      = require('./routes/refund-stripe');
const getPayPalTransactionsRoutes = require('./routes/get-paypal-transactions');
const refundPayPalRoutes = require('./routes/refund-paypal');
const bbva = require('./routes/bbva-transfer');
const callbell = require('./routes/callbell');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas de API
app.use('/api/buscar-pedidos', buscarPedidosRoute);        // GET
app.use('/api/editar-direccion', editarDireccionRoutes);   // PUT
app.use('/api/get-variaciones', getVariacionesRoutes);     // GET
app.use('/api/editar-item', editarItemRoutes);             // PUT
app.use('/api/cambiar-estado', cambiarEstadoRoutes);       // PUT
app.use('/api/get-estados', getEstadosRoutes);             // GET
app.use('/api/eliminar-item', eliminarItemRoutes);         // DELETE
app.use('/api/anadir-item', anadirItemRoutes);             // POST
app.use('/api/get-productos', getProductosRoutes);         // GET
app.use('/api/get-ciudades', getCiudadesRoutes);           // GET
app.use('/api/get-provincias', getProvinciasRoutes);       // GET
app.use('/api/get-stripe-charges', getStripeChargesRoutes);// GET
app.use('/api/refund-stripe', refundStripeRoutes);         // POST
app.use('/api/get-paypal-transactions', getPayPalTransactionsRoutes);
app.use('/api/refund-paypal',refundPayPalRoutes);
app.use('/api/bbva-transfer', bbva);
app.use('/api/callbell', callbell);


// Servir frontend estático (si lo necesitas)
app.use('/', express.static(path.join(__dirname, '../frontend')));

// Levantar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
