// backend/app.js

require('dotenv').config();
const express           = require('express');
const cors              = require('cors');
const path              = require('path');
const ordersRoutes      = require('./routes/orders');
const editarDireccionRt = require('./routes/editar-ruta');
const variacionesRoutes = require('./routes/get-variaciones');
const editarItemRt      = require('./routes/editar-item');
const cambiarEstadoRt   = require('./routes/cambiar-estado');
const estadosRoutes     = require('./routes/get-estados');
const eliminarItemRt      = require('./routes/eliminar-item'); // <-- NUEVO
const anadirItemRt       = require('./routes/anadir-item');
const productosRoutes   = require('./routes/get-productos');
const getCiudades = require('./routes/get-ciudades');
const getProvincias = require('./routes/get-provincias');
const refundStripe = require('./routes/refund-stripe');
const getStripeCharges   = require('./routes/get-stripe-charges');
const paypalRouter = require('./routes/paypal');
const refundPaypal = require('./routes/refund-paypal');


const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', refundStripe);
app.use('/api', getStripeCharges);
app.use('/api', paypalRouter);
app.use('/api', refundPaypal);

// 1) Servir tu frontend (carpeta /frontend)
app.use('/', express.static(path.join(__dirname, '../frontend')));

// 2) Montar todas las rutas REST bajo /api
app.use('/api', ordersRoutes);          // GET  /api/buscar-pedidos
app.use('/api', editarDireccionRt);     // PUT  /api/editar-direccion
app.use('/api', variacionesRoutes);     // GET  /api/get-variaciones
app.use('/api', editarItemRt);          // PUT  /api/editar-item
app.use('/api', cambiarEstadoRt);       // PUT  /api/cambiar-estado
app.use('/api', estadosRoutes);
app.use('/api', eliminarItemRt);
app.use('/api', anadirItemRt);
app.use('/api', productosRoutes);
app.use('/api', getCiudades);
app.use('/api', getProvincias);
// 3) Levantar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
