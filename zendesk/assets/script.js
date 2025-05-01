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

      await loadCities();
      await loadProvincias();

      pedidos.forEach(pedido => {
        const acc = document.createElement('button');
        acc.className = 'accordion';
        acc.innerText = `Pedido #${pedido.id} – ${pedido.total} € – ${pedido.status}`;
        const panel = document.createElement('div');
        panel.className = 'panel';

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
            <button class="btn-edit-item" data-order-id="${pedido.id}" data-index="${idx}">Editar talla/cantidad</button>
            <button class="btn-delete-item" data-order-id="${pedido.id}" data-index="${idx}">Eliminar artículo</button>
          `;
        });

        // Añadir artículo
        const btnAdd = document.createElement('button');
        btnAdd.className = 'btn-add-item';
        btnAdd.dataset.orderId = pedido.id;
        btnAdd.innerText = 'Añadir artículo';
        panel.appendChild(btnAdd);

        // Cambiar estado
        const btnStatus = document.createElement('button');
        btnStatus.className = 'btn-change-status';
        btnStatus.dataset.orderId = pedido.id;
        btnStatus.dataset.status = pedido.status;
        btnStatus.innerText = 'Cambiar estado';
        panel.appendChild(btnStatus);

        // Editar dirección
        const btnEditAddr = document.createElement('button');
        btnEditAddr.className = 'btn-edit-address';
        btnEditAddr.dataset.orderId = pedido.id;
        btnEditAddr.innerText = 'Editar Dirección';
        panel.appendChild(btnEditAddr);

        // Formulario dirección oculto
        const formAddr = document.createElement('form');
        formAddr.className = 'form-address';
        formAddr.dataset.orderId = pedido.id;
        formAddr.style.display = 'none';
        formAddr.innerHTML = `
          <h3>Editar Dirección Pedido #${pedido.id}</h3>
          <!-- campos de dirección aquí -->
          <button type="button" class="btn-save-address">Guardar Dirección</button>
        `;
        panel.appendChild(formAddr);

        resultados.appendChild(acc);
        resultados.appendChild(panel);

        acc.addEventListener('click', () => {
          const isOpen = panel.style.display === 'block';
          panel.style.display = isOpen ? 'none' : 'block';
          acc.classList.toggle('active', !isOpen);
          ajustarAlto();
        });
      });

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

    // 2) Mostrar/ocultar formulario de dirección
    if (e.target.matches('.btn-edit-address')) {
      const form = e.target.parentNode.querySelector('.form-address');
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
      return;
    }

    // 3) Guardar dirección
    if (e.target.matches('.btn-save-address')) {
      const form = e.target.closest('.form-address');
      const orderId = form.dataset.orderId;
      const billing = { /* extrae valores */ };
      const shipping = { /* extrae valores */ };
      const params = new URLSearchParams({
        order_id: orderId,
        billing:  encodeURIComponent(JSON.stringify(billing)),
        shipping: encodeURIComponent(JSON.stringify(shipping)),
        woocommerce_url,
        consumer_key,
        consumer_secret
      });
      const res = await fetch(`${API_BASE}/editar-direccion?${params}`, { method: 'PUT', headers: getHeaders() });
      if (res.ok) {
        showMessage(form.parentNode, 'Dirección actualizada');
        await loadPedidos();
      } else {
        const err = await res.json();
        showMessage(form.parentNode, `Error: ${err.error}`, 'error');
      }
      return;
    }

    // 4) Eliminar artículo
    if (e.target.matches('.btn-delete-item')) {
      const orderId = e.target.dataset.orderId;
      const index   = e.target.dataset.index;
      const params  = new URLSearchParams({ order_id: orderId, line_index: index, woocommerce_url, consumer_key, consumer_secret });
      const res = await fetch(`${API_BASE}/eliminar-item?${params}`, { method: 'DELETE', headers: getHeaders() });
      if (res.ok) {
        showMessage(e.target.parentNode, 'Artículo eliminado');
        await loadPedidos();
      } else {
        const err = await res.json();
        showMessage(e.target.parentNode, `Error: ${err.error}`, 'error');
      }
      return;
    }

    // 5) Editar talla/cantidad
    if (e.target.matches('.btn-edit-item')) {
      const orderId = e.target.dataset.orderId;
      const index   = e.target.dataset.index;
      const qty     = prompt('Nueva cantidad:');
      if (!qty) return;
      const variation = prompt('ID variación (opcional):');
      const params = new URLSearchParams({
        order_id: orderId,
        line_index: index,
        quantity: qty,
        woocommerce_url,
        consumer_key,
        consumer_secret
      });
      if (variation) params.set('variation_id', variation);
      const res = await fetch(`${API_BASE}/editar-item?${params}`, { method: 'PUT', headers: getHeaders() });
      if (res.ok) {
        showMessage(e.target.parentNode, 'Artículo actualizado');
        await loadPedidos();
      } else {
        const err = await res.json();
        showMessage(e.target.parentNode, `Error: ${err.error}`, 'error');
      }
      return;
    }

    // 6) Añadir artículo
    if (e.target.matches('.btn-add-item')) {
      const orderId   = e.target.dataset.orderId;
      const productId = prompt('ID de producto a añadir:');
      if (!productId) return;
      const qty       = prompt('Cantidad:');
      if (!qty) return;
      const body = {
        product_id: Number(productId),
        quantity:   Number(qty),
        woocommerce_url,
        consumer_key,
        consumer_secret
      };
      const res = await fetch(`${API_BASE}/anadir-item?order_id=${orderId}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body)
      });
      if (res.ok) {
        showMessage(e.target, 'Artículo añadido');
        await loadPedidos();
      } else {
        const err = await res.json();
        showMessage(e.target, `Error: ${err.error}`, 'error');
      }
    }
  });

  // Initialize
  await loadOrderStatuses();
  await loadProducts();
  await loadCities();
  await loadProvincias();
  await loadPedidos();
});
