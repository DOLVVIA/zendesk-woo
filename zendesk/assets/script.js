// zendesk/assets/script.js
const client = ZAFClient.init();

client.on('app.registered', async () => {
  const { settings: SETTINGS } = await client.metadata();
  console.log("CONFIG:", SETTINGS);
  const API_BASE = 'https://zendesk-woo.onrender.com/api';

  function getHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-zendesk-secret': SETTINGS.x_zendesk_secret
    };
  }

  function getWooConfig() {
    return {
      woocommerce_url: SETTINGS.woocommerce_url,
      consumer_key: SETTINGS.woocommerce_consumer_key,
      consumer_secret: SETTINGS.woocommerce_consumer_secret
    };
  }

  function getStripeConfig() {
    return { stripe_secret_key: SETTINGS.stripe_secret_key };
  }

  function getPayPalConfig() {
    return {
      paypal_client_id: SETTINGS.paypal_client_id,
      paypal_secret: SETTINGS.paypal_secret,
      paypal_env: SETTINGS.paypal_env
    };
  }

  let orderStatuses = [];
  let productsList = [];
  let citiesList = [];
  let provincesList = [];

  function ajustarAlto() {
    client.invoke('resize', { height: `${document.body.scrollHeight}px` }).catch(console.error);
  }

  async function loadOrderStatuses() {
    try {
      const { woocommerce_url, consumer_key, consumer_secret } = getWooConfig();
      const url = `${API_BASE}/get-estados?` +
        `woocommerce_url=${encodeURIComponent(woocommerce_url)}&` +
        `consumer_key=${encodeURIComponent(consumer_key)}&` +
        `consumer_secret=${encodeURIComponent(consumer_secret)}`;
      const res = await fetch(url, { headers: getHeaders() });
      orderStatuses = await res.json();
    } catch (e) {
      console.error(e);
    }
  }

  async function loadProducts() {
    if (productsList.length) return;
    try {
      const { woocommerce_url, consumer_key, consumer_secret } = getWooConfig();
      const url = `${API_BASE}/get-productos?` +
        `woocommerce_url=${encodeURIComponent(woocommerce_url)}&` +
        `consumer_key=${encodeURIComponent(consumer_key)}&` +
        `consumer_secret=${encodeURIComponent(consumer_secret)}`;
      const res = await fetch(url, { headers: getHeaders() });
      productsList = await res.json();
    } catch (e) {
      console.error(e);
    }
  }

  async function loadCities() {
    if (citiesList.length) return;
    try {
      const { woocommerce_url, consumer_key, consumer_secret } = getWooConfig();
      const url = `${API_BASE}/get-ciudades?` +
        `woocommerce_url=${encodeURIComponent(woocommerce_url)}&` +
        `consumer_key=${encodeURIComponent(consumer_key)}&` +
        `consumer_secret=${encodeURIComponent(consumer_secret)}`;
      const res = await fetch(url, { headers: getHeaders() });
      citiesList = await res.json();
    } catch (e) {
      console.error(e);
    }
  }

  async function loadProvincias() {
    if (provincesList.length) return;
    try {
      const { woocommerce_url, consumer_key, consumer_secret } = getWooConfig();
      const url = `${API_BASE}/get-provincias?country=ES&` +
        `woocommerce_url=${encodeURIComponent(woocommerce_url)}&` +
        `consumer_key=${encodeURIComponent(consumer_key)}&` +
        `consumer_secret=${encodeURIComponent(consumer_secret)}`;
      const res = await fetch(url, { headers: getHeaders() });
      provincesList = await res.json();
    } catch (e) {
      console.error(e);
    }
  }

  function showMessage(panel, text, type = 'success') {
    const msg = document.createElement('div');
    msg.className = `inline-msg inline-msg--${type}`;
    msg.innerText = text;
    panel.prepend(msg);
    setTimeout(() => msg.remove(), 3000);
  }

  async function loadStripeCharges(email) {
    try {
      const { stripe_secret_key } = getStripeConfig();
      const url = `${API_BASE}/get-stripe-charges?` +
        `email=${encodeURIComponent(email)}&` +
        `stripe_secret_key=${encodeURIComponent(stripe_secret_key)}`;
        console.log('🔍 Stripe URL:', url);   // <— agrégalo
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async function refundStripe(chargeId, amount, panel) {
    try {
      const payload = { chargeId, amount, ...getStripeConfig() };
      const res = await fetch(`${API_BASE}/refund-stripe`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        showMessage(panel, `Reembolso OK (ID: ${json.refund.id})`);
        await loadPedidos();
      } else {
        showMessage(panel, `Error reembolso: ${json.error}`, 'error');
      }
    } catch (e) {
      console.error(e);
      showMessage(panel, 'Error inesperado al reembolsar', 'error');
    }
  }

  function renderStripeCharges(charges, container, panel) {
    container.innerHTML = '';
    if (!charges.length) {
      container.innerHTML = '<p>No hay cargos de Stripe para este cliente.</p>';
      return;
    }
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.innerText = `Ver pagos (${charges.length})`;
    details.appendChild(summary);
    const ul = document.createElement('ul');
    ul.className = 'stripe-payments';
    charges.forEach(c => {
      const title = c.metadata?.products || c.description || c.id;
      const amount = (c.amount / 100).toFixed(2);
      const refunded = (c.amount_refunded || 0) / 100;
      const isFull = c.amount_refunded === c.amount;
      const isPartial = c.amount_refunded > 0 && c.amount_refunded < c.amount;
      let statusTxt;
      if (isFull) statusTxt = 'Reembolsado';
      else if (isPartial) statusTxt = `Parcial (${refunded.toFixed(2)} €)`;
      else statusTxt = c.status === 'succeeded' ? 'Exitoso' : 'Fallido';
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="payment-info">
          <span>${title} — ${amount} €</span>
          <span class="badge ${isFull || isPartial ? 'success' : c.status==='succeeded'?'success':'failed'}">
            ${statusTxt}
          </span>
        </div>
      `;
      const fullBtn = document.createElement('button');
      fullBtn.innerText = 'Reembolso completo';
      fullBtn.disabled = isFull;
      fullBtn.addEventListener('click', () => refundStripe(c.id, c.amount, panel));
      const partialBtn = document.createElement('button');
      partialBtn.innerText = 'Reembolso parcial';
      partialBtn.disabled = isFull;
      const formPartial = document.createElement('form');
      formPartial.className = 'partial-refund-form';
      formPartial.style.display = 'none';
      formPartial.innerHTML = `
        <input type="number" name="partial" step="0.01" min="0.01" max="${amount}" placeholder="Ej: 12.34">
        <button type="submit">Aceptar</button>
        <button type="button" class="cancel-partial">Cancelar</button>
      `;
      const inputPartial = formPartial.querySelector('input');
      const btnCancel = formPartial.querySelector('.cancel-partial');
      partialBtn.addEventListener('click', () => {
        formPartial.style.display = 'flex';
        partialBtn.style.display = 'none';
        inputPartial.focus();
      });
      formPartial.addEventListener('submit', async ev => {
        ev.preventDefault();
        const val = parseFloat(inputPartial.value.replace(',', '.'));
        if (isNaN(val) || val <= 0 || val > parseFloat(amount)) {
          return alert(`Importe inválido (0 < importe ≤ ${amount})`);
        }
        const cents = Math.round(val * 100);
        await refundStripe(c.id, cents, panel);
      });
      btnCancel.addEventListener('click', () => {
        formPartial.style.display = 'none';
        partialBtn.style.display = '';
      });
      const wrapper = document.createElement('div');
      wrapper.className = 'refund-buttons';
      wrapper.append(fullBtn, partialBtn, formPartial);
      li.appendChild(wrapper);
      ul.appendChild(li);
    });
    details.appendChild(ul);
    container.appendChild(details);
  }

  async function loadPayPalTransaction(captureId) {
    try {
      const { paypal_client_id, paypal_secret, paypal_env } = getPayPalConfig();
      const url = `${API_BASE}/get-paypal-transaction?` +
        `captureId=${encodeURIComponent(captureId)}&` +
        `paypal_client_id=${encodeURIComponent(paypal_client_id)}&` +
        `paypal_secret=${encodeURIComponent(paypal_secret)}&` +
        `paypal_env=${encodeURIComponent(paypal_env)}`;
        console.log('🔍 PayPal URL:', url);  // <— y esto
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async function refundPayPal(captureId, amount, currency, panel) {
    try {
      const payload = {
        captureId,
        amount,
        currency_code: currency,
        ...getPayPalConfig()
      };
      const res = await fetch(`${API_BASE}/refund-paypal`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        showMessage(panel, `Reembolso OK (PayPal ID: ${json.refund.id})`);
        await loadPedidos();
      } else {
        showMessage(panel, `Error PayPal: ${json.error}`, 'error');
      }
    } catch (e) {
      console.error(e);
      showMessage(panel, 'Error inesperado PayPal', 'error');
    }
  }

  function renderPayPalTransactions(txs, container, panel) {
    container.innerHTML = '';
    if (!txs.length) {
      container.innerHTML = '<p>No hay transacción PayPal para este pedido.</p>';
      return;
    }
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.innerText = `Ver PayPal (${txs.length})`;
    details.appendChild(summary);
    const ul = document.createElement('ul');
    ul.className = 'paypal-payments';
    txs.forEach(tx => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <strong>${tx.id}</strong> — ${tx.amount.value} ${tx.amount.currency_code}<br>
          Estado: ${tx.status}
        </div>
      `;
      const btnFull = document.createElement('button');
      btnFull.innerText = 'Reembolso completo';
      btnFull.disabled = tx.status !== 'COMPLETED';
      btnFull.addEventListener('click', () =>
        refundPayPal(tx.id, tx.amount.value, tx.amount.currency_code, panel)
      );
      const btnPartial = document.createElement('button');
      btnPartial.innerText = 'Reembolso parcial';
      btnPartial.disabled = tx.status !== 'COMPLETED';
      const formPartial = document.createElement('form');
      formPartial.style.display = 'none';
      formPartial.innerHTML = `
        <input type="number" name="partial" step="0.01" min="0.01" max="${tx.amount.value}" placeholder="Ej: 5.00">
        <button type="submit">Aceptar</button>
        <button type="button" class="cancel">Cancelar</button>
      `;
      btnPartial.addEventListener('click', () => {
        formPartial.style.display = 'inline-block';
        btnPartial.style.display = 'none';
      });
      formPartial.addEventListener('submit', async ev => {
        ev.preventDefault();
        const val = parseFloat(formPartial.partial.value);
        if (val > 0 && val <= parseFloat(tx.amount.value)) {
          await refundPayPal(tx.id, val.toFixed(2), tx.amount.currency_code, panel);
        } else {
          alert('Importe inválido');
        }
      });
      formPartial.querySelector('.cancel').addEventListener('click', () => {
        formPartial.style.display = 'none';
        btnPartial.style.display = '';
      });
      const wrapper2 = document.createElement('div');
      wrapper2.className = 'refund-buttons';
      wrapper2.append(btnFull, btnPartial, formPartial);
      li.appendChild(wrapper2);
      ul.appendChild(li);
    });
    details.appendChild(ul);
    container.appendChild(details);
  }

  async function loadPedidos() {
    const { 'ticket.requester.email': email } = await client.get('ticket.requester.email');
    if (!email) return;
    const resultados = document.getElementById('resultados');
    resultados.innerHTML = '';
  
    try {
      const { woocommerce_url, consumer_key, consumer_secret } = getWooConfig();
      const url = `${API_BASE}/buscar-pedidos?` +
        `email=${encodeURIComponent(email)}&` +
        `woocommerce_url=${encodeURIComponent(woocommerce_url)}&` +
        `consumer_key=${encodeURIComponent(consumer_key)}&` +
        `consumer_secret=${encodeURIComponent(consumer_secret)}`;
      const res = await fetch(url, { headers: getHeaders() });
      const { pedidos } = await res.json();
  
      if (!pedidos.length) {
        resultados.innerHTML = `<p>No hay pedidos para <strong>${email}</strong>.</p>`;
        ajustarAlto();
        return;
      }
  
      // Carga de listas auxiliares
      await loadCities();
      await loadProvincias();
  
      // Aquí reemplazamos todo el forEach:
      for (const pedido of pedidos) {
        console.log('🔍 meta_data del pedido:', pedido.meta_data);
        const acc = document.createElement('button');
        acc.className = 'accordion';
        acc.innerText = `Pedido #${pedido.id} – ${pedido.total} € – ${pedido.status}`;
  
        const panel = document.createElement('div');
        panel.className = 'panel';
  
        // ← Inserción FUNDAMENTAL: guardamos billing y shipping
        panel.dataset.billing  = JSON.stringify(pedido.billing  || {});
        panel.dataset.shipping = JSON.stringify(pedido.shipping || {});
        // ← fin inserción
  
        // Cabecera cliente
        const b = pedido.billing || {};
        panel.innerHTML = `
          <p><strong>Cliente:</strong> ${b.first_name||''} ${b.last_name||''}</p>
          <p><strong>Email:</strong> ${b.email||''}</p>
          <p><strong>Teléfono:</strong> ${b.phone||''}</p>
          <p><strong>Dirección facturación:</strong>
            ${b.address_1||''} ${b.address_2||''}, ${b.postcode||''} ${b.city||''}, ${b.country||''}
          </p>
          <hr>
        `;

        // ——— Sección Stripe ———
const stripeSection = document.createElement('div');
stripeSection.className = 'stripe-section';
stripeSection.innerHTML = '<h4>Cargos Stripe</h4>';
panel.appendChild(stripeSection);

// Carga y renderiza los cargos de Stripe
const charges = b.email
  ? await loadStripeCharges(b.email)
  : [];
renderStripeCharges(charges, stripeSection, panel);

// ——— Sección PayPal ———
// Extraemos el captureId desde meta_data usando el key correcto:
const captureMeta = pedido.meta_data?.find(m => m.key === '_ppcp_paypal_order_id');
const captureId   = captureMeta?.value;

const paypalSection = document.createElement('div');
paypalSection.className = 'paypal-section';
paypalSection.innerHTML = '<h4>Transacción PayPal</h4>';
panel.appendChild(paypalSection);

if (captureId) {
  console.log('🔍 Usando captureId para PayPal:', captureId);
  const txs = await loadPayPalTransaction(captureId);
  renderPayPalTransactions(txs, paypalSection, panel);
} else {
  paypalSection.innerHTML += '<p>No hay transacción PayPal para este pedido.</p>';
}

  
        // Line items
        pedido.line_items.forEach((item, idx) => {
          panel.innerHTML += `
            <div class="producto">
              ${item.image?.src ? `<img src="${item.image.src}" class="producto-img">` : ''}
              <strong>${item.name}</strong><br>
              (x${item.quantity})<br>
              SKU: ${item.sku||'Sin SKU'}<br>
              Variación: ${item.variation_id||'N/A'}<br>
              Precio: ${item.total} €
            </div>
          `;
          // Botones por línea
          const btnEdit = document.createElement('button');
          btnEdit.className = 'btn-edit-item';
          btnEdit.dataset.orderId     = pedido.id;
          btnEdit.dataset.index       = idx;
          btnEdit.dataset.productId   = item.product_id;
          btnEdit.dataset.variationId = item.variation_id||'';
          btnEdit.dataset.quantity    = item.quantity;
          btnEdit.innerText = 'Editar talla/cantidad';
          panel.appendChild(btnEdit);
  
          const btnDel = document.createElement('button');
          btnDel.className = 'btn-delete-item';
          btnDel.dataset.orderId = pedido.id;
          btnDel.dataset.index   = idx;
          btnDel.innerText = 'Eliminar artículo';
          panel.appendChild(btnDel);
        });
  
        // Botón Añadir artículo
        const btnAdd = document.createElement('button');
        btnAdd.className = 'btn-add-item';
        btnAdd.dataset.orderId = pedido.id;
        btnAdd.innerText = 'Añadir artículo';
        panel.appendChild(btnAdd);
  
        // Botón Cambiar estado
        const btnStatus = document.createElement('button');
        btnStatus.className = 'btn-change-status';
        btnStatus.dataset.orderId = pedido.id;
        btnStatus.dataset.status  = pedido.status;
        btnStatus.innerText = 'Cambiar estado';
        panel.appendChild(btnStatus);
  
        // Botón Editar Dirección + formulario oculto
        const btnEditAddr = document.createElement('button');
        btnEditAddr.className = 'btn-edit-address';
        btnEditAddr.dataset.orderId = pedido.id;
        btnEditAddr.innerText = 'Editar Dirección';
        panel.appendChild(btnEditAddr);
  
        const formAddr = document.createElement('form');
        formAddr.className = 'form-address';
        formAddr.dataset.orderId = pedido.id;
        formAddr.style.display = 'none';
        formAddr.innerHTML = `
          <h3>Editar Dirección Pedido #${pedido.id}</h3>
          <!-- Campos se inyectarán al abrir -->
          <button type="button" class="btn-save-address">Guardar Dirección</button>
        `;
        panel.appendChild(formAddr);
  
        resultados.appendChild(acc);
        resultados.appendChild(panel);
  
        acc.addEventListener('click', () => {
          const open = panel.style.display === 'block';
          panel.style.display = open ? 'none' : 'block';
          acc.classList.toggle('active', !open);
          ajustarAlto();
        });
      }
  
      ajustarAlto();
  
    } catch (e) {
      console.error(e);
      document.getElementById('resultados').innerHTML =
        `<p style="color:red;">Error al buscar pedidos.</p>`;
      ajustarAlto();
    }
  }
  

  // Global click listener
  document.addEventListener('click', async e => {
    const { woocommerce_url, consumer_key, consumer_secret } = getWooConfig();

  // --- Reemplazar este bloque completo ---
  // 1) Cambiar estado
  if (e.target.matches('.btn-change-status')) {
    const orderId = e.target.dataset.orderId;
    const currentStatus = e.target.dataset.status;

    // Si ya existe el form, sólo alternamos visibilidad
    let form = e.target.parentNode.querySelector('.status-form');
    if (!form) {
      // 1.1) Crear el contenedor del formulario
      form = document.createElement('div');
      form.className = 'status-form';
      form.style.margin = '8px 0';

      // 1.2) Generar el <select> con todos los estados
      const sel = document.createElement('select');
      orderStatuses.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.slug;
        opt.text  = s.name;
        if (s.slug === currentStatus) opt.selected = true;
        sel.appendChild(opt);
      });
      form.appendChild(sel);

      // 1.3) Botón Aceptar
      const btnOk = document.createElement('button');
      btnOk.innerText = 'Aceptar';
      btnOk.style.margin = '0 4px';
      btnOk.addEventListener('click', async () => {
        const newStatus = sel.value;
        const params = new URLSearchParams({
          order_id: orderId,
          status:   newStatus,
          woocommerce_url,
          consumer_key,
          consumer_secret
        });
        const res = await fetch(`${API_BASE}/cambiar-estado?${params}`, {
          method: 'PUT',
          headers: getHeaders()
        });
        if (res.ok) {
          showMessage(form.parentNode, 'Estado actualizado');
          await loadPedidos();
        } else {
          const err = await res.json();
          showMessage(form.parentNode, `Error: ${err.error}`, 'error');
        }
      });
      form.appendChild(btnOk);

      // 1.4) Botón Cancelar
      const btnCancel = document.createElement('button');
      btnCancel.innerText = 'Cancelar';
      btnCancel.addEventListener('click', () => {
        form.style.display = 'none';
      });
      form.appendChild(btnCancel);

      // 1.5) Añadir al panel
      e.target.parentNode.appendChild(form);
    }

    // Mostrar/ocultar el form
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    return;
  }
  // --- fin del reemplazo ---

   // 2) Editar dirección — abre un formulario con billing+shipping precargados
if (e.target.matches('.btn-edit-address')) {
  const orderId = e.target.dataset.orderId;
  const panel   = e.target.parentNode;
  const billing = JSON.parse(panel.dataset.billing);
  const shipping= JSON.parse(panel.dataset.shipping);

  let form = panel.querySelector('.form-address');
  if (!form._initialized) {
    form._initialized = true;
    form.innerHTML = '';
    form.dataset.orderId = orderId;
    form.style.display = 'none';

    // Helper para crear secciones
    function createSection(type, data) {
      const div = document.createElement('div');
      const title = document.createElement('h4');
      title.innerText = type === 'billing' ? 'Facturación' : 'Envío';
      div.appendChild(title);

      // Campos de texto
      [
        ['first_name','Nombre'],
        ['last_name','Apellidos'],
        ['address_1','Dirección 1'],
        ['address_2','Dirección 2'],
        ['postcode','Código postal']
      ].forEach(([key,labelText]) => {
        const label = document.createElement('label');
        label.innerText = labelText;
        const inp = document.createElement('input');
        inp.name  = `${type}_${key}`;
        inp.value = data[key] || '';
        label.appendChild(inp);
        div.appendChild(label);
      });

      // Ciudad (select)
      const lblCity = document.createElement('label');
      lblCity.innerText = 'Ciudad';
      const selCity = document.createElement('select');
      selCity.name = `${type}_city`;
      citiesList.forEach(c => {
        const o = document.createElement('option');
        o.value = o.text = c;
        if (c === data.city) o.selected = true;
        selCity.appendChild(o);
      });
      lblCity.appendChild(selCity);
      div.appendChild(lblCity);

      // Provincia (select)
      const lblProv = document.createElement('label');
      lblProv.innerText = 'Provincia';
      const selProv = document.createElement('select');
      selProv.name = `${type}_state`;
      provincesList.forEach(s => {
        const o = document.createElement('option');
        o.value = o.text = s;
        if (s === data.state) o.selected = true;
        selProv.appendChild(o);
      });
      lblProv.appendChild(selProv);
      div.appendChild(lblProv);

      return div;
    }

    // Añadimos las dos secciones
    form.appendChild(createSection('billing',  billing));
    form.appendChild(createSection('shipping', shipping));

    // Botones Aceptar / Cancelar
    const btnSave = document.createElement('button');
    btnSave.type = 'button';
    btnSave.className = 'btn-save-address';
    btnSave.innerText = 'Aceptar';
    form.appendChild(btnSave);

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'btn-cancel-address';
    btnCancel.innerText = 'Cancelar';
    btnCancel.style.margin = '0 4px';
    btnCancel.addEventListener('click', () => {
      form.style.display = 'none';
    });
    form.appendChild(btnCancel);
  }

  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  return;
}

// 3) Guardar dirección — envía billing + shipping al backend
if (e.target.matches('.btn-save-address')) {
  const form = e.target.closest('.form-address');
  const orderId = form.dataset.orderId;

  const billing = {
    first_name: form.querySelector('input[name="billing_first_name"]').value,
    last_name:  form.querySelector('input[name="billing_last_name"]').value,
    address_1:  form.querySelector('input[name="billing_address_1"]').value,
    address_2:  form.querySelector('input[name="billing_address_2"]').value,
    postcode:   form.querySelector('input[name="billing_postcode"]').value,
    city:       form.querySelector('select[name="billing_city"]').value,
    state:      form.querySelector('select[name="billing_state"]').value
  };

  const shipping = {
    first_name: form.querySelector('input[name="shipping_first_name"]').value,
    last_name:  form.querySelector('input[name="shipping_last_name"]').value,
    address_1:  form.querySelector('input[name="shipping_address_1"]').value,
    address_2:  form.querySelector('input[name="shipping_address_2"]').value,
    postcode:   form.querySelector('input[name="shipping_postcode"]').value,
    city:       form.querySelector('select[name="shipping_city"]').value,
    state:      form.querySelector('select[name="shipping_state"]').value
  };

  const params = new URLSearchParams({
    order_id: orderId,
    billing:  encodeURIComponent(JSON.stringify(billing)),
    shipping: encodeURIComponent(JSON.stringify(shipping)),
    woocommerce_url,
    consumer_key,
    consumer_secret
  });

  const res = await fetch(
    `${API_BASE}/editar-direccion?${params}`,
    { method: 'PUT', headers: getHeaders() }
  );

  if (res.ok) {
    showMessage(form.parentNode, 'Dirección actualizada');
    await loadPedidos();
  } else {
    const err = await res.json();
    showMessage(form.parentNode, `Error: ${err.error}`, 'error');
  }

  return;
}


    // 4) Eliminar artículo (con cambio previo a pendiente)
    if (e.target.matches('.btn-delete-item')) {
      const orderId  = e.target.dataset.orderId;
      const lineIndex = e.target.dataset.index;

      // 4.1) Crear / reusar el form de confirmación
      let form = e.target.parentNode.querySelector('.delete-item-form');
      if (!form) {
        form = document.createElement('div');
        form.className = 'delete-item-form';
        form.style.margin = '8px 0';

        // Mensaje informativo
        const info = document.createElement('p');
        info.innerText = 
          'Antes de eliminar este artículo, el pedido pasará a "Pendiente de pago". ¿Continuar?';
        form.appendChild(info);

        // Botón Confirmar
        const btnConfirm = document.createElement('button');
        btnConfirm.innerText = 'Confirmar';
        btnConfirm.style.margin = '0 4px';
        btnConfirm.addEventListener('click', async () => {
          const qc = getWooConfig();

          // 1) Cambiar estado a pending
          const paramsStatus = new URLSearchParams({
            order_id: orderId,
            status:   'pending',
            woocommerce_url: qc.woocommerce_url,
            consumer_key:    qc.consumer_key,
            consumer_secret: qc.consumer_secret
          });
          const resStatus = await fetch(
            `${API_BASE}/cambiar-estado?${paramsStatus}`, 
            { method: 'PUT', headers: getHeaders() }
          );
          if (!resStatus.ok) {
            const err = await resStatus.json();
            showMessage(form.parentNode, `Error al cambiar estado: ${err.error}`, 'error');
            return;
          }

          // 2) Eliminar el ítem
          const paramsDel = new URLSearchParams({
            order_id:    orderId,
            line_index:  lineIndex,
            woocommerce_url: qc.woocommerce_url,
            consumer_key:    qc.consumer_key,
            consumer_secret: qc.consumer_secret
          });
          const resDel = await fetch(
            `${API_BASE}/eliminar-item?${paramsDel}`,
            { method: 'DELETE', headers: getHeaders() }
          );
          if (resDel.ok) {
            showMessage(form.parentNode, 'Artículo eliminado');
            await loadPedidos();
          } else {
            const err2 = await resDel.json();
            showMessage(form.parentNode, `Error al eliminar: ${err2.error}`, 'error');
          }
        });
        form.appendChild(btnConfirm);

        // Botón Cancelar
        const btnCancel = document.createElement('button');
        btnCancel.innerText = 'Cancelar';
        btnCancel.addEventListener('click', () => {
          form.style.display = 'none';
        });
        form.appendChild(btnCancel);

        // Añadir al DOM
        e.target.parentNode.appendChild(form);
      }

      // 4.2) Mostrar/ocultar el form
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
      return;
    }


// 5) Editar talla/cantidad (pending → delete → add)
if (e.target.matches('.btn-edit-item')) {
  const orderId    = e.target.dataset.orderId;
  const lineIndex  = e.target.dataset.index;
  const productId  = e.target.dataset.productId;
  const oldVarId   = e.target.dataset.variationId;
  const oldQuantity= e.target.dataset.quantity;

  // 5.1) Crear / reusar formulario
  let form = e.target.parentNode.querySelector('.edit-item-form');
  if (!form) {
    form = document.createElement('div');
    form.className = 'edit-item-form';
    form.style.margin = '8px 0';

    // 5.2) Select de variaciones
    const selVar = document.createElement('select');
    selVar.innerHTML = `<option value="">— Selecciona variación —</option>`;
    form.appendChild(selVar);

    // 5.3) Input de cantidad
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min  = '1';
    qtyInput.value= oldQuantity;
    qtyInput.placeholder = 'Cantidad';
    qtyInput.style.margin = '0 4px';
    form.appendChild(qtyInput);

    // 5.4) Botones Aceptar / Cancelar
    const btnOk = document.createElement('button');
    btnOk.innerText = 'Aceptar';
    btnOk.disabled = true;
    form.appendChild(btnOk);

    const btnCancel = document.createElement('button');
    btnCancel.innerText = 'Cancelar';
    btnCancel.style.margin = '0 4px';
    btnCancel.addEventListener('click', () => form.style.display = 'none');
    form.appendChild(btnCancel);

    // 5.5) Habilitar Aceptar sólo si hay variación y cantidad
    selVar.addEventListener('change', () => {
      btnOk.disabled = !(selVar.value && qtyInput.value);
    });
    qtyInput.addEventListener('input', () => {
      btnOk.disabled = !(selVar.value && qtyInput.value);
    });

    // 5.6) Cargar variaciones del producto
    (async () => {
      const { woocommerce_url, consumer_key, consumer_secret } = getWooConfig();
      const paramsVar = new URLSearchParams({
        product_id:  productId,
        woocommerce_url, consumer_key, consumer_secret
      });
      const resVar = await fetch(`${API_BASE}/get-variaciones?${paramsVar}`, {
        headers: getHeaders()
      });
      const vars = await resVar.json();
      vars.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.text  = v.attributes.map(a => `${a.name}: ${a.option}`).join(', ');
        if (v.id == oldVarId) opt.selected = true;
        selVar.appendChild(opt);
      });
      // Si al cargar ya están ambos, habilita Ok
      if (selVar.value && qtyInput.value) btnOk.disabled = false;
    })();

    // 5.7) Al hacer click en Aceptar, secuencia pending → delete → add
    btnOk.addEventListener('click', async () => {
      const newVarId = selVar.value;
      const newQty   = qtyInput.value;
      const qc       = getWooConfig();

      // A) Cambiar estado a pending
      let p1 = new URLSearchParams({
        order_id:       orderId,
        status:         'pending',
        woocommerce_url: qc.woocommerce_url,
        consumer_key:    qc.consumer_key,
        consumer_secret: qc.consumer_secret
      });
      const r1 = await fetch(`${API_BASE}/cambiar-estado?${p1}`, {
        method: 'PUT', headers: getHeaders()
      });
      if (!r1.ok) {
        const err = await r1.json();
        return showMessage(form.parentNode, `Error estado: ${err.error}`, 'error');
      }

      // B) Eliminar línea original
      let p2 = new URLSearchParams({
        order_id:        orderId,
        line_index:      lineIndex,
        woocommerce_url: qc.woocommerce_url,
        consumer_key:    qc.consumer_key,
        consumer_secret: qc.consumer_secret
      });
      const r2 = await fetch(`${API_BASE}/eliminar-item?${p2}`, {
        method: 'DELETE', headers: getHeaders()
      });
      if (!r2.ok) {
        const err = await r2.json();
        return showMessage(form.parentNode, `Error eliminar: ${err.error}`, 'error');
      }

      // C) Añadir línea nueva
      const payload = {
        ...qc,
        product_id:   Number(productId),
        variation_id: Number(newVarId),
        quantity:     Number(newQty)
      };
      const r3 = await fetch(`${API_BASE}/anadir-item?order_id=${orderId}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (r3.ok) {
        showMessage(form.parentNode, 'Artículo actualizado');
        await loadPedidos();
      } else {
        const err = await r3.json();
        showMessage(form.parentNode, `Error añadir: ${err.error}`, 'error');
      }
    });

    // Insertar el form en el DOM
    e.target.parentNode.appendChild(form);
  }

  // Mostrar/ocultar
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  return;
}


    // 6) Añadir artículo (nuevo flujo con selects y variaciones)
    if (e.target.matches('.btn-add-item')) {
      const orderId = e.target.dataset.orderId;

      // 1) Crear / reusar formulario
      let form = e.target.parentNode.querySelector('.add-item-form');
      if (!form) {
        form = document.createElement('div');
        form.className = 'add-item-form';
        form.style.margin = '8px 0';

        // 2) Selector de productos
        const selProd = document.createElement('select');
        selProd.innerHTML = `<option value="">— Selecciona producto —</option>`;
        productsList.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.text  = p.name;
          selProd.appendChild(opt);
        });
        form.appendChild(selProd);

        // 3) Selector de variaciones (oculto inicialmente)
        const selVar = document.createElement('select');
        selVar.style.display = 'none';
        selVar.innerHTML = `<option value="">— Selecciona variación —</option>`;
        form.appendChild(selVar);

        // 4) Input de cantidad
        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.min = '1';
        qtyInput.placeholder = 'Cantidad';
        qtyInput.style.margin = '0 4px';
        form.appendChild(qtyInput);

        // 5) Botón Aceptar
        const btnOk = document.createElement('button');
        btnOk.innerText = 'Aceptar';
        btnOk.disabled = true; // hasta que el usuario seleccione un producto
        form.appendChild(btnOk);

        // 6) Botón Cancelar
        const btnCancel = document.createElement('button');
        btnCancel.innerText = 'Cancelar';
        btnCancel.style.margin = '0 4px';
        btnCancel.addEventListener('click', () => {
          form.style.display = 'none';
        });
        form.appendChild(btnCancel);

        // 7) Al cambiar producto, cargar variaciones
        selProd.addEventListener('change', async () => {
          const prodId = selProd.value;
          selVar.innerHTML = `<option value="">— Selecciona variación —</option>`;
          if (!prodId) {
            selVar.style.display = 'none';
            btnOk.disabled = true;
            return;
          }
          // Llamada a get-variaciones
          const qc = getWooConfig();
          const paramsVar = new URLSearchParams({
            product_id:   prodId,
            ...qc
          });
          const resVar = await fetch(`${API_BASE}/get-variaciones?${paramsVar}`, {
            headers: getHeaders()
          });
          const vars = await resVar.json();
          if (Array.isArray(vars) && vars.length) {
            vars.forEach(v => {
              const opt = document.createElement('option');
              opt.value = v.id;
              // Mostrar p.ej. "Talla: M, Color: Rojo"
              opt.text = v.attributes
                .map(a => `${a.name}: ${a.option}`)
                .join(', ');
              selVar.appendChild(opt);
            });
            selVar.style.display = '';
          } else {
            selVar.style.display = 'none';
          }
          btnOk.disabled = false;
        });

        // 8) Al pulsar Aceptar, envío al backend
        btnOk.addEventListener('click', async () => {
          const prodId = selProd.value;
          const varId  = selVar.style.display==='none' ? null : selVar.value;
          const qty    = qtyInput.value;
          if (!prodId || !qty || (selVar.style.display!== 'none' && !varId)) {
            return alert('Completa todos los campos.');
          }
          const body = {
            product_id: Number(prodId),
            quantity:   Number(qty),
            ...(varId ? { variation_id: Number(varId) } : {})
          };
          // Incluir credenciales en el body, que tu endpoint espera JSON
          const payload = {
            ...getWooConfig(),
            ...body
          };
          const res = await fetch(`${API_BASE}/anadir-item?order_id=${orderId}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            showMessage(form.parentNode, 'Artículo añadido');
            await loadPedidos();
          } else {
            const err = await res.json();
            showMessage(form.parentNode, `Error: ${err.error}`, 'error');
          }
        });

        // Añadir el formulario al panel
        e.target.parentNode.appendChild(form);
      }

      // 9) Mostrar/ocultar el form
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
      return;
    }

  });

  // Initialize
  await loadOrderStatuses();
  await loadProducts();
  await loadCities();
  await loadProvincias();
  await loadPedidos();
});
