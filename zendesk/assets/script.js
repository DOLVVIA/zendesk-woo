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
      // Preparamos el payload correctamente usando chargeId
      const payload = { chargeId, amount, ...getStripeConfig() };
  
      const res = await fetch(`${API_BASE}/refund-stripe`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
  
      // Si no es un 2xx, leemos texto en lugar de JSON para evitar errores
      if (!res.ok) {
        const text = await res.text();
        console.error('❌ /refund-stripe error:', res.status, text);
        showMessage(panel, `Error reembolso: ${res.status}`, 'error');
        return;
      }
  
      // Si llega aquí, parseamos JSON
      const json = await res.json();
      if (json.success) {
        showMessage(panel, `✅ Reembolso OK (ID: ${json.refund.id})`);
        await loadPedidos();
      } else {
        showMessage(panel, `❌ Error reembolso: ${json.error}`, 'error');
      }
  
    } catch (e) {
      console.error('🛑 Exception en refundStripe:', e);
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

// ————— Sección Stripe (movida, estilizada y full-width) —————
{
  const charges = b.email ? await loadStripeCharges(b.email) : [];
  const stripeDetails = document.createElement('details');
  stripeDetails.className = 'stripe-payments mt-2 mb-3';

  const summary = document.createElement('summary');
  summary.className = 'font-weight-bold';
  summary.innerText = `Pagos Stripe (${charges.length})`;
  stripeDetails.appendChild(summary);

  if (!charges.length) {
    const noData = document.createElement('p');
    noData.innerText = 'No hay cargos de Stripe para este cliente.';
    noData.className = 'mb-2';
    stripeDetails.appendChild(noData);
  } else {
    const ul = document.createElement('ul');
    ul.className = 'list-unstyled w-100';

    charges.forEach(c => {
      const title  = c.metadata?.products || c.description || c.id;
      const amount = (c.amount / 100).toFixed(2);
      const isFull = c.amount_refunded === c.amount;

      // LI contenedor a ancho completo
      const li = document.createElement('li');
      li.className = 'mb-4 w-100';

      // Info + badge
      const infoDiv = document.createElement('div');
      infoDiv.className = 'd-flex justify-content-between align-items-center mb-2';
      infoDiv.innerHTML = `
        <div>${title} — ${amount} €</div>
        <div>
          <span class="badge badge-${isFull?'success':'info'}">
            ${isFull ? 'Reembolsado' : 'Exitoso'}
          </span>
        </div>
      `;
      li.appendChild(infoDiv);

      // Botón “Reembolso completo” full-width
      const btnFull = document.createElement('button');
      btnFull.type = 'button';
      btnFull.innerText = 'Reembolso completo';
      btnFull.disabled = isFull;
      btnFull.className = 'btn btn-danger btn-block mb-2';
      btnFull.addEventListener('click', () => refundStripe(c.id, c.amount, panel));
      li.appendChild(btnFull);

      // Botón “Reembolso parcial” full-width
      const btnPartial = document.createElement('button');
      btnPartial.type = 'button';
      btnPartial.innerText = 'Reembolso parcial';
      btnPartial.disabled = isFull;
      btnPartial.className = 'btn btn-warning btn-block';
      li.appendChild(btnPartial);

      // — Formulario parcial oculto —
      const formPartial = document.createElement('form');
      formPartial.className = 'mt-2 mb-3 w-100';
      formPartial.style.display = 'none';

      // Input importe full-width
      const input = document.createElement('input');
      input.type = 'number';
      input.name = 'partial';
      input.step = '0.01';
      input.min = '0.01';
      input.max = amount;
      input.placeholder = 'Ej: 12.34';
      input.required = true;
      input.className = 'form-control mb-3 w-100';
      formPartial.appendChild(input);

      // Botones Aceptar / Cancelar juntos, cada uno 50 %
      const btnGroup = document.createElement('div');
      btnGroup.className = 'd-flex w-100';

      const acceptBtn = document.createElement('button');
      acceptBtn.type = 'submit';
      acceptBtn.innerText = '✓ Aceptar';
      acceptBtn.className = 'btn btn-success flex-fill mr-2';
      btnGroup.appendChild(acceptBtn);

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.innerText = '✖ Cancelar';
      cancelBtn.className = 'btn btn-danger flex-fill';
      btnGroup.appendChild(cancelBtn);

      formPartial.appendChild(btnGroup);
      li.appendChild(formPartial);

      // Lógica mostrar/ocultar form parcial
      btnPartial.addEventListener('click', () => {
        formPartial.style.display = 'block';
        btnPartial.style.display = 'none';
      });
      cancelBtn.addEventListener('click', () => {
        formPartial.style.display = 'none';
        btnPartial.style.display = '';
      });

      // Envío del form parcial
      formPartial.addEventListener('submit', async ev => {
        ev.preventDefault();
        const val = parseFloat(input.value.replace(',', '.'));
        if (isNaN(val) || val <= 0 || val > parseFloat(amount)) {
          return alert(`Importe inválido (0 < importe ≤ ${amount})`);
        }
        const cents = Math.round(val * 100);
        await refundStripe(c.id, cents, panel);
      });

      ul.appendChild(li);
    });

    stripeDetails.appendChild(ul);
  }

  // Insertamos junto a PayPal y SEPA
  panel.appendChild(stripeDetails);
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

// … dentro de loadPedidos(), justo tras renderStripeCharges…

// ————— Sección BBVA SEPA-TRANSFER —————
{
  const bbvaDetails = document.createElement('details');
  bbvaDetails.className = 'bbva-transfer mt-2 mb-3';
  bbvaDetails.innerHTML = `
    <summary class="font-weight-bold">Enviar reembolso contrareembolso (IBAN)</summary>
  `;
  
  const form = document.createElement('form');
  form.className = 'bbva-form p-3';
  form.innerHTML = `
    <div class="form-text mb-3">Límite por transferencia: <strong>100 €</strong></div>
    <div class="form-group">
      <label>IBAN beneficiario</label>
      <input name="iban" class="form-control" placeholder="ES00ZZ…" required />
    </div>
    <div class="form-group">
      <label>Nombre beneficiario</label>
      <input name="name" class="form-control" placeholder="Juan Pérez" required />
    </div>
    <div class="form-group">
      <label>Importe (€)</label>
      <input
        type="number" name="amount" class="form-control"
        step="0.01" max="100" placeholder="0.00" required
      />
    </div>
    <div class="form-group">
      <label>Concepto (opcional)</label>
      <input name="info" class="form-control" placeholder="Refund Order #${pedido.id}" />
    </div>
  `;

  // Botones en línea
  const btnSubmit = document.createElement('button');
  btnSubmit.type = 'submit';
  btnSubmit.innerText = '✓ Enviar transferencia';
  btnSubmit.className = 'btn btn-primary mr-2';

  const btnCancel = document.createElement('button');
  btnCancel.type = 'button';
  btnCancel.innerText = '✖ Cancelar';
  btnCancel.className = 'btn btn-danger';

  const btnGroup = document.createElement('div');
  btnGroup.className = 'd-flex';
  btnGroup.append(btnSubmit, btnCancel);
  form.appendChild(btnGroup);

  // Inserta el form en el details y en el panel
  bbvaDetails.appendChild(form);
  panel.appendChild(bbvaDetails);

  // Lógica de validación en tiempo real
  const amountInput = form.querySelector('input[name="amount"]');
  btnSubmit.disabled = true;
  amountInput.addEventListener('input', () => {
    const v = parseFloat(amountInput.value);
    btnSubmit.disabled = isNaN(v) || v <= 0 || v > 100;
  });

  // Cancelar
  btnCancel.addEventListener('click', () => {
    form.reset();
    btnSubmit.disabled = true;
    bbvaDetails.open = false;
  });

  // Envío
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const iban = form.iban.value.trim();
    const name = form.name.value.trim();
    const amt  = parseFloat(form.amount.value);
    const info = form.info.value.trim();

    try {
      const res = await fetch(`${API_BASE}/bbva-transfer`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ creditorIban: iban, creditorName: name, amount: amt, remittanceInfo: info })
      });
      const j = await res.json();
      if (j.success) {
        showMessage(panel, '✅ Transferencia enviada con éxito');
        await loadPedidos();
      } else {
        showMessage(panel, `❌ Error: ${j.message||j.error}`, 'error');
      }
    } catch (e) {
      console.error(e);
      showMessage(panel, '❌ Error inesperado al enviar transferencia', 'error');
    }
  });
}

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

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //TODO LO QUE TENGA QUE VER CON BOTONES Y ESTETICA  Global click listener: estado, dirección, editar, eliminar, etc.
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  document.addEventListener('click', async e => {
    const { woocommerce_url, consumer_key, consumer_secret } = getWooConfig();

    // 1) Cambiar estado
if (e.target.matches('.btn-change-status')) {
  const orderId = e.target.dataset.orderId;
  const currentStatus = e.target.dataset.status;
  let form = e.target.parentNode.querySelector('.status-form');
  if (!form) {
    form = document.createElement('div');
    form.className = 'status-form mt-2 mb-3';

    // Select de estados con ancho completo
    const sel = document.createElement('select');
    sel.className = 'form-control mb-2';
    orderStatuses.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.slug;
      opt.text = s.name;
      if (s.slug === currentStatus) opt.selected = true;
      sel.appendChild(opt);
    });
    form.appendChild(sel);

    // Botones en la misma línea
    const btnOk = document.createElement('button');
    btnOk.innerText = '✓ Aceptar';
    btnOk.className = 'btn btn-success mr-2';
    btnOk.addEventListener('click', async () => {
      const newStatus = sel.value;
      const params = new URLSearchParams({
        order_id: orderId,
        status: newStatus,
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

    const btnCancel = document.createElement('button');
    btnCancel.innerText = '✖ Cancelar';
    btnCancel.className = 'btn btn-danger';
    btnCancel.addEventListener('click', () => form.style.display = 'none');

    const btnGroup = document.createElement('div');
    btnGroup.className = 'd-flex';
    btnGroup.append(btnOk, btnCancel);
    form.appendChild(btnGroup);

    // Inserta el formulario justo debajo del botón
    e.target.insertAdjacentElement('afterend', form);
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
    form.className = 'form-address mt-2 mb-3';

    function createSection(type, data) {
      const section = document.createElement('div');
      section.className = 'mb-3';
      const title = document.createElement('h5');
      title.innerText = type === 'billing' ? 'Facturación' : 'Envío';
      section.appendChild(title);
      const fields = [
        ['first_name','Nombre'],
        ['last_name','Apellidos'],
        ['address_1','Dirección 1'],
        ['address_2','Dirección 2'],
        ['postcode','Código postal']
      ];
      fields.forEach(([key,labelText]) => {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        const label = document.createElement('label');
        label.innerText = labelText;
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.name = `${type}_${key}`;
        inp.value = data[key] || '';
        inp.className = 'form-control';
        formGroup.appendChild(label);
        formGroup.appendChild(inp);
        section.appendChild(formGroup);
      });
      // Ciudad
      const cityGroup = document.createElement('div');
      cityGroup.className = 'form-group';
      const lblCity = document.createElement('label');
      lblCity.innerText = 'Ciudad';
      const selCity = document.createElement('select');
      selCity.name = `${type}_city`;
      selCity.className = 'form-control';
      citiesList.forEach(c => {
        const o = document.createElement('option');
        o.value = o.text = c;
        if (c === data.city) o.selected = true;
        selCity.appendChild(o);
      });
      cityGroup.appendChild(lblCity);
      cityGroup.appendChild(selCity);
      section.appendChild(cityGroup);
      // Provincia
      const provGroup = document.createElement('div');
      provGroup.className = 'form-group';
      const lblProv = document.createElement('label');
      lblProv.innerText = 'Provincia';
      const selProv = document.createElement('select');
      selProv.name = `${type}_state`;
      selProv.className = 'form-control';
      provincesList.forEach(s => {
        const o = document.createElement('option');
        o.value = o.text = s;
        if (s === data.state) o.selected = true;
        selProv.appendChild(o);
      });
      provGroup.appendChild(lblProv);
      provGroup.appendChild(selProv);
      section.appendChild(provGroup);

      return section;
    }

    form.appendChild(createSection('billing', billing));
    form.appendChild(createSection('shipping', shipping));

    // Botones en línea
    const btnSave = document.createElement('button');
    btnSave.type = 'button';
    btnSave.innerText = '✓ Aceptar';
    btnSave.className = 'btn btn-success mr-2';
    btnSave.addEventListener('click', async () => {
      const formEl = btnSave.closest('.form-address');
      const orderId = formEl.dataset.orderId;
      const billing = {
        first_name: formEl.querySelector('input[name="billing_first_name"]').value,
        last_name:  formEl.querySelector('input[name="billing_last_name"]').value,
        address_1:  formEl.querySelector('input[name="billing_address_1"]').value,
        address_2:  formEl.querySelector('input[name="billing_address_2"]').value,
        postcode:   formEl.querySelector('input[name="billing_postcode"]').value,
        city:       formEl.querySelector('select[name="billing_city"]').value,
        state:      formEl.querySelector('select[name="billing_state"]').value
      };
      const shipping = {
        first_name: formEl.querySelector('input[name="shipping_first_name"]').value,
        last_name:  formEl.querySelector('input[name="shipping_last_name"]').value,
        address_1:  formEl.querySelector('input[name="shipping_address_1"]').value,
        address_2:  formEl.querySelector('input[name="shipping_address_2"]').value,
        postcode:   formEl.querySelector('input[name="shipping_postcode"]').value,
        city:       formEl.querySelector('select[name="shipping_city"]').value,
        state:      formEl.querySelector('select[name="shipping_state"]').value
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
        showMessage(formEl.parentNode, 'Dirección actualizada');
        await loadPedidos();
        formEl.style.display = 'none';
      } else {
        const err = await res.json();
        showMessage(formEl.parentNode, `Error: ${err.error}`, 'error');
      }
    });

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.innerText = '✖ Cancelar';
    btnCancel.className = 'btn btn-danger';
    btnCancel.addEventListener('click', () => { form.style.display = 'none'; });

    const btnGroup = document.createElement('div');
    btnGroup.className = 'd-flex';
    btnGroup.append(btnSave, btnCancel);
    form.appendChild(btnGroup);

    // Insertar el form debajo del botón
    e.target.insertAdjacentElement('afterend', form);
  }
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  return;
}

// 3) Guardar dirección
if (e.target.matches('.btn-save-address')) {
  // ya gestionado en btnSave click arriba
  return;
}

// 4) Eliminar artículo
if (e.target.matches('.btn-delete-item')) {
  const orderId  = e.target.dataset.orderId;
  const lineIndex = e.target.dataset.index;
  let form = e.target.parentNode.querySelector('.delete-item-form');
  if (!form) {
    form = document.createElement('div');
    form.className = 'delete-item-form mt-2 mb-3';

    const info = document.createElement('p');
    info.innerText =
      '¿Estás seguro de que deseas eliminar este artículo? El pedido pasará a "Pendiente de pago".';
    form.appendChild(info);

    const btnConfirm = document.createElement('button');
    btnConfirm.innerText = '✓ Confirmar';
    btnConfirm.className = 'btn btn-success mr-2';
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
    btnCancel.innerText = '✖ Cancelar';
    btnCancel.className = 'btn btn-danger';
    btnCancel.addEventListener('click', () => form.style.display = 'none');
    form.appendChild(btnCancel);

    e.target.insertAdjacentElement('afterend', form);
  }
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  return;
}

// 5) Editar talla/cantidad
if (e.target.matches('.btn-edit-item')) {
  const btn         = e.target;
  const orderId     = btn.dataset.orderId;
  const lineIndex   = btn.dataset.index;
  const productId   = btn.dataset.productId;
  const oldVarId    = btn.dataset.variationId;
  const oldQuantity = btn.dataset.quantity;

  // Intentamos leer el form justo después del botón
  let form = btn.nextElementSibling;
  if (!form || !form.classList.contains('edit-item-form')) {
    // Creamos un nuevo form
    form = document.createElement('div');
    form.className = 'edit-item-form mt-2 mb-3';

    // Select de variaciones
    const selVar = document.createElement('select');
    selVar.className = 'form-control mb-2';
    selVar.innerHTML = '<option value="">— Selecciona variación —</option>';
    form.appendChild(selVar);

    // Input de cantidad
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '1';
    qtyInput.value = oldQuantity;
    qtyInput.placeholder = 'Cantidad';
    qtyInput.className = 'form-control mb-3';
    form.appendChild(qtyInput);

    // Botones Aceptar/Cancelar lado a lado
    const btnOk = document.createElement('button');
    btnOk.type = 'button';
    btnOk.innerText = '✓ Aceptar';
    btnOk.disabled = true;
    btnOk.className = 'btn btn-success flex-fill mr-2';

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.innerText = '✖ Cancelar';
    btnCancel.className = 'btn btn-secondary flex-fill';
    btnCancel.addEventListener('click', () => form.style.display = 'none');

    const btnGroup = document.createElement('div');
    btnGroup.className = 'd-flex';
    btnGroup.append(btnOk, btnCancel);
    form.appendChild(btnGroup);

    // Habilitar el botón Aceptar sólo cuando haya variación y cantidad
    selVar.addEventListener('change', () => {
      btnOk.disabled = !(selVar.value && qtyInput.value);
    });
    qtyInput.addEventListener('input', () => {
      btnOk.disabled = !(selVar.value && qtyInput.value);
    });

    // Cargar variaciones desde tu API
    (async () => {
      const { woocommerce_url, consumer_key, consumer_secret } = getWooConfig();
      const paramsVar = new URLSearchParams({
        product_id: productId,
        woocommerce_url,
        consumer_key,
        consumer_secret
      });
      const resVar = await fetch(`${API_BASE}/get-variaciones?${paramsVar}`, {
        headers: getHeaders()
      });
      const vars = await resVar.json();
      vars.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.text = v.attributes.map(a => `${a.name}: ${a.option}`).join(', ');
        if (v.id == oldVarId) opt.selected = true;
        selVar.appendChild(opt);
      });
      if (selVar.value && qtyInput.value) btnOk.disabled = false;
    })();

    // Lógica al pulsar “Aceptar”
    btnOk.addEventListener('click', async () => {
      const newVarId = selVar.value;
      const newQty   = qtyInput.value;
      const qc       = getWooConfig();

      // 1) Cambiar a pending
      const p1 = new URLSearchParams({
        order_id: orderId,
        status: 'pending',
        woocommerce_url: qc.woocommerce_url,
        consumer_key: qc.consumer_key,
        consumer_secret: qc.consumer_secret
      });
      const r1 = await fetch(`${API_BASE}/cambiar-estado?${p1}`, {
        method: 'PUT',
        headers: getHeaders()
      });
      if (!r1.ok) {
        const err = await r1.json();
        return showMessage(form.parentNode, `Error estado: ${err.error}`, 'error');
      }

      // 2) Eliminar el ítem original
      const p2 = new URLSearchParams({
        order_id: orderId,
        line_index: lineIndex,
        woocommerce_url: qc.woocommerce_url,
        consumer_key: qc.consumer_key,
        consumer_secret: qc.consumer_secret
      });
      const r2 = await fetch(`${API_BASE}/eliminar-item?${p2}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (!r2.ok) {
        const err = await r2.json();
        return showMessage(form.parentNode, `Error eliminar: ${err.error}`, 'error');
      }

      // 3) Añadir el nuevo ítem
      const payload = {
        ...qc,
        product_id: Number(productId),
        variation_id: Number(newVarId),
        quantity: Number(newQty)
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

    // Insertar el form **justo después** del botón pulsado
    btn.insertAdjacentElement('afterend', form);
  }

  // Alternar visibilidad del form
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  return;
}


// 6) Añadir artículo
if (e.target.matches('.btn-add-item')) {
  const orderId = e.target.dataset.orderId;
  let form = e.target.parentNode.querySelector('.add-item-form');
  if (!form) {
    form = document.createElement('div');
    form.className = 'add-item-form mt-2 mb-3';

    // Select de productos con ancho completo
    const selProd = document.createElement('select');
    selProd.className = 'form-control mb-2';
    selProd.innerHTML = `<option value="">— Selecciona producto —</option>`;
    productsList.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.text = p.name;
      selProd.appendChild(opt);
    });
    form.appendChild(selProd);

    // Select de variaciones con ancho completo (oculto inicialmente)
    const selVar = document.createElement('select');
    selVar.className = 'form-control mb-2';
    selVar.innerHTML = `<option value="">— Selecciona variación —</option>`;
    selVar.style.display = 'none';
    form.appendChild(selVar);

    // Input de cantidad con ancho completo
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '1';
    qtyInput.placeholder = 'Cantidad';
    qtyInput.className = 'form-control mb-3';
    form.appendChild(qtyInput);

    // Botones Aceptar y Cancelar en la misma línea
    const btnOk = document.createElement('button');
    btnOk.innerText = '✓ Aceptar';
    btnOk.disabled = true;
    btnOk.className = 'btn btn-success mr-2';

    const btnCancel = document.createElement('button');
    btnCancel.innerText = '✖ Cancelar';
    btnCancel.className = 'btn btn-danger';
    btnCancel.addEventListener('click', () => { form.style.display = 'none'; });

    const btnGroup = document.createElement('div');
    btnGroup.className = 'd-flex';
    btnGroup.append(btnOk, btnCancel);
    form.appendChild(btnGroup);

    // Al cambiar producto, cargamos variaciones
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
        product_id: prodId,
        ...qc
      });
      const resVar = await fetch(`${API_BASE}/get-variaciones?${paramsVar}`, { headers: getHeaders() });
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
      btnOk.disabled = !qtyInput.value;
    });

    // Al cambiar cantidad, habilitamos/deshabilitamos Aceptar
    qtyInput.addEventListener('input', () => {
      btnOk.disabled = !(selProd.value && qtyInput.value);
    });

    // Evento de Aceptar: añadimos el artículo
    btnOk.addEventListener('click', async () => {
      const prodId = selProd.value;
      const varId = selVar.style.display === 'none' ? null : selVar.value;
      const qty = qtyInput.value;
      if (!prodId || !qty || (selVar.style.display !== 'none' && !varId)) {
        return alert('Completa todos los campos.');
      }
      const body = {
        product_id: Number(prodId),
        quantity: Number(qty),
        ...(varId ? { variation_id: Number(varId) } : {})
      };
      const payload = { ...getWooConfig(), ...body };
      const res = await fetch(`${API_BASE}/anadir-item?order_id=${orderId}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showMessage(form.parentNode, 'Artículo añadido');
        await loadPedidos();
        form.style.display = 'none';
      } else {
        const err = await res.json();
        showMessage(form.parentNode, `Error: ${err.error}`, 'error');
      }
    });

    // Insertar formulario justo debajo del botón
    e.target.insertAdjacentElement('afterend', form);
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
