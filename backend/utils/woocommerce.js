// backend/utils/woocommerce.js

const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
const https = require('https');

function createApi({ woocommerce_url, consumer_key, consumer_secret }) {
  return new WooCommerceRestApi({
    url: woocommerce_url,
    consumerKey: consumer_key,
    consumerSecret: consumer_secret,
    version: 'wc/v3',
    queryStringAuth: true,
    axiosConfig: {
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    }
  });
}

// Buscar pedidos por email
async function obtenerPedidosPorEmail({ woocommerce_url, consumer_key, consumer_secret }, email) {
  const api = createApi({ woocommerce_url, consumer_key, consumer_secret });
  try {
    const res = await api.get('orders', { search: email });
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error('Error en obtenerPedidosPorEmail:', err.response?.data || err.message);
    throw new Error('No se pudieron obtener los pedidos.');
  }
}

// Buscar usuario por email
async function getUserByEmail({ woocommerce_url, consumer_key, consumer_secret }, email) {
  const api = createApi({ woocommerce_url, consumer_key, consumer_secret });
  try {
    const res = await api.get('customers', { email, per_page: 1 });
    return Array.isArray(res.data) && res.data.length ? res.data[0] : null;
  } catch (err) {
    console.error('Error en getUserByEmail:', err.response?.data || err.message);
    throw new Error('No se pudo obtener el usuario.');
  }
}

// Editar dirección (en cliente o pedido)
async function editarDireccion({ woocommerce_url, consumer_key, consumer_secret }, email, updatedAddress) {
  const api = createApi({ woocommerce_url, consumer_key, consumer_secret });

  try {
    const user = await getUserByEmail({ woocommerce_url, consumer_key, consumer_secret }, email);
    let path;
    if (user && user.id) {
      path = `customers/${user.id}`;
    } else {
      const pedidos = await obtenerPedidosPorEmail({ woocommerce_url, consumer_key, consumer_secret }, email);
      if (!pedidos.length) throw new Error('No se encontraron pedidos para este email.');
      path = `orders/${pedidos[0].id}`;
    }
    const res = await api.put(path, updatedAddress);
    return res.data;
  } catch (err) {
    console.error('Error en editarDireccion (fallback):', err.response?.data || err.message);
    throw new Error('No se pudo actualizar la dirección.');
  }
}

// Estados de pedidos
async function fetchOrderStatuses(config) {
  const api = createApi(config);
  try {
    const res = await api.get('orders/statuses');
    return res.data;
  } catch (err) {
    console.error('Error en fetchOrderStatuses:', err.response?.data || err.message);
    throw new Error('No se pudieron obtener los estados de pedido.');
  }
}

// Productos
async function fetchProducts(config) {
  const api = createApi(config);
  try {
    const res = await api.get('products', { per_page: 100 });
    return res.data;
  } catch (err) {
    console.error('Error en fetchProducts:', err.response?.data || err.message);
    throw new Error('No se pudieron obtener los productos.');
  }
}

// Provincias por país (por defecto ES)
async function fetchCountryStates(config, countryCode = 'ES') {
  const api = createApi(config);
  try {
    const res = await api.get(`data/countries/${countryCode}`);
    return res.data.states || [];
  } catch (err) {
    console.error('Error en fetchCountryStates:', err.response?.data || err.message);
    throw new Error('No se pudieron obtener las provincias.');
  }
}

// Fallback: obtener pedidos generales
async function fetchOrders(config) {
  const api = createApi(config);
  try {
    const res = await api.get('orders', { per_page: 100 });
    return res.data;
  } catch (err) {
    console.error('Error en fetchOrders:', err.response?.data || err.message);
    throw new Error('No se pudieron obtener los pedidos.');
  }
}

module.exports = {
  createApi,
  obtenerPedidosPorEmail,
  getUserByEmail,
  editarDireccion,
  fetchOrderStatuses,
  fetchProducts,
  fetchCountryStates,
  fetchOrders
};
