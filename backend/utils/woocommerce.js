const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
const https = require("https");

const api = new WooCommerceRestApi({
  url: process.env.WOOCOMMERCE_URL,
  consumerKey: process.env.WOOCOMMERCE_KEY,
  consumerSecret: process.env.WOOCOMMERCE_SECRET,
  version: 'wc/v3',
  queryStringAuth: true,
  axiosConfig: {
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  }
});

console.log('Woo URL:', process.env.WOOCOMMERCE_URL);
console.log('Woo KEY:', process.env.WOOCOMMERCE_KEY);
console.log('Woo SECRET:', process.env.WOOCOMMERCE_SECRET);

// Obtiene pedidos por email (guest u usuario)
async function obtenerPedidosPorEmail(email) {
  try {
    console.log("🧪 Buscando pedidos con el email:", email);
    const response = await api.get('orders', { search: email });
    const pedidos = response.data;
    if (!Array.isArray(pedidos)) {
      console.warn("La API no devolvió un array de pedidos:", pedidos);
      return [];
    }
    return pedidos;
  } catch (error) {
    console.error('🧨 Error al obtener pedidos:', error.response?.data || error.message);
    throw new Error('No se pudieron obtener los pedidos.');
  }
}

// Obtiene un cliente registrado por email
async function getUserByEmail(email) {
  try {
    console.log("🧪 Buscando cliente registrado con el email:", email);
    const response = await api.get('customers', {
      email: email,
      per_page: 1
    });
    console.log('📦 Respuesta de getUserByEmail:', response.data);

    if (!response.data || response.data.length === 0) {
      return null;
    }
    return response.data[0];
  } catch (error) {
    console.error('🧨 Error al obtener el usuario por email:', error.response?.data || error.message);
    throw new Error('No se pudo obtener el usuario.');
  }
}

// Edita la dirección; primero intenta customer, si no existe actualiza la order
async function editarDireccion(email, updatedAddress) {
  try {
    console.log("🧪 editando dirección para email:", email);

    const user = await getUserByEmail(email);
    let resourcePath, id;

    if (user && user.id) {
      id = user.id;
      resourcePath = `customers/${id}`;
      console.log('✏️ Actualizando Customer ID:', id);
    } else {
      console.log('⚠️ Cliente no registrado. Fallback a Order');
      const pedidos = await obtenerPedidosPorEmail(email);
      if (!pedidos.length) {
        throw new Error('No se encontraron pedidos para este email.');
      }
      id = pedidos[0].id;
      resourcePath = `orders/${id}`;
      console.log('✏️ Actualizando Order ID:', id);
    }

    const response = await api.put(resourcePath, updatedAddress);
    console.log('✅ Actualización exitosa:', response.data);
    return response.data;
  } catch (error) {
    console.error('🧨 Error al actualizar dirección:', error.response?.data || error.message);
    throw new Error('No se pudo actualizar la dirección.');
  }
}

module.exports = {
  api,
  obtenerPedidosPorEmail,
  getUserByEmail,
  editarDireccion
};

