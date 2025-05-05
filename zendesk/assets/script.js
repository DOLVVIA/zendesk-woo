// zendesk/assets/script.js
const client = ZAFClient.init();

client.on('app.registered', async () => {
  const { settings: SETTINGS } = await client.metadata();
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

// --- CALLBELL FUNCTIONS ---
let callbellTemplates = [];

/**
 * GET /api/callbell/plantillas
 * Devuelve un array de plantillas.
 */
async function fetchPlantillas() {
  const res = await fetch(`${API_BASE}/callbell/plantillas`, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(`Error ${res.status}: ${err?.error || res.statusText}`);
  }

  // Asumimos que el endpoint responde un array simple.
  // Si responde { templates: [...] }, cambiar a `return data.templates;`
  return await res.json();
}

/**
 * POST /api/callbell/enviar-mensaje
 * Envía un WhatsApp template message.
 */
async function enviarPlantilla(to, template_uuid, template_values = []) {
  const res = await fetch(`${API_BASE}/callbell/enviar-mensaje`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ to, template_uuid, template_values })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(`Error ${res.status}: ${err?.error || res.statusText}`);
  }

  return await res.json();
}

/**
 * Precarga las plantillas antes de renderizar los pedidos.
 */
async function loadCallbellTemplates() {
  try {
    // fetchPlantillas devuelve un array de objetos { uuid, name, ... }
    callbellTemplates = await fetchPlantillas();
  } catch (e) {
    console.error('Error cargando plantillas Callbell:', e);
    callbellTemplates = [];
  }
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


// Carga los cargos de Stripe para un email dado
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

// Realiza el reembolso en Stripe **y** lo registra en WooCommerce
async function refundStripe(chargeId, amount, panel) {
  try {
    // Recuperar el ID de pedido de WooCommerce del data-attribute
    const orderId = panel.dataset.orderId;

    // Preparamos el payload con orderId + Stripe
    const payload = {
      orderId,           // <-- ID de Woo para registrar refund allí también
      chargeId,
      amount,
      ...getStripeConfig()
    };

    const res = await fetch(`${API_BASE}/refund-stripe`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });

    // Si no es un 2xx, leemos texto para debug
    if (!res.ok) {
      const text = await res.text();
      console.error('❌ /refund-stripe error:', res.status, text);
      showMessage(panel, `Error reembolso: ${res.status}`, 'error');
      return;
    }

    const json = await res.json();
    if (json.success) {
      showMessage(panel, `✅ Reembolso OK (ID: ${json.refund.id})`);
      await loadPedidos();  // refresca la lista de pedidos
    } else {
      showMessage(panel, `❌ Error reembolso: ${json.error}`, 'error');
    }

  } catch (e) {
    console.error('🛑 Exception en refundStripe:', e);
    showMessage(panel, 'Error inesperado al reembolsar', 'error');
  }
}

