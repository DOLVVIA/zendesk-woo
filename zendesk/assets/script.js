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
      console.log('🔍 Stripe URL:', url);
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
      let statusTxt, badgeClass;
      if (isFull) {
        statusTxt = 'Reembolsado';
        badgeClass = 'success';
      } else if (isPartial) {
        statusTxt = `Parcial (${refunded.toFixed(2)} €)`;
        badgeClass = 'success';
      } else if (c.status === 'succeeded') {
        statusTxt = 'Exitoso';
        badgeClass = 'success';
      } else {
        statusTxt = 'Fallido';
        badgeClass = 'failed';
      }
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="payment-info">
          <span>${title} — ${amount} €</span>
          <span class="badge ${badgeClass}">${statusTxt}</span>
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

  async function refundPayPal(captureId, amount, panel) {
    try {
      const payload = { transactionId: captureId, amount };
      const res = await fetch(`${API_BASE}/refund-paypal`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const j = await res.json();
      if (res.ok) {
        showMessage(panel, `Reembolso OK (ID: ${j.id || j.refund?.id})`);
        await loadPedidos();
      } else {
        showMessage(panel, `Error reembolso: ${j.error}`, 'error');
      }
    } catch (e) {
      console.error('Error inesperado en reembolso PayPal:', e);
      showMessage(panel, 'Error inesperado al reembolsar PayPal', 'error');
    }
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

      for (const pedido of pedidos) {
        console.log('🔍 meta_data del pedido:', pedido.meta_data);

        const acc = document.createElement('button');
        acc.className = 'accordion';
        acc.innerText = `Pedido #${pedido.id} – ${pedido.total} € – ${pedido.status}`;

        const panel = document.createElement('div');
        panel.className = 'panel';
        panel.dataset.billing  = JSON.stringify(pedido.billing  || {});
        panel.dataset.shipping = JSON.stringify(pedido.shipping || {});

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

        // Line items + botones WooCommerce
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

        // Botones Añadir artículo, Cambiar estado, Editar dirección
        const btnAdd = document.createElement('button');
        btnAdd.className = 'btn-add-item';
        btnAdd.dataset.orderId = pedido.id;
        btnAdd.innerText = 'Añadir artículo';
        panel.appendChild(btnAdd);

        const btnStatus = document.createElement('button');
        btnStatus.className = 'btn-change-status';
        btnStatus.dataset.orderId = pedido.id;
        btnStatus.dataset.status  = pedido.status;
        btnStatus.innerText = 'Cambiar estado';
        panel.appendChild(btnStatus);

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
          <button type="button" class="btn-save-address">Guardar Dirección</button>
        `;
        panel.appendChild(formAddr);

        // Sección Stripe (al final)
        {
          const charges = b.email ? await loadStripeCharges(b.email) : [];
          const stripeContainer = document.createElement('div');
          stripeContainer.className = 'stripe-container';
          renderStripeCharges(charges, stripeContainer, panel);
          panel.appendChild(stripeContainer);
        }

// … justo después de la sección Stripe …

// Sección PayPal (al final)
{
  const metaArr = Array.isArray(pedido.meta_data) ? pedido.meta_data : [];
  let captureId = null, paypalOrderId = null;
  for (let { key, value } of metaArr) {
    const norm = key.replace(/[\s\-_]/g,'').toLowerCase();
    if (/paypal.*capture.*id/.test(norm) || /paypal.*transaction.*id/.test(norm)) {
      captureId = value;
      break;
    }
  }
  if (!captureId) {
    const entry = metaArr.find(({ key }) => {
      const norm = key.replace(/[\s\-_]/g,'').toLowerCase();
      return /ppcp_paypal_order_id/.test(norm) || /paypal.*order.*id/.test(norm);
    });
    paypalOrderId = entry?.value || null;
  }

  const paypalDetails = document.createElement('details');
  paypalDetails.className = 'paypal-payments';
  const sumP = document.createElement('summary');
  sumP.innerText = 'Cargando PayPal…';
  paypalDetails.appendChild(sumP);

  const contentDiv = document.createElement('div');
  contentDiv.className = 'paypal-content';

  if (!captureId && !paypalOrderId) {
    contentDiv.innerHTML = '<p>No hay ningún ID de PayPal en meta_data.</p>';
    paypalDetails.appendChild(contentDiv);
    panel.appendChild(paypalDetails);
  } else {
    const { paypal_client_id, paypal_secret, paypal_mode } = SETTINGS;
    if (!paypal_client_id || !paypal_secret) {
      contentDiv.innerHTML = '<p style="color:red;">Faltan credenciales PayPal en configuración.</p>';
      paypalDetails.appendChild(contentDiv);
      panel.appendChild(paypalDetails);
    } else {
      // Montamos la query con email + credenciales
      const params = new URLSearchParams();
      params.set('email', b.email);
      params.set('paypal_client_id', paypal_client_id);
      params.set('paypal_secret', paypal_secret);
      params.set('paypal_mode', paypal_mode || 'live');

      fetch(`${API_BASE}/get-paypal-transactions?${params}`, {
        headers: getHeaders()
      })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(transactions => {
        // Ajustamos el summary
        sumP.innerText = `Ver transacciones PayPal (${transactions.length})`;

        // Si no hay transacciones
        if (!transactions.length) {
          contentDiv.innerHTML = '<p>No hay transacciones PayPal para este email.</p>';
        } else {
          // Limpiamos
          contentDiv.innerHTML = '';
          // Pintamos cada transacción
          transactions.forEach(tx => {
            const amt = `${tx.amount.value} ${tx.amount.currency_code}`;
            const statusTxt = tx.status === 'COMPLETED' ? 'Éxitoso' : tx.status;
            const badgeClass = tx.status === 'COMPLETED' ? 'success' : 'failed';

            const item = document.createElement('div');
            item.className = 'payment-info';
            item.innerHTML = `
              <span>${tx.id} — ${amt}</span>
              <span class="badge ${badgeClass}">${statusTxt}</span>
            `;

            // Botones reembolso
            const btnFull = document.createElement('button');
            btnFull.innerText = 'Reembolso completo';
            btnFull.disabled = tx.status !== 'COMPLETED';
            btnFull.addEventListener('click', () =>
              refundPayPal(tx.id, tx.amount.value, panel)
            );

            const btnPart = document.createElement('button');
            btnPart.innerText = 'Reembolso parcial';

            const formPart = document.createElement('form');
            formPart.className = 'partial-refund-form';
            formPart.style.display = 'none';
            formPart.innerHTML = `
              <input type="number" name="partial" step="0.01" min="0.01" max="${tx.amount.value}" placeholder="Ej: 12.34">
              <button type="submit">Aceptar</button>
              <button type="button" class="cancel-partial">Cancelar</button>
            `;

            btnPart.addEventListener('click', () => {
              formPart.style.display = 'flex';
              btnPart.style.display = 'none';
              formPart.querySelector('input').focus();
            });
            formPart.querySelector('.cancel-partial').addEventListener('click', () => {
              formPart.style.display = 'none';
              btnPart.style.display = '';
            });
            formPart.addEventListener('submit', async ev => {
              ev.preventDefault();
              const val = parseFloat(formPart.partial.value.replace(',', '.'));
              if (!val || val <= 0 || val > parseFloat(tx.amount.value)) {
                return alert(`Importe inválido (0 < importe ≤ ${tx.amount.value})`);
              }
              await refundPayPal(tx.id, val, panel);
            });

            const wrap = document.createElement('div');
            wrap.className = 'refund-buttons';
            wrap.append(btnFull, btnPart, formPart);

            item.appendChild(wrap);
            contentDiv.appendChild(item);
          });
        }

        paypalDetails.appendChild(contentDiv);
        panel.appendChild(paypalDetails);
      })
      .catch(err => {
        console.error('⚠️ Error cargando PayPal:', err);
        contentDiv.innerHTML = '<p style="color:red;">Error cargando PayPal.</p>';
        paypalDetails.appendChild(contentDiv);
        panel.appendChild(paypalDetails);
      });
    }
  }
}
// Fin Sección PayPal

// … aquí continúa tu código normal: resultados.appendChild(acc), etc. …

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

  // Global click listener: estado, dirección, editar, eliminar, etc.
  document.addEventListener('click', async e => {
    const { woocommerce_url, consumer_key, consumer_secret } = getWooConfig();

    // 1) Cambiar estado
    if (e.target.matches('.btn-change-status')) {
      const orderId = e.target.dataset.orderId;
      const currentStatus = e.target.dataset.status;
      let form = e.target.parentNode.querySelector('.status-form');
      if (!form) {
        form = document.createElement('div');
        form.className = 'status-form';
        form.style.margin = '8px 0';
        const sel = document.createElement('select');
        orderStatuses.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.slug;
          opt.text = s.name;
          if (s.slug === currentStatus) opt.selected = true;
          sel.appendChild(opt);
        });
        form.appendChild(sel);
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
        const btnCancel = document.createElement('button');
        btnCancel.innerText = 'Cancelar';
        btnCancel.addEventListener('click', () => { form.style.display = 'none'; });
        form.appendChild(btnCancel);
        e.target.parentNode.appendChild(form);
      }
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
      return;
    }

    // 2) Editar dirección
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
        function createSection(type, data) {
          const div = document.createElement('div');
          const title = document.createElement('h4');
          title.innerText = type === 'billing' ? 'Facturación' : 'Envío';
          div.appendChild(title);
          [['first_name','Nombre'],['last_name','Apellidos'],['address_1','Dirección 1'],['address_2','Dirección 2'],['postcode','Código postal']]
            .forEach(([key,labelText]) => {
              const label = document.createElement('label');
              label.innerText = labelText;
              const inp = document.createElement('input');
              inp.name  = `${type}_${key}`;
              inp.value = data[key] || '';
              label.appendChild(inp);
              div.appendChild(label);
            });
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
        form.appendChild(createSection('billing', billing));
        form.appendChild(createSection('shipping', shipping));
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
        btnCancel.addEventListener('click', () => { form.style.display = 'none'; });
        form.appendChild(btnCancel);
      }
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
      return;
    }

    // 3) Guardar dirección
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
        billing: encodeURIComponent(JSON.stringify(billing)),
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
      const orderId  = e.target.dataset.orderId;
      const lineIndex = e.target.dataset.index;
      let form = e.target.parentNode.querySelector('.delete-item-form');
      if (!form) {
        form = document.createElement('div');
        form.className = 'delete-item-form';
        form.style.margin = '8px 0';
        const info = document.createElement('p');
        info.innerText =
          'Antes de eliminar este artículo, el pedido pasará a "Pendiente de pago". ¿Continuar?';
        form.appendChild(info);
        const btnConfirm = document.createElement('button');
        btnConfirm.innerText = 'Confirmar';
        btnConfirm.style.margin = '0 4px';
        btnConfirm.addEventListener('click', async () => {
          const qc = getWooConfig();
          const paramsStatus = new URLSearchParams({
            order_id: orderId,
            status: 'pending',
            woocommerce_url: qc.woocommerce_url,
            consumer_key: qc.consumer_key,
            consumer_secret: qc.consumer_secret
          });
          const resStatus = await fetch(`${API_BASE}/cambiar-estado?${paramsStatus}`, {
            method: 'PUT',
            headers: getHeaders()
          });
          if (!resStatus.ok) {
            const err = await resStatus.json();
            showMessage(form.parentNode, `Error al cambiar estado: ${err.error}`, 'error');
            return;
          }
          const paramsDel = new URLSearchParams({
            order_id: orderId,
            line_index: lineIndex,
            woocommerce_url: qc.woocommerce_url,
            consumer_key: qc.consumer_key,
            consumer_secret: qc.consumer_secret
          });
          const resDel = await fetch(`${API_BASE}/eliminar-item?${paramsDel}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          if (resDel.ok) {
            showMessage(form.parentNode, 'Artículo eliminado');
            await loadPedidos();
          } else {
            const err2 = await resDel.json();
            showMessage(form.parentNode, `Error al eliminar: ${err2.error}`, 'error');
          }
        });
        form.appendChild(btnConfirm);
        const btnCancel = document.createElement('button');
        btnCancel.innerText = 'Cancelar';
        btnCancel.addEventListener('click', () => { form.style.display = 'none'; });
        form.appendChild(btnCancel);
        e.target.parentNode.appendChild(form);
      }
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
      return;
    }

    // 5) Editar talla/cantidad
    if (e.target.matches('.btn-edit-item')) {
      const orderId    = e.target.dataset.orderId;
      const lineIndex  = e.target.dataset.index;
      const productId  = e.target.dataset.productId;
      const oldVarId   = e.target.dataset.variationId;
      const oldQuantity= e.target.dataset.quantity;
      let form = e.target.parentNode.querySelector('.edit-item-form');
      if (!form) {
        form = document.createElement('div');
        form.className = 'edit-item-form';
        form.style.margin = '8px 0';
        const selVar = document.createElement('select');
        selVar.innerHTML = `<option value="">— Selecciona variación —</option>`;
        form.appendChild(selVar);
        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.min  = '1';
        qtyInput.value= oldQuantity;
        qtyInput.placeholder = 'Cantidad';
        qtyInput.style.margin = '0 4px';
        form.appendChild(qtyInput);
        const btnOk = document.createElement('button');
        btnOk.innerText = 'Aceptar';
        btnOk.disabled = true;
        form.appendChild(btnOk);
        const btnCancel = document.createElement('button');
        btnCancel.innerText = 'Cancelar';
        btnCancel.style.margin = '0 4px';
        btnCancel.addEventListener('click', () => form.style.display = 'none');
        form.appendChild(btnCancel);
        selVar.addEventListener('change', () => {
          btnOk.disabled = !(selVar.value && qtyInput.value);
        });
        qtyInput.addEventListener('input', () => {
          btnOk.disabled = !(selVar.value && qtyInput.value);
        });
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
          if (selVar.value && qtyInput.value) btnOk.disabled = false;
        })();
        btnOk.addEventListener('click', async () => {
          const newVarId = selVar.value;
          const newQty   = qtyInput.value;
          const qc       = getWooConfig();
          const p1 = new URLSearchParams({
            order_id: orderId,
            status: 'pending',
            woocommerce_url: qc.woocommerce_url,
            consumer_key: qc.consumer_key,
            consumer_secret: qc.consumer_secret
          });
          const r1 = await fetch(`${API_BASE}/cambiar-estado?${p1}`, {
            method: 'PUT', headers: getHeaders()
          });
          if (!r1.ok) {
            const err = await r1.json();
            return showMessage(form.parentNode, `Error estado: ${err.error}`, 'error');
          }
          const p2 = new URLSearchParams({
            order_id: orderId,
            line_index: lineIndex,
            woocommerce_url: qc.woocommerce_url,
            consumer_key: qc.consumer_key,
            consumer_secret: qc.consumer_secret
          });
          const r2 = await fetch(`${API_BASE}/eliminar-item?${p2}`, {
            method: 'DELETE', headers: getHeaders()
          });
          if (!r2.ok) {
            const err = await r2.json();
            return showMessage(form.parentNode, `Error eliminar: ${err.error}`, 'error');
          }
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
        e.target.parentNode.appendChild(form);
      }
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
      return;
    }

    // 6) Añadir artículo
    if (e.target.matches('.btn-add-item')) {
      const orderId = e.target.dataset.orderId;
      let form = e.target.parentNode.querySelector('.add-item-form');
      if (!form) {
        form = document.createElement('div');
        form.className = 'add-item-form';
        form.style.margin = '8px 0';
        const selProd = document.createElement('select');
        selProd.innerHTML = `<option value="">— Selecciona producto —</option>`;
        productsList.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.text  = p.name;
          selProd.appendChild(opt);
        });
        form.appendChild(selProd);
        const selVar = document.createElement('select');
        selVar.style.display = 'none';
        selVar.innerHTML = `<option value="">— Selecciona variación —</option>`;
        form.appendChild(selVar);
        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.min = '1';
        qtyInput.placeholder = 'Cantidad';
        qtyInput.style.margin = '0 4px';
        form.appendChild(qtyInput);
        const btnOk = document.createElement('button');
        btnOk.innerText = 'Aceptar';
        btnOk.disabled = true;
        form.appendChild(btnOk);
        const btnCancel = document.createElement('button');
        btnCancel.innerText = 'Cancelar';
        btnCancel.style.margin = '0 4px';
        btnCancel.addEventListener('click', () => { form.style.display = 'none'; });
        form.appendChild(btnCancel);
        selProd.addEventListener('change', async () => {
          const prodId = selProd.value;
          selVar.innerHTML = `<option value="">— Selecciona variación —</option>`;
          if (!prodId) {
            selVar.style.display = 'none';
            btnOk.disabled = true;
            return;
          }
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
              opt.text = v.attributes.map(a => `${a.name}: ${a.option}`).join(', ');
              selVar.appendChild(opt);
            });
            selVar.style.display = '';
          } else {
            selVar.style.display = 'none';
          }
          btnOk.disabled = false;
        });
        btnOk.addEventListener('click', async () => {
          const prodId = selProd.value;
          const varId  = selVar.style.display==='none' ? null : selVar.value;
          const qty    = qtyInput.value;
          if (!prodId || !qty || (selVar.style.display!=='none' && !varId)) {
            return alert('Completa todos los campos.');
          }
          const body = {
            product_id: Number(prodId),
            quantity:   Number(qty),
            ...(varId ? { variation_id: Number(varId) } : {})
          };
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
        e.target.parentNode.appendChild(form);
      }
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
      return;
    }
  });

  // Initialize everything
  await loadOrderStatuses();
  await loadProducts();
  await loadCities();
  await loadProvincias();
  await loadPedidos();
});
