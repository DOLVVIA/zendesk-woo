require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Validar x-zendesk-secret en todas las rutas /api
const ZENDESK_SECRET = process.env.ZENDESK_SHARED_SECRET;
app.use('/api', (req, res, next) => {
  const incoming = req.get('x-zendesk-secret');
  if (!incoming || incoming !== ZENDESK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: x-zendesk-secret inválido' });
  }
  next();
});

// Middlewares estándar
app.use(cors());
app.use(express.json());

// Rutas de API
const buscarPedidosRoute          = require('./routes/orders');
const editarDireccionRoutes       = require('./routes/editar-ruta');
const getVariacionesRoutes        = require('./routes/get-variaciones');
const editarItemRoutes            = require('./routes/editar-item');
const cambiarEstadoRoutes         = require('./routes/cambiar-estado');
const getEstadosRoutes            = require('./routes/get-estados');
const eliminarItemRoutes          = require('./routes/eliminar-item');
const anadirItemRoutes            = require('./routes/anadir-item');
const getProductosRoutes          = require('./routes/get-productos');
const getCiudadesRoutes           = require('./routes/get-ciudades');
const getProvinciasRoutes         = require('./routes/get-provincias');
const getStripeChargesRoutes      = require('./routes/get-stripe-charges');
const refundStripeRoutes          = require('./routes/refund-stripe');
const getPayPalTransactionsRoutes = require('./routes/get-paypal-transactions');
const refundPayPalRoutes          = require('./routes/refund-paypal');
const bbvaRoutes                  = require('./routes/bbva-transfer');
const callbellRoutes              = require('./routes/callbell');

app.use('/api/buscar-pedidos', buscarPedidosRoute);
app.use('/api/editar-direccion', editarDireccionRoutes);
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
app.use('/api/get-paypal-transactions', getPayPalTransactionsRoutes);
app.use('/api/refund-paypal', refundPayPalRoutes);
app.use('/api/bbva-transfer', bbvaRoutes);
app.use('/api/callbell', callbellRoutes);

// Servir frontend estático
app.use('/', express.static(path.join(__dirname, '../frontend')));

// Arrancar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
