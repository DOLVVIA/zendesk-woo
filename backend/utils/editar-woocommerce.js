const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
const api = new WooCommerceRestApi({
  url: process.env.WOOCOMMERCE_URL,
  consumerKey: process.env.WOOCOMMERCE_KEY,
  consumerSecret: process.env.WOOCOMMERCE_SECRET,
  version: 'wc/v3',
});

// Función que actualiza la dirección del cliente
async function editarDireccion(email, updatedAddress) {
  try {
    // Obtener el ID del cliente con el email
    const customers = await api.get('customers', { email });
    const customerId = customers.data[0]?.id;

    if (!customerId) throw new Error('Cliente no encontrado.');

    // Actualizar la dirección del cliente
    const response = await api.put(`customers/${customerId}`, updatedAddress);

    return response.data;
  } catch (error) {
    console.error('Error al editar dirección:', error);
    throw new Error('No se pudo editar la dirección.');
  }
}

module.exports = { editarDireccion };
