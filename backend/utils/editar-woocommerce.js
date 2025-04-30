// utils/editar-woocommerce.js
const { createApi } = require('./woocommerce');

/**
 * Actualiza la dirección de un cliente registrado en WooCommerce.
 * Si el cliente no existe, lanza un error.
 *
 * @param {Object} config
 * @param {string} config.woocommerce_url
 * @param {string} config.consumer_key
 * @param {string} config.consumer_secret
 * @param {string} email
 * @param {Object} updatedAddress — objeto con campos de billing/shipping a actualizar
 * @returns {Promise<Object>} datos del cliente actualizado
 */
async function editarDireccion({ woocommerce_url, consumer_key, consumer_secret }, email, updatedAddress) {
  const api = createApi({ woocommerce_url, consumer_key, consumer_secret });

  try {
    // 1) Buscar cliente por email
    const customersRes = await api.get('customers', { email, per_page: 1 });
    const customer = customersRes.data[0];
    if (!customer || !customer.id) {
      throw new Error('Cliente no encontrado');
    }

    // 2) Actualizar dirección del cliente
    const response = await api.put(`customers/${customer.id}`, updatedAddress);
    return response.data;
  } catch (err) {
    console.error('Error en editarDireccion:', err.response?.data || err.message);
    throw new Error('No se pudo editar la dirección del cliente.');
  }
}

/**
 * Obtiene todos los pedidos asociados a un email.
 *
 * @param {Object} config
 * @param {string} email
 * @returns {Promise<Array>} lista de pedidos
 */
async function getPedidosPorEmail({ woocommerce_url, consumer_key, consumer_secret }, email) {
  const api = createApi({ woocommerce_url, consumer_key, consumer_secret });

  try {
    const pedidosRes = await api.get('orders', {
      search: email,
      per_page: 100
    });
    return pedidosRes.data;
  } catch (err) {
    console.error('Error al obtener pedidos:', err.response?.data || err.message);
    throw new Error('No se pudieron obtener los pedidos del cliente.');
  }
}

module.exports = {
  editarDireccion,
  getPedidosPorEmail
};
