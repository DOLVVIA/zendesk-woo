// utils/woocommerce.js
const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
const https = require('https');

/**
 * Crea una instancia de WooCommerceRestApi configurada dinámicamente.
 *
 * @param {Object} config
 * @param {string} config.woocommerce_url
 * @param {string} config.consumer_key
 * @param {string} config.consumer_secret
 * @returns {WooCommerceRestApi}
 */
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

/**
 * Obtiene todos los pedidos (guest o registrados) que coincidan con un email.
 *
 * @param {Object} config
 * @param {string} email
 * @returns {Promise<Array>} array de pedidos
 */
async function obtenerPedidosPorEmail({ woocommerce_url, consumer_key, consumer_secret }, email) {
  const api = createApi({ woocommerce_url, consumer_key, consumer_secret });
  try {
    const res = await api.get('orders', { search: email });
    const pedidos = res.data;
    return Array.isArray(pedidos) ? pedidos : [];
  } catch (err) {
    console.error('Error en obtenerPedidosPorEmail:', err.response?.data || err.message);
    throw new Error('No se pudieron obtener los pedidos.');
  }
}

/**
 * Obtiene un usuario registrado por email (cliente de WooCommerce).
 *
 * @param {Object} config
 * @param {string} email
 * @returns {Promise<Object|null>} datos del cliente o null
 */
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

/**
 * Edita la dirección para un email: primero intenta en customer, si no existe cae en order.
 *
 * @param {Object} config
 * @param {string} email
 * @param {Object} updatedAddress — campos billing/shipping
 * @returns {Promise<Object>} datos actualizados
 */
async function editarDireccion({ woocommerce_url, consumer_key, consumer_secret }, email, updatedAddress) {
  const api = createApi({ woocommerce_url, consumer_key, consumer_secret });

  try {
    const user = await getUserByEmail({ woocommerce_url, consumer_key, consumer_secret }, email);
    let path;
    if (user && user.id) {
      path = `customers/${user.id}`;
    } else {
      // fallback a primer pedido del email
      const pedidos = await obtenerPedidosPorEmail({ woocommerce_url, consumer_key, consumer_secret }, email);
      if (!pedidos.length) {
        throw new Error('No se encontraron pedidos para este email.');
      }
      path = `orders/${pedidos[0].id}`;
    }
    const res = await api.put(path, updatedAddress);
    return res.data;
  } catch (err) {
    console.error('Error en editarDireccion (fallback):', err.response?.data || err.message);
    throw new Error('No se pudo actualizar la dirección.');
  }
}

module.exports = {
  createApi,
  obtenerPedidosPorEmail,
  getUserByEmail,
  editarDireccion
};
