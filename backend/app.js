// backend/app.js
// probando redeploy

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// ✅ Configuración completa de CORS
app.use(cors({
  origin: '*', // Puedes poner aquí 'https://dolvviasl.zendesk.com' si quieres limitarlo
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x_zendesk_secret'],
  credentials: true
}));

app.use(express.json());

// Importación de rutas
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
const buscarPedidosAvanzadoRoutes = require('./routes/buscar-pedido-avanzado');
const limpiarCacheRoute           = require('./routes/limpiar-cache');
const getMoneiChargesRoutes       = require('./routes/get-monei-charges');
const refundMoneiRoutes           = require('./routes/refund-monei');

// Rutas de API
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
app.use('/api/buscar-pedido-avanzado', buscarPedidosAvanzadoRoutes);
app.use('/api/limpiar-cache', limpiarCacheRoute);
app.use('/api/get-monei-charges', getMoneiChargesRoutes);
app.use('/api/refund-monei', refundMoneiRoutes);

// Servir frontend estático (si lo necesitas)
app.use(express.static(path.join(__dirname, '../frontend')));

// Levantar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});

