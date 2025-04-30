// backend/app.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Importación de rutas
const ordersRoutes = require('./routes/orders');
const editarRutaRoutes = require('./routes/editar-ruta');
const getVariacionesRoutes = require('./routes/get-variaciones');
const editarItemRoutes = require('./routes/editar-item');
const cambiarEstadoRoutes = require('./routes/cambiar-estado');
const getEstadosRoutes = require('./routes/get-estados');
const eliminarItemRoutes = require('./routes/eliminar-item');
const anadirItemRoutes = require('./routes/anadir-item');
const getProductosRoutes = require('./routes/get-productos');
const getCiudadesRoutes = require('./routes/get-ciudades');
const getProvinciasRoutes = require('./routes/get-provincias');
const getStripeChargesRoutes = require('./routes/get-stripe-charges');
const refundStripeRoutes = require('./routes/refund-stripe');
const paypalRoutes = require('./routes/paypal');
const refundPaypalRoutes = require('./routes/refund-paypal');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rutas de API con paths específicos
app.use('/api/buscar-pedidos', ordersRoutes);
app.use('/api/editar-direccion', editarRutaRoutes);
app.use('/api/get-variaciones', getVariacionesRoutes);
app.use('/api/editar-item', editarItemRoutes);
app.use('/api/cambiar-estado', cambiarEstadoRoutes);
app.use('/api/get-estados', getEstadosRoutes);
app.use('/api/eliminar-item', eliminarItemRoutes);
app.use('/api/anadir-item', anadirItemRoutes);
app.use('/api/get-productos', getProductosRoutes);
app.use('/api/get-ciudades', getCiudadesRoutes);
app.use('/api/get-provincias', getProvinciasRoutes);
app.use('/api/get-stripe-charges', getStripeChargesRoutes);
app.use('/api/refund-stripe', refundStripeRoutes);
app.use('/api/get-paypal-transaction', paypalRoutes);
app.use('/api/refund-paypal', refundPaypalRoutes);

// Servir frontend estático (opcional)
app.use('/', express.static(path.join(__dirname, '../frontend')));

// Levantar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
