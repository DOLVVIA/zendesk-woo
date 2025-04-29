document.getElementById('editar-form').addEventListener('submit', async (e) => {
    e.preventDefault();
  
    const email = 'b_murillo3@hotmail.com'; // Este puede venir de un input o del frontend
    const firstName = document.getElementById('first-name').value;
    const lastName = document.getElementById('last-name').value;
    const address1 = document.getElementById('address-1').value;
    const city = document.getElementById('city').value;
    const postcode = document.getElementById('postcode').value;
    const country = document.getElementById('country').value;
  
    const updatedAddress = {
      billing: {
        first_name: firstName,
        last_name: lastName,
        address_1: address1,
        city: city,
        postcode: postcode,
        country: country,
      }
    };
  
    try {
      const response = await fetch(`http://localhost:3000/api/editar-direccion?email=${encodeURIComponent(email)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedAddress),
      });
  
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
  
      alert('Dirección actualizada correctamente.');
    } catch (error) {
      console.error('Error al actualizar la dirección:', error);
      alert('Hubo un error al actualizar la dirección. Intenta de nuevo.');
    }
  });
  