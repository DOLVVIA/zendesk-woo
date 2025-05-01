const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
const https = require('https');

/**
 * Crea una instancia del cliente WooCommerce con configuración TLS opcional.
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
 * Obtiene pedidos y filtra manualmente por correo del cliente,
 * asegurando que los metadatos (meta_data) estén presentes.
 */
async function obtenerPedidosPorEmail(config, email) {
  const api = createApi(config);

  // WooCommerce no filtra bien por billing.email → cargamos 100 y filtramos nosotros
  const res = await api.get('orders', { per_page: 100 });
  let pedidos = Array.isArray(res.data) ? res.data : [];

  // Filtra por el campo billing.email
  pedidos = pedidos.filter(p => p.billing && p.billing.email === email);

  return pedidos; // pedidos completos (con meta_data, billing, shipping, etc.)
}

/**
 * Obtiene un usuario de WooCommerce por email.
 */
async function getUserByEmail(config, email) {
  const api = createApi(config);
  const res = await api.get('customers', { email, per_page: 1 });
  return Array.isArray(res.data) && res.data.length ? res.data[0] : null;
}

/**
 * Edita la dirección de un cliente (si existe) o, en fallback, del primer pedido.
 */
async function editarDireccion(config, email, updatedAddress) {
  const api = createApi(config);
  const user = await getUserByEmail(config, email);
  let path;
  if (user && user.id) {
    path = `customers/${user.id}`;
  } else {
    const pedidos = await obtenerPedidosPorEmail(config, email);
    if (!pedidos.length) throw new Error('No se encontraron pedidos para este email.');
    path = `orders/${pedidos[0].id}`;
  }
  const res = await api.put(path, updatedAddress);
  return res.data;
}

/**
 * Obtiene los estados posibles de pedidos.
 */
async function fetchOrderStatuses(config) {
  const api = createApi(config);
  const res = await api.get('orders/statuses');
  return res.data;
}

/**
 * Obtiene la lista de productos (hasta 100 ítems por página).
 */
async function fetchProducts(config) {
  const api = createApi(config);
  const res = await api.get('products', { per_page: 100 });
  return res.data;
}

/**
 * Obtiene las provincias (estados) de un país dado (por defecto ES).
 */
async function fetchCountryStates(config, countryCode = 'ES') {
  const api = createApi(config);
  const res = await api.get(`data/countries/${countryCode}`);
  return res.data.states || [];
}

/**
 * Fallback: obtener pedidos sin filtro (hasta 100).
 */
async function fetchOrders(config) {
  const api = createApi(config);
  const res = await api.get('orders', { per_page: 100 });
  return res.data;
}

/**
 * Recupera un pedido completo por su ID.
 */
async function fetchOrderById(config, orderId) {
  const api = createApi(config);
  const res = await api.get(`orders/${orderId}`);
  return res.data;
}

/**
 * Actualiza cualquier pedido con el payload dado (billing, shipping, status, line_items...).
 */
async function updateOrder(config, orderId, data) {
  const api = createApi(config);
  const res = await api.put(`orders/${orderId}`, data);
  return res.data;
}

/**
 * Añade líneas de ítems a un pedido.
 */
async function addLineItemToOrder(config, orderId, lineItems) {
  const api = createApi(config);
  const res = await api.post(`orders/${orderId}/line_items/batch`, {
    create: lineItems.map(item => ({
      product_id: Number(item.product_id),
      quantity: Number(item.quantity),
      ...(item.variation_id ? { variation_id: Number(item.variation_id) } : {})
    }))
  });
  return res.data;
}

module.exports = {
  createApi,
  obtenerPedidosPorEmail,
  getUserByEmail,
  editarDireccion,
  fetchOrderStatuses,
  fetchProducts,
  fetchCountryStates,
  fetchOrders,
  fetchOrderById,
  updateOrder,
  addLineItemToOrder
};