// Renderiza la lista de cargos de Stripe, con estados completos/parciales
function renderStripeCharges(charges, container, panel) {
  container.innerHTML = '';

  if (!charges.length) {
    const noData = document.createElement('p');
    noData.innerText = 'No hay cargos de Stripe para este cliente.';
    noData.className = 'mb-2';
    container.appendChild(noData);
    return;
  }

  const details = document.createElement('details');
  details.className = 'stripe-payments mt-2 mb-3';
  const summary = document.createElement('summary');
  summary.className = 'font-weight-bold';
  summary.innerText = `Pagos Stripe (${charges.length})`;
  details.appendChild(summary);

  const ul = document.createElement('ul');
  ul.className = 'list-unstyled w-100';

  charges.forEach(c => {
    const title    = c.metadata?.products || c.description || c.id;
    const amount   = (c.amount / 100).toFixed(2);
    const refunded = (c.amount_refunded || 0) / 100;
    const isFull   = c.amount_refunded === c.amount;
    const isPartial= c.amount_refunded > 0 && c.amount_refunded < c.amount;
    let statusTxt, badgeClass;
    if (isFull) {
      statusTxt = 'Reembolsado';     badgeClass = 'success';
    } else if (isPartial) {
      statusTxt = `Parcial (${refunded.toFixed(2)} €)`; badgeClass = 'warning';
    } else if (c.status === 'succeeded') {
      statusTxt = 'Exitoso';         badgeClass = 'success';
    } else {
      statusTxt = 'Fallido';         badgeClass = 'danger';
    }

    const li = document.createElement('li');
    li.className = 'mb-4 w-100';

    // Info + badge
    const infoDiv = document.createElement('div');
    infoDiv.className = 'd-flex justify-content-between align-items-center mb-2';
    infoDiv.innerHTML = `
      <div>${title} — ${amount} €</div>
      <div><span class="badge badge-${badgeClass}">${statusTxt}</span></div>
    `;
    li.appendChild(infoDiv);

    // Botón “Reembolso completo”
    const btnFull = document.createElement('button');
    btnFull.type = 'button';
    btnFull.innerText = 'Reembolso completo';
    btnFull.disabled = isFull;
    btnFull.className = 'btn btn-danger btn-block mb-2';
    btnFull.addEventListener('click', () =>
      refundStripe(c.id, c.amount, panel)
    );
    li.appendChild(btnFull);

    // Botón “Reembolso parcial”
    const btnPartial = document.createElement('button');
    btnPartial.type = 'button';
    btnPartial.innerText = 'Reembolso parcial';
    btnPartial.disabled = isFull;
    btnPartial.className = 'btn btn-warning btn-block';
    li.appendChild(btnPartial);

    // Formulario de reembolso parcial
    const formPartial = document.createElement('form');
    formPartial.className = 'mt-2 mb-3 w-100';
    formPartial.style.display = 'none';

    // Input de importe
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

    // Botones Aceptar/Cancelar lado a lado
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

    // Mostrar/ocultar form parcial
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
          btnEdit.dataset.total       = item.total;
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

// ————— Sección Stripe (unificada) —————
{
  const stripeContainer = document.createElement('div');
  stripeContainer.className = 'stripe-container mt-2 mb-3';
  const charges = b.email ? await loadStripeCharges(b.email) : [];
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

          // ————— Sección CALLBELL —————
          const callbellDetails = document.createElement('details');
          callbellDetails.className = 'callbell-section mt-2 mb-3';
          callbellDetails.innerHTML = `
            <summary class="font-weight-bold">Enviar WhatsApp Template</summary>
          `;
  
          const callbellForm = document.createElement('form');
          callbellForm.className = 'callbell-form p-2';
          callbellForm.innerHTML = `
            <div class="form-group">
              <label>Plantilla</label>
              <select class="form-control mb-2" name="template">
                ${callbellTemplates.map(t => `
                  <option value="${t.uuid}">
                    ${t.name || t.uuid}
                  </option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Teléfono</label>
              <input type="tel"
                     name="to"
                     class="form-control mb-2"
                     placeholder="+34123456789"
                     required />
            </div>
            <div class="form-group">
              <label>Valores (separados por coma)</label>
              <input type="text"
                     name="values"
                     class="form-control mb-2"
                     placeholder="Juan, Pedido #123" />
            </div>
            <button type="submit" class="btn btn-primary">
              Enviar WhatsApp
            </button>
          `;
  
          callbellDetails.appendChild(callbellForm);
          panel.appendChild(callbellDetails);
  
          // Manejador de envío
          callbellForm.addEventListener('submit', async ev => {
            ev.preventDefault();
            const to = callbellForm.to.value.trim();
            const template_uuid = callbellForm.template.value;
            const template_values = callbellForm.values.value
              .split(',')
              .map(v => v.trim())
              .filter(v => v);
            try {
              const res = await enviarPlantilla(to, template_uuid, template_values);
              showMessage(panel, `✅ Mensaje enviado (ID: ${res.message.uuid})`);
            } catch (err) {
              console.error('Error enviando WhatsApp:', err);
              showMessage(panel, '❌ Error al enviar mensaje', 'error');
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

  // — Crear o recuperar el selector de sección —
  let chooser = panel.querySelector('.address-chooser');
  if (!chooser) {
    chooser = document.createElement('select');
    chooser.className = 'form-control mb-2 address-chooser';
    [
      { value:'',            text:'— Selecciona sección —' },
      { value:'facturación', text:'Facturación'         },
      { value:'envío',       text:'Envío'               }
    ].forEach(({value,text}) => {
      const o = document.createElement('option');
      o.value = value;
      o.text  = text;
      chooser.appendChild(o);
    });
    panel.insertBefore(chooser, e.target.nextSibling);
  }

  // — Crear o recuperar el formulario —
  let form = panel.querySelector('.form-address');
  if (!form) {
    form = document.createElement('form');
    form.className = 'form-address mt-2 mb-3';
    form.style.display = 'none';
    panel.insertBefore(form, chooser.nextSibling);
  }

  // — Al cambiar el selector, renderizamos campos —
  chooser.onchange = () => {
    const tipo = chooser.value; // '' | 'facturación' | 'envío'
    form.innerHTML = '';
    if (!tipo) {
      form.style.display = 'none';
      return;
    }
    // Título
    form.innerHTML += `<h5>Editar ${tipo.charAt(0).toUpperCase()+tipo.slice(1)}</h5>`;

    // Campos comunes
    const campos = [
      ['first_name','Nombre'],
      ['last_name', 'Apellidos'],
      ['address_1','Dirección 1'],
      ['address_2','Dirección 2'],
      ['postcode', 'Código postal']
    ];
    campos.forEach(([key,label]) => {
      form.innerHTML += `
        <div class="form-group">
          <label>${label}</label>
          <input
            name="${tipo}_${key}"
            value="${(tipo==='facturación'?billing:shipping)[key]||''}"
            class="form-control"
          />
        </div>`;
    });

    // Ciudad
    form.innerHTML += `
      <div class="form-group">
        <label>Ciudad</label>
        <select name="${tipo}_city" class="form-control">
          ${citiesList.map(c=>`<option${c===((tipo==='facturación'?billing:shipping).city)?' selected':''}>${c}</option>`).join('')}
        </select>
      </div>`;

    // Provincia
    form.innerHTML += `
      <div class="form-group">
        <label>Provincia</label>
        <select name="${tipo}_state" class="form-control">
          ${provincesList.map(s=>`<option${s===((tipo==='facturación'?billing:shipping).state)?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>`;

    // Email y Teléfono solo en facturación
    if (tipo==='facturación') {
      form.innerHTML += `
        <div class="form-group">
          <label>Email</label>
          <input
            name="billing_email"
            value="${billing.email||''}"
            class="form-control"
          />
        </div>
        <div class="form-group">
          <label>Teléfono</label>
          <input
            name="billing_phone"
            value="${billing.phone||''}"
            class="form-control"
          />
        </div>`;
    }

    // Botones Aceptar / Cancelar
    form.innerHTML += `
      <div class="d-flex">
        <button type="button" class="btn btn-success flex-fill mr-2 btn-save-address">
          ✓ Aceptar
        </button>
        <button type="button" class="btn btn-danger flex-fill btn-cancel-address">
          ✖ Cancelar
        </button>
      </div>`;

    form.style.display = 'block';

    // Cancelar
    form.querySelector('.btn-cancel-address').onclick = () => {
      form.style.display = 'none';
      chooser.value = '';
    };

    // Guardar
    form.querySelector('.btn-save-address').onclick = async () => {
      const fd = new FormData(form);
      const newBilling = tipo==='facturación' ? {
        first_name: fd.get('facturación_first_name'),
        last_name:  fd.get('facturación_last_name'),
        address_1:  fd.get('facturación_address_1'),
        address_2:  fd.get('facturación_address_2'),
        postcode:   fd.get('facturación_postcode'),
        city:       fd.get('facturación_city'),
        state:      fd.get('facturación_state'),
        email:      fd.get('billing_email'),
        phone:      fd.get('billing_phone')
      } : billing;
      const newShipping = tipo==='envío' ? {
        first_name: fd.get('envío_first_name'),
        last_name:  fd.get('envío_last_name'),
        address_1:  fd.get('envío_address_1'),
        address_2:  fd.get('envío_address_2'),
        postcode:   fd.get('envío_postcode'),
        city:       fd.get('envío_city'),
        state:      fd.get('envío_state')
      } : shipping;

      const params = new URLSearchParams({
        order_id:  orderId,
        billing:   encodeURIComponent(JSON.stringify(newBilling)),
        shipping:  encodeURIComponent(JSON.stringify(newShipping)),
        woocommerce_url,
        consumer_key,
        consumer_secret
      });
      const res = await fetch(`${API_BASE}/editar-direccion?${params}`, {
        method: 'PUT', headers: getHeaders()
      });
      if (res.ok) {
        showMessage(panel, 'Dirección actualizada');
        await loadPedidos();
      } else {
        const err = await res.json();
        showMessage(panel, `Error: ${err.error}`, 'error');
      }
      form.style.display = 'none';
      chooser.value = '';
    };
  };

  return;
}

// 3) Guardar dirección
if (e.target.matches('.btn-save-address')) {
  // ya está gestionado en el onclick de arriba
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

// 5) Editar talla, cantidad y precio (IVA incluido)
if (e.target.matches('.btn-edit-item')) {
  const btn         = e.target;
  const orderId     = btn.dataset.orderId;
  const lineIndex   = btn.dataset.index;
  const productId   = btn.dataset.productId;
  const oldVarId    = btn.dataset.variationId;
  const oldQuantity = Number(btn.dataset.quantity);
  // vamos a pre-llenar con el total de la línea (unitario×cantidad)
  const oldTotal    = parseFloat(btn.dataset.total) || 0;

  let form = btn.nextElementSibling;
  if (!form || !form.classList.contains('edit-item-form')) {
    form = document.createElement('div');
    form.className = 'edit-item-form mt-2 mb-3';

    // 1) Select variaciones
    const selVar = document.createElement('select');
    selVar.className = 'form-control mb-2';
    selVar.innerHTML = '<option value="">— Selecciona variación —</option>';
    form.appendChild(selVar);

    // 2) Cantidad
    const qtyInput = document.createElement('input');
    qtyInput.type        = 'number';
    qtyInput.min         = '1';
    qtyInput.value       = oldQuantity;
    qtyInput.placeholder = 'Cantidad';
    qtyInput.className   = 'form-control mb-2';
    form.appendChild(qtyInput);

    // 3) Total línea (IVA incl.)
    const totalInclInput = document.createElement('input');
    totalInclInput.type        = 'number';
    totalInclInput.step        = '0.01';
    totalInclInput.min         = '0.01';
    totalInclInput.value       = oldTotal.toFixed(2);
    totalInclInput.placeholder = 'Precio total (IVA incl.)';
    totalInclInput.className   = 'form-control mb-2';
    form.appendChild(totalInclInput);

    // 4) % IVA
    const vatInput = document.createElement('input');
    vatInput.type        = 'number';
    vatInput.step        = '0.01';
    vatInput.min         = '0';
    vatInput.value       = '21';
    vatInput.placeholder = '% IVA';
    vatInput.className   = 'form-control mb-3';
    form.appendChild(vatInput);

    // 5) Botones ✓ / ✖
    const btnOk = document.createElement('button');
    btnOk.type      = 'button';
    btnOk.innerText = '✓ Aceptar';
    btnOk.disabled  = true;
    btnOk.className = 'btn btn-success flex-fill mr-2';

    const btnCancel = document.createElement('button');
    btnCancel.type      = 'button';
    btnCancel.innerText = '✖ Cancelar';
    btnCancel.className = 'btn btn-secondary flex-fill';
    btnCancel.addEventListener('click', () => form.style.display = 'none');

    const btnGroup = document.createElement('div');
    btnGroup.className = 'd-flex mb-3';
    btnGroup.append(btnOk, btnCancel);
    form.appendChild(btnGroup);

    // 6) Activar ✓ solo si todo está relleno
    function toggleOk() {
      btnOk.disabled = !(
        selVar.value &&
        qtyInput.value &&
        totalInclInput.value &&
        vatInput.value
      );
    }
    [selVar, qtyInput, totalInclInput, vatInput].forEach(el =>
      el.addEventListener('input', toggleOk)
    );

    // 7) Carga variaciones y marca la antigua
    (async () => {
      const cfg = getWooConfig();
      const params = new URLSearchParams({
        product_id:      productId,
        woocommerce_url: cfg.woocommerce_url,
        consumer_key:    cfg.consumer_key,
        consumer_secret: cfg.consumer_secret
      });
      const resVar = await fetch(`${API_BASE}/get-variaciones?${params}`, {
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
      toggleOk();
    })();

    // 8) Al pulsar ✓, recalculamos a nivel de LÍNEA y enviamos
    btnOk.addEventListener('click', async () => {
      const newVarId   = Number(selVar.value);
      const qtyNum     = Number(qtyInput.value);
      const totalIncl  = parseFloat(totalInclInput.value.replace(',', '.'));
      const vatPct     = parseFloat(vatInput.value.replace(',', '.'));
      const cfg        = getWooConfig();

      // 8.1) Paso a pending
      await fetch(
        `${API_BASE}/cambiar-estado?` +
        new URLSearchParams({
          order_id:        orderId,
          status:          'pending',
          woocommerce_url: cfg.woocommerce_url,
          consumer_key:    cfg.consumer_key,
          consumer_secret: cfg.consumer_secret
        }),
        { method: 'PUT', headers: getHeaders() }
      );

      // 8.2) Borra la línea antigua
      await fetch(
        `${API_BASE}/eliminar-item?` +
        new URLSearchParams({
          order_id:        orderId,
          line_index:      lineIndex,
          woocommerce_url: cfg.woocommerce_url,
          consumer_key:    cfg.consumer_key,
          consumer_secret: cfg.consumer_secret
        }),
        { method: 'DELETE', headers: getHeaders() }
      );

      // 8.3) Cálculo de totales a nivel de LÍNEA
      const rate      = vatPct / 100;
      const subtotal  = parseFloat((totalIncl / (1 + rate)).toFixed(2));
      const totalTax  = parseFloat((totalIncl - subtotal).toFixed(2));
      // unitario neto (opcional)
      const priceExcl = parseFloat((subtotal / qtyNum).toFixed(2));

      // 8.4) Payload con TOTAL exacto de la línea
      const payload = {
        product_id:   Number(productId),
        variation_id: newVarId,
        quantity:     qtyNum,
        price:        priceExcl.toFixed(2),
        subtotal:     subtotal.toFixed(2),
        total:        totalIncl.toFixed(2),
        subtotal_tax: totalTax.toFixed(2),
        total_tax:    totalTax.toFixed(2),
        ...cfg
      };

      // 8.5) Añade la línea nueva
      const resAdd = await fetch(
        `${API_BASE}/anadir-item?order_id=${orderId}`,
        {
          method:  'POST',
          headers: {
            ...getHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );
      if (!resAdd.ok) {
        const text = await resAdd.text();
        return showMessage(form.parentNode, `Error: ${text}`, 'error');
      }

      // 8.6) Vuelve a cargar pedidos y cierra
      showMessage(form.parentNode, 'Artículo actualizado');
      await loadPedidos();
      form.style.display = 'none';
    });

    // 9) Inserta el form tras el botón
    btn.insertAdjacentElement('afterend', form);
  }

  // 10) Toggle visibilidad
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  return;
}

// ——— 6) Añadir artículo con precio TOTAL (IVA incluido) ———
if (e.target.matches('.btn-add-item')) {
  const btn     = e.target;
  const orderId = btn.dataset.orderId;
  let form      = btn.parentNode.querySelector('.add-item-form');

  if (!form) {
    form = document.createElement('div');
    form.className = 'add-item-form mt-2 mb-3';

    // 1) Select de productos
    const selProd = document.createElement('select');
    selProd.className = 'form-control mb-2';
    selProd.innerHTML = '<option value="">— Selecciona producto —</option>';
    productsList.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.text  = p.name;
      selProd.appendChild(opt);
    });
    form.appendChild(selProd);

    // 2) Select de variaciones (oculto hasta saber si hay)
    const selVar = document.createElement('select');
    selVar.className = 'form-control mb-2';
    selVar.innerHTML = '<option value="">— Selecciona variación —</option>';
    selVar.style.display = 'none';
    form.appendChild(selVar);

    // Bandera para saber si el producto tiene variaciones
    let hasVariations = false;

    // 3) Input de cantidad
    const qtyInput = document.createElement('input');
    qtyInput.type        = 'number';
    qtyInput.min         = '1';
    qtyInput.placeholder = 'Cantidad';
    qtyInput.className   = 'form-control mb-2';
    form.appendChild(qtyInput);

    // 4) Input precio TOTAL (IVA incluido)
    const totalInclInput = document.createElement('input');
    totalInclInput.type        = 'number';
    totalInclInput.step        = '0.01';
    totalInclInput.min         = '0.01';
    totalInclInput.placeholder = 'Precio total (IVA incl.)';
    totalInclInput.className   = 'form-control mb-2';
    form.appendChild(totalInclInput);

    // 5) Input % IVA
    const vatInput = document.createElement('input');
    vatInput.type        = 'number';
    vatInput.step        = '0.01';
    vatInput.min         = '0';
    vatInput.value       = '21';
    vatInput.placeholder = '% IVA';
    vatInput.className   = 'form-control mb-3';
    form.appendChild(vatInput);

    // 6) Botones Aceptar / Cancelar
    const btnOk = document.createElement('button');
    btnOk.type      = 'button';
    btnOk.innerText = '✓ Aceptar';
    btnOk.disabled  = true;
    btnOk.className = 'btn btn-success mr-2';

    const btnCancel = document.createElement('button');
    btnCancel.type      = 'button';
    btnCancel.innerText = '✖ Cancelar';
    btnCancel.className = 'btn btn-danger';
    btnCancel.addEventListener('click', () => form.style.display = 'none');

    const btnGroup = document.createElement('div');
    btnGroup.className = 'd-flex';
    btnGroup.append(btnOk, btnCancel);
    form.appendChild(btnGroup);

    // 7) Carga de variaciones al elegir producto
    selProd.addEventListener('change', async () => {
      selVar.innerHTML = '<option value="">— Selecciona variación —</option>';
      if (selProd.value) {
        const { woocommerce_url, consumer_key, consumer_secret } = getWooConfig();
        const params = new URLSearchParams({
          product_id:      selProd.value,
          woocommerce_url,
          consumer_key,
          consumer_secret
        });
        const res = await fetch(`${API_BASE}/get-variaciones?${params}`, { headers: getHeaders() });
        const vars = await res.json();

        if (vars.length > 0) {
          hasVariations = true;
          vars.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.text  = v.attributes.map(a => `${a.name}: ${a.option}`).join(', ');
            selVar.appendChild(opt);
          });
          selVar.style.display = '';  // mostramos el select
        } else {
          hasVariations = false;
          selVar.style.display = 'none'; // no hay variaciones
        }
      } else {
        hasVariations = false;
        selVar.style.display = 'none';
      }
      toggleOk();
    });

    // 8) Habilitar “Aceptar” sólo cuando todo esté completo
    function toggleOk() {
      const basicFilled = selProd.value && qtyInput.value && totalInclInput.value && vatInput.value;
      const varFilled   = !hasVariations || selVar.value;
      btnOk.disabled    = !(basicFilled && varFilled);
    }
    [selProd, selVar, qtyInput, totalInclInput, vatInput].forEach(el =>
      el.addEventListener('input', toggleOk)
    );

    // 9) Envío: cálculo de totales a nivel de LÍNEA (para no perder céntimos)
    btnOk.addEventListener('click', async () => {
      const product_id   = Number(selProd.value);
      const variation_id = hasVariations ? Number(selVar.value) : null;
      const qtyNum       = Number(qtyInput.value);
      const totalIncl    = parseFloat(totalInclInput.value.replace(',', '.'));
      const vatRatePct   = parseFloat(vatInput.value.replace(',', '.'));

      // 9.1) Tipo de IVA
      const rate = vatRatePct / 100;

      // 9.2) Subtotal excluyendo IVA (línea entera), redondeo único
      const subtotalExcl = parseFloat((totalIncl / (1 + rate)).toFixed(2));

      // 9.3) IVA total de la línea
      const totalTax = parseFloat((totalIncl - subtotalExcl).toFixed(2));

      // 9.4) Unitarios si los necesitas
      const priceExcl = parseFloat((subtotalExcl / qtyNum).toFixed(2));

      // 9.5) Payload manteniendo el total exacto
      const payload = {
        product_id,
        quantity:  qtyNum,
        ...(variation_id ? { variation_id } : {}),
        subtotal:      subtotalExcl.toFixed(2),
        total:         totalIncl.toFixed(2),
        subtotal_tax:  totalTax.toFixed(2),
        total_tax:     totalTax.toFixed(2),
        price:         priceExcl.toFixed(2),
        ...getWooConfig()
      };

      // 9.6) Llamada POST con JSON body
      try {
        const res = await fetch(
          `${API_BASE}/anadir-item?order_id=${orderId}`,
          {
            method:  'POST',
            headers: {
              ...getHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          }
        );
        if (!res.ok) {
          const text = await res.text();
          return showMessage(form.parentNode, `Error: ${text}`, 'error');
        }
        showMessage(form.parentNode, 'Artículo añadido');
        await loadPedidos();
        form.style.display = 'none';
      } catch (err) {
        console.error('Error añadiendo artículo:', err);
        showMessage(form.parentNode, 'Error inesperado al añadir', 'error');
      }
    });

    // 10) Insertar el formulario en el DOM
    btn.insertAdjacentElement('afterend', form);
  }

  // 11) Alternar visibilidad
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
  await loadCallbellTemplates();
});
