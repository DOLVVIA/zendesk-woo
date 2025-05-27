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
      consumer_key:    SETTINGS.woocommerce_consumer_key,
      consumer_secret: SETTINGS.woocommerce_consumer_secret
    };
  }

  function getStripeConfig() {
    return { stripe_secret_key: SETTINGS.stripe_secret_key };
  }

  function getPayPalConfig() {
    return {
      paypal_client_id: SETTINGS.paypal_client_id,
      paypal_secret:    SETTINGS.paypal_secret,
      paypal_mode:      SETTINGS.paypal_mode || 'sandbox'
    };
  }

  let orderStatuses = [];
  let productsList   = [];
  let citiesList     = [];
  let provincesList  = [];

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

async function loadCities(country = 'ES') {
  citiesList = [];
  try {
    const { woocommerce_url, consumer_key, consumer_secret } = getWooConfig();
    const url = `${API_BASE}/get-ciudades?country=${encodeURIComponent(country)}&` +
      `woocommerce_url=${encodeURIComponent(woocommerce_url)}&` +
      `consumer_key=${encodeURIComponent(consumer_key)}&` +
      `consumer_secret=${encodeURIComponent(consumer_secret)}`;
    const res = await fetch(url, { headers: getHeaders() });
    citiesList = await res.json();
  } catch (e) {
    console.error(e);
  }
}

async function loadProvincias(country = 'ES') {
  if (provincesList.length) return;
  try {
    const { woocommerce_url, consumer_key, consumer_secret } = getWooConfig();
    const url = `${API_BASE}/get-provincias?country=${encodeURIComponent(country)}&` +
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

  // Carga las transacciones de PayPal para un email dado
  async function loadPayPalTransactions(email) {
    try {
      const { paypal_client_id, paypal_secret, paypal_mode } = getPayPalConfig();
      const url = `${API_BASE}/get-paypal-transactions?` +
        `email=${encodeURIComponent(email)}` +
        `&paypal_client_id=${encodeURIComponent(paypal_client_id)}` +
        `&paypal_secret=${encodeURIComponent(paypal_secret)}` +
        `&paypal_mode=${encodeURIComponent(paypal_mode)}`;
      console.log('🔍 PayPal URL:', url);
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error('❌ loadPayPalTransactions:', e);
      return [];
    }
  }
  // fin paypal //

  //CARGAMOS TRANSFERENCIAS DE MONEI //
async function loadMoneiCharges(email) {
  try {
    const monei_api_key = SETTINGS.monei_api_key;
    const url = `${API_BASE}/get-monei-charges?email=${encodeURIComponent(email)}`;
    console.log('🔍 MONEI URL:', url);
    const res = await fetch(url, {
      headers: {
        ...getHeaders(),
        'x-monei-api-key': monei_api_key // ✅ AQUÍ ESTÁ BIEN
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('❌ loadMoneiCharges:', e);
    return [];
  }
}

// FIN TRANSFERENCIAS DE MONEI //

// REEMBOLSOS MONEI INICIO //
async function refundMonei(chargeId, amount, panel) {
  try {
    const orderId = panel.dataset.orderId;
    const payload = { orderId, chargeId, amount };

    const res = await fetch(`${API_BASE}/refund-monei`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        'Content-Type': 'application/json' // ✅ Solo esta, no Authorization
      },
      body: JSON.stringify({ 
        ...payload,
        monei_api_key: SETTINGS.monei_api_key // El backend ya montará el Basic Auth
      })
    });

    const { success, refund, error } = await res.json();
    if (!success) {
      showMessage(panel, `❌ Error reembolso: ${error}`, 'error');
      return;
    }

    showMessage(panel, `✅ Reembolso MONEI OK (ID: ${refund.id})`);

    // Re-renderizar los cargos MONEI
    const billing = JSON.parse(panel.dataset.billing);
    const charges = await loadMoneiCharges(billing.email);
    const container = panel.querySelector('.monei-container');
    renderMoneiCharges(charges, container, panel);

  } catch (e) {
    console.error('🛑 Exception en refundMonei:', e);
    showMessage(panel, `Error inesperado: ${e.message}`, 'error');
  }
}


//FIN REEMBOLSOS MONEI//



// 1) Hacemos el reembolso en Stripe y Woo, actualizamos solo el bloque de Stripe y colapsamos el panel
async function refundStripe(chargeId, amount, panel) {
  try {
    const orderId = panel.dataset.orderId;
    const payload = { orderId, chargeId, amount, ...getStripeConfig() };
    console.log('📦 Payload enviado a /refund-stripe:', payload);

    const res = await fetch(`${API_BASE}/refund-stripe`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      let errMsg;
      try { errMsg = (await res.json()).error; }
      catch { errMsg = await res.text(); }
      console.error('❌ /refund-stripe error:', res.status, errMsg);
      showMessage(panel, `Error reembolso: ${errMsg}`, 'error');
      return;
    }

    const { success, refund, error } = await res.json();
    if (!success) {
      showMessage(panel, `❌ Error reembolso: ${error}`, 'error');
      return;
    }

    // ✅ Éxito: mensaje + colapsar el accordion
    showMessage(panel, `✅ Reembolso OK (ID: ${refund.id})`);
    const acc = panel.previousElementSibling;
    if (acc && acc.classList.contains('accordion')) {
      // activa el mismo toggle que el listener global para que cierre + ajuste altura
      acc.click();
      panel.style.display = 'none';
      acc.classList.remove('active');
      ajustarAlto();
    }

    // 🔄 Re-renderizar solo el bloque de Stripe de este panel
    const billing = JSON.parse(panel.dataset.billing);
    const charges = await loadStripeCharges(billing.email);
    const stripeContainer = panel.querySelector('.stripe-container');
    renderStripeCharges(charges, stripeContainer, panel);

  } catch (e) {
    console.error('🛑 Exception en refundStripe:', e);
    showMessage(panel, `Error inesperado: ${e.message}`, 'error');
  }
}


// 2) Renderiza únicamente los cargos de Stripe dentro de `stripeContainer`
function renderStripeCharges(charges, container, panel) {
  container.innerHTML = '';

  if (!charges.length) {
    const p = document.createElement('p');
    p.className = 'mb-2';
    p.innerText = 'No hay cargos de Stripe para este cliente.';
    container.appendChild(p);
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
    const fecha    = new Date(c.created * 1000).toLocaleString();
    const title    = `${c.metadata?.products || c.description || c.id} (${fecha})`;
    const amount   = (c.amount / 100).toFixed(2);
    const refunded = (c.amount_refunded || 0) / 100;
    const isFull   = c.amount_refunded === c.amount;
    const isPartial= c.amount_refunded > 0 && c.amount_refunded < c.amount;

    let statusTxt, badgeClass;
    if (isFull) {
      statusTxt  = 'Reembolsado';
      badgeClass = 'success';
    } else if (isPartial) {
      statusTxt  = `Parcial (${refunded.toFixed(2)} €)`;
      badgeClass = 'warning';
    } else if (c.status === 'succeeded') {
      statusTxt  = 'Exitoso';
      badgeClass = 'success';
    } else {
      statusTxt  = 'Fallido';
      badgeClass = 'danger';
    }

    const li = document.createElement('li');
    li.className = 'mb-4 w-100';
    li.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div>${title} — ${amount} €</div>
        <div><span class="badge badge-${badgeClass}">${statusTxt}</span></div>
      </div>
    `;

    // Botón completo
    const btnFull = document.createElement('button');
    btnFull.type      = 'button';
    btnFull.innerText = 'Reembolso completo';
    btnFull.disabled  = isFull;
    btnFull.className = 'btn btn-danger btn-block mb-2';
    btnFull.addEventListener('click', () => refundStripe(c.id, c.amount, panel));
    li.appendChild(btnFull);

    // Botón parcial + form oculto ...
    const btnPartial = document.createElement('button');
    btnPartial.type      = 'button';
    btnPartial.innerText = 'Reembolso parcial';
    btnPartial.disabled  = isFull;
    btnPartial.className = 'btn btn-warning btn-block mb-2';
    li.appendChild(btnPartial);

    const form = document.createElement('form');
    form.className    = 'mt-2 mb-3 w-100';
    form.style.display= 'none';

    const input = document.createElement('input');
    input.type        = 'number';
    input.name        = 'partial';
    input.step        = '0.01';
    input.min         = '0.01';
    input.max         = amount;
    input.placeholder = `Ej: hasta ${amount}`;
    input.required    = true;
    input.className   = 'form-control mb-2';
    form.appendChild(input);

    const ok = document.createElement('button');
    ok.type      = 'submit';
    ok.innerText = '✓ Aceptar';
    ok.className = 'btn btn-success btn-block mb-2';
    form.appendChild(ok);

    const cancel = document.createElement('button');
    cancel.type      = 'button';
    cancel.innerText = '✖ Cancelar';
    cancel.className = 'btn btn-danger btn-block';
    form.appendChild(cancel);

    li.appendChild(form);

    btnPartial.addEventListener('click', () => {
      form.style.display = 'block';
      btnPartial.style.display = 'none';
    });
    cancel.addEventListener('click', () => {
      form.style.display = 'none';
      btnPartial.style.display = 'block';
      input.value = '';
    });

    form.addEventListener('submit', async ev => {
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

//refund paypal//
// 3) Hacer refund en PayPal (completo o parcial)
async function refundPayPal(transactionId, panel, currency, amount) {
  try {
    // Obtener credenciales PayPal
    const { paypal_client_id, paypal_secret, paypal_mode } = getPayPalConfig();
    // Construir payload
    const payload = {
      transactionId,
      amount:        typeof amount === 'number' ? amount.toFixed(2) : amount,
      currency,
      paypal_client_id,
      paypal_secret,
      paypal_mode
    };

    // Llamada al endpoint de refund-paypal
    const res = await fetch(`${API_BASE}/refund-paypal`, {
      method:  'POST',
      headers: getHeaders(),
      body:    JSON.stringify(payload)
    });
    if (!res.ok) {
      // Intentar extraer mensaje de error
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Error en refund PayPal');
    }

    const { refund } = await res.json();
    // Mostrar mensaje de éxito
    showMessage(panel, `✅ Reembolso PayPal OK (ID: ${refund.id})`);

    // Volver a cargar las transacciones de PayPal para actualizar el estado
    const billingEmail = JSON.parse(panel.dataset.billing).email;
    const txs = await loadPayPalTransactions(billingEmail);
    const paypalContainer = panel.querySelector('.paypal-container');
    renderPayPalTransactions(txs, paypalContainer, panel);

  } catch (e) {
    console.error('❌ Error en refundPayPal:', e);
    showMessage(panel, `Error reembolso PayPal: ${e.message}`, 'error');
  }
}
//fin refund

async function renderPayPalTransactions(txs, container, panel) {
  container.innerHTML = '';

  const details = document.createElement('details');
  details.className = 'paypal-payments mt-2 mb-3';

  const summary = document.createElement('summary');
  summary.className = 'font-weight-bold';
  summary.innerText = `Transacciones PayPal (${txs.length})`;
  details.appendChild(summary);
  
  //boton cargar paypal 
  const btnCargarPaypal = document.createElement('button');
btnCargarPaypal.id = 'load-paypal-transactions';
btnCargarPaypal.innerText = '🔍 Cargar transacciones de PayPal';
btnCargarPaypal.className = 'btn btn-secondary btn-block mb-2';
details.appendChild(btnCargarPaypal);

btnCargarPaypal.addEventListener('click', async () => {
  const billingEmail = JSON.parse(panel.dataset.billing).email;
  if (!billingEmail) return alert('No hay email de facturación');

  btnCargarPaypal.disabled = true;
  btnCargarPaypal.innerText = '⏳ Cargando...';

  const transacciones = await loadPayPalTransactions(billingEmail);
  console.log('📦 Transacciones PayPal:', transacciones);
  renderPayPalTransactions(transacciones, container, panel);
});

//fin boton cargar paypal 
  
  
  
  // Buscador manual
  const searchDiv = document.createElement('div');
  searchDiv.className = 'mb-3';
  searchDiv.innerHTML = `
    <label><strong>Buscar transacciones PayPal por email:</strong></label>
    <input type="email" id="paypal-manual-email" class="form-control mb-2" placeholder="ej: cliente@paypal.com" />
    <button class="btn btn-primary btn-block mb-3" id="buscar-paypal-email">Buscar</button>
  `;
  details.appendChild(searchDiv);

  searchDiv.querySelector('#buscar-paypal-email').addEventListener('click', async () => {
    const email = searchDiv.querySelector('#paypal-manual-email').value.trim();
    if (!email) return alert('Introduce un email válido');
    const newTxs = await loadPayPalTransactions(email);
    renderPayPalTransactions(newTxs, container, panel);
  });

  if (!txs.length) {
    const noData = document.createElement('p');
    noData.innerText = 'No hay transacciones PayPal para este cliente.';
    noData.className = 'mb-2';
    details.appendChild(noData);
    container.appendChild(details);
    return;
  }

  const ul = document.createElement('ul');
  ul.className = 'list-unstyled w-100';

  txs.forEach(tx => {
    const amountVal = parseFloat(tx.amount.value);
    const refundedVal = Math.abs(parseFloat(tx.refunded_amount || 0));
    const isRefunded = refundedVal > 0;
    const isPartial = isRefunded && refundedVal < amountVal;

    let badgeClass, statusTxt;
    if (isRefunded) {
      statusTxt = `Reembolsado (${refundedVal.toFixed(2)} €)`;
      badgeClass = isPartial ? 'warning' : 'info';
    } else {
      statusTxt = 'Completado';
      badgeClass = 'success';
    }

    const li = document.createElement('li');
    li.className = 'mb-4 w-100';
    li.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-1">
        <div>ID: ${tx.id} — ${amountVal.toFixed(2)} ${tx.amount.currency_code}</div>
        <div><span class="badge badge-${badgeClass}">${statusTxt}</span></div>
      </div>
      <div>Fecha: ${new Date(tx.date).toLocaleString()}</div>
    `;

    // Reembolso completo
    const btnFull = document.createElement('button');
    btnFull.type = 'button';
    btnFull.innerText = 'Reembolso completo';
    btnFull.className = 'btn btn-danger btn-block mt-2';
    btnFull.disabled = isRefunded;
    btnFull.addEventListener('click', () =>
      refundPayPal(tx.id, panel, tx.amount.currency_code, amountVal)
    );
    li.appendChild(btnFull);

    // Reembolso parcial
    const btnPartial = document.createElement('button');
    btnPartial.type = 'button';
    btnPartial.innerText = 'Reembolso parcial';
    btnPartial.className = 'btn btn-warning btn-block mt-2';
    btnPartial.disabled = isRefunded;
    li.appendChild(btnPartial);

    const formPartial = document.createElement('form');
    formPartial.className = 'mt-2 mb-3 w-100';
    formPartial.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'number';
    input.name = 'partial';
    input.step = '0.01';
    input.min = '0.01';
    input.max = amountVal.toFixed(2);
    input.placeholder = `Ej: hasta ${amountVal.toFixed(2)}`;
    input.required = true;
    input.className = 'form-control mb-2';
    formPartial.appendChild(input);

    const acceptBtn = document.createElement('button');
    acceptBtn.type = 'submit';
    acceptBtn.innerText = '✓ Aceptar';
    acceptBtn.className = 'btn btn-success btn-block mb-2';
    formPartial.appendChild(acceptBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.innerText = '✖ Cancelar';
    cancelBtn.className = 'btn btn-danger btn-block';
    formPartial.appendChild(cancelBtn);

    li.appendChild(formPartial);

    btnPartial.addEventListener('click', () => {
      formPartial.style.display = 'block';
      btnPartial.style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => {
      formPartial.style.display = 'none';
      btnPartial.style.display = 'block';
      input.value = '';
    });

    formPartial.addEventListener('submit', async ev => {
      ev.preventDefault();
      const val = parseFloat(input.value.replace(',', '.'));
      if (isNaN(val) || val <= 0 || val > amountVal) {
        return alert(`Importe inválido (0 < importe ≤ ${amountVal.toFixed(2)})`);
      }
      const reAmount = val.toFixed(2);
      await refundPayPal(tx.id, panel, tx.amount.currency_code, reAmount);
    });

    ul.appendChild(li);
  });

  details.appendChild(ul);
  container.appendChild(details);
}





/**
 * Renderiza los cargos de MONEI con botones de reembolso idénticos a Stripe
 */
function renderMoneiCharges(charges, container, panel) {
  container.innerHTML = '';

  // Si no hay cargos, mensaje de “no data”
  if (!charges.length) {
    const p = document.createElement('p');
    p.className = 'mb-2';
    p.innerText = 'No hay transacciones MONEI para este cliente.';
    container.appendChild(p);
    return;
  }

  // <details> principal
  const details = document.createElement('details');
  details.className = 'monei-payments mt-2 mb-3';

  const summary = document.createElement('summary');
  summary.className = 'font-weight-bold';
  summary.innerText = `Transacciones MONEI (${charges.length})`;
  details.appendChild(summary);

  const ul = document.createElement('ul');
  ul.className = 'list-unstyled w-100';

  charges.forEach(c => {
    // fecha formateada
    const fecha = new Date(c.createdAt).toLocaleString();
    const amount = (c.amount / 100).toFixed(2);

    // determina status y clase badge
    let statusTxt, badgeClass;
    if (c.status === 'succeeded') {
      statusTxt  = 'Exitoso';
      badgeClass = 'success';
    } else if (c.status === 'refunded') {  // esto puede variar según MONEI
      statusTxt  = 'Reembolsado';
      badgeClass = 'success';
    } else {
      statusTxt  = c.status.toUpperCase();
      badgeClass = 'danger';
    }

    // <li> contenedor de un cargo
    const li = document.createElement('li');
    li.className = 'mb-4 w-100';
    li.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div>
          ID: ${c.id} — ${fecha}
        </div>
        <div>
          <span class="badge badge-${badgeClass}">
            ${statusTxt}
          </span>
        </div>
      </div>
      <div class="mb-2">
        <strong>Importe:</strong> ${amount} ${c.currency}
      </div>
    `;

    // Botón de reembolso completo
    const btnFull = document.createElement('button');
    btnFull.type      = 'button';
    btnFull.innerText = 'Reembolso completo';
    btnFull.disabled  = (c.status.toLowerCase() !== 'succeeded');  // sólo si aún no está reembolsado
    btnFull.className = 'btn btn-danger btn-block mb-2';
    btnFull.addEventListener('click', () => refundMonei(c.id, c.amount, panel));
    li.appendChild(btnFull);

    // Botón de reembolso parcial
    const btnPartial = document.createElement('button');
    btnPartial.type      = 'button';
    btnPartial.innerText = 'Reembolso parcial';
    btnPartial.disabled  = (c.status.toLowerCase() !== 'succeeded');
    btnPartial.className = 'btn btn-warning btn-block mb-2';
    li.appendChild(btnPartial);

    // Formulario oculto de parcial
    const form = document.createElement('form');
    form.className     = 'mt-2 mb-3 w-100';
    form.style.display = 'none';

    const input = document.createElement('input');
    input.type        = 'number';
    input.name        = 'partial';
    input.step        = '0.01';
    input.min         = '0.01';
    input.max         = amount;
    input.placeholder = `Ej: hasta ${amount}`;
    input.required    = true;
    input.className   = 'form-control mb-2';
    form.appendChild(input);

    const ok = document.createElement('button');
    ok.type      = 'submit';
    ok.innerText = '✓ Aceptar';
    ok.className = 'btn btn-success btn-block mb-2';
    form.appendChild(ok);

    const cancel = document.createElement('button');
    cancel.type      = 'button';
    cancel.innerText = '✖ Cancelar';
    cancel.className = 'btn btn-danger btn-block';
    form.appendChild(cancel);

    li.appendChild(form);

    // Mostrar/ocultar el form
    btnPartial.addEventListener('click', () => {
      form.style.display       = 'block';
      btnPartial.style.display = 'none';
    });
    cancel.addEventListener('click', () => {
      form.style.display       = 'none';
      btnPartial.style.display = 'block';
      input.value              = '';
    });

    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const val = parseFloat(input.value.replace(',', '.'));
      if (isNaN(val) || val <= 0 || val > parseFloat(amount)) {
        return alert(`Importe inválido (0 < importe ≤ ${amount})`);
      }
      const cents = Math.round(val * 100);
      await refundMonei(c.id, cents, panel);
    });

    ul.appendChild(li);
  });

  details.appendChild(ul);
  container.appendChild(details);
}







  async function loadPedidos() {
    const { 'ticket.requester.email': email } = await client.get('ticket.requester.email');
      // Solo inyectar el buscador manual si aún no existe
  if (!document.getElementById('btn-buscar-pedido')) {
   // === INICIO BLOQUE: BUSCADOR MANUAL DE PEDIDOS ===
// Este bloque añade un formulario para buscar pedidos por ID, email o nombre.
// Usa las mismas claves y funciones que el resto de tu app.

const appContainer = document.getElementById('app');
// === INICIO BLOQUE: BOTÓN LIMPIAR CACHÉ ===
// Este botón fuerza al backend a eliminar la caché de productos, ciudades, provincias, etc.

const btnResetCache = document.createElement('button');
btnResetCache.innerText = '🔄 Refrescar datos (limpiar caché)';
btnResetCache.className = 'btn btn-danger mb-3';
btnResetCache.style.marginBottom = '1rem';
btnResetCache.addEventListener('click', async () => {
  try {
    const res = await fetch(`${API_BASE}/limpiar-cache`, {
      method: 'POST',
      headers: getHeaders()
    });
    const json = await res.json();
    alert(json.message || 'Caché limpiada correctamente.');
  } catch (err) {
    alert('Error al limpiar la caché.');
    console.error('❌ limpiar-cache:', err);
  }
});

appContainer.prepend(btnResetCache);

// === FIN BLOQUE: BOTÓN LIMPIAR CACHÉ ===

const buscadorDiv = document.createElement('div');
buscadorDiv.innerHTML = `
  <div class="mb-3 p-3 bg-light border rounded">
    <h5>Buscar pedido manualmente</h5>
    <input type="text" class="form-control mb-2" id="buscar-id" placeholder="ID de pedido">
    <input type="text" class="form-control mb-2" id="buscar-email" placeholder="Email">
    <input type="text" class="form-control mb-2" id="buscar-nombre" placeholder="Nombre">
    <button class="btn btn-primary" id="btn-buscar-pedido">Buscar</button>
  </div>
  <div id="resultados-busqueda" class="mt-3"></div>
`;
appContainer.prepend(buscadorDiv);
ajustarAlto();

// Escuchar clic en el botón de buscar
document.getElementById('btn-buscar-pedido').addEventListener('click', async () => {
  const id = document.getElementById('buscar-id').value.trim();
  const email = document.getElementById('buscar-email').value.trim();
  const nombre = document.getElementById('buscar-nombre').value.trim();

  // Usamos la función oficial de tu app para obtener las credenciales
  const { woocommerce_url, consumer_key, consumer_secret } = getWooConfig();

  const params = new URLSearchParams({
    woocommerce_url,
    consumer_key,
    consumer_secret
  });

  if (id) params.append('id', id);
  if (email) params.append('email', email);
  if (nombre) params.append('nombre', nombre);

const res = await fetch(`${API_BASE}/buscar-pedido-avanzado?${params.toString()}`, {
  headers: getHeaders()
});


  const data = await res.json();
  const contenedor = document.getElementById('resultados-busqueda');
  contenedor.innerHTML = '';

  if (!data.pedidos || data.pedidos.length === 0) {
    contenedor.innerHTML = '<p>No se encontraron pedidos.</p>';
    return;
  }


  // === INICIO BLOQUE: Función mostrarPedido() ===
// Esta función renderiza un pedido manualmente igual que en el flujo por email.
  async function mostrarPedido(pedido) {
  const resultados = document.getElementById('resultados');
  resultados.innerHTML = '';

  const country = pedido.billing?.country || 'ES';
  citiesList = [];
  provincesList = [];
  await loadCities(country);
  await loadProvincias(country);

  const acc = document.createElement('button');
  acc.className = 'accordion active';
  acc.innerText = `Pedido #${pedido.id} – ${pedido.total} € – ${pedido.status} – ${pedido.payment_method_title || 'Método desconocido'}`;

  const panel = document.createElement('div');
  panel.dataset.orderId = pedido.id;
  panel.className = 'panel';
  panel.style.display = 'block';
  panel.dataset.billing  = JSON.stringify(pedido.billing  || {});
  panel.dataset.shipping = JSON.stringify(pedido.shipping || {});

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

  pedido.line_items.forEach((item, idx) => {
    panel.innerHTML += `
      <div class="producto">
        ${item.image?.src ? `<img src="${item.image.src}" class="producto-img">` : ''}
        <strong>${item.name}</strong><br>
        (x${item.quantity})<br>
        SKU: ${item.sku||'Sin SKU'}<br>
        Variación: ${item.variation_id||'N/A'}<br>
        Precio (IVA incl.): ${(parseFloat(item.total) + parseFloat(item.total_tax)).toFixed(2)} €
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

  const btnAdd = document.createElement('button');
  btnAdd.className = 'btn-add-item';
  btnAdd.dataset.orderId = pedido.id;
  btnAdd.innerText = 'Añadir artículo';
  panel.appendChild(btnAdd);

  ///

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

  {
    const stripeContainer = document.createElement('div');
    stripeContainer.className = 'stripe-container mt-2 mb-3';
    const charges = b.email ? await loadStripeCharges(b.email) : [];
    renderStripeCharges(charges, stripeContainer, panel);
    panel.appendChild(stripeContainer);
  }

  {
    const paypalContainer = document.createElement('div');
    paypalContainer.className = 'paypal-container mt-2 mb-3';
    const txs = [];
    renderPayPalTransactions(txs, paypalContainer, panel);
    panel.appendChild(paypalContainer);
  }

  {
  const moneiContainer = document.createElement('div');
  moneiContainer.className = 'monei-container mt-2 mb-3';
  const charges = b.email ? await loadMoneiCharges(b.email) : [];
  renderMoneiCharges(charges, moneiContainer, panel);
  panel.appendChild(moneiContainer);
}


  resultados.appendChild(acc);
  resultados.appendChild(panel);
  ajustarAlto();
}
// === FIN BLOQUE: Función mostrarPedido() ===


data.pedidos.forEach(pedido => {
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="border p-2 mb-2">
      <strong>ID:</strong> ${pedido.id}<br>
      <strong>Email:</strong> ${pedido.billing?.email}<br>
      <strong>Nombre:</strong> ${pedido.billing?.first_name} ${pedido.billing?.last_name}<br>
    </div>
  `;

  const btn = document.createElement('button');
  btn.innerText = 'Ver pedido';
  btn.className = 'btn btn-sm btn-outline-primary mt-1';
  btn.addEventListener('click', () => mostrarPedido(pedido));
  div.querySelector('.border').appendChild(btn);

  contenedor.appendChild(div);
});

  ajustarAlto(); // actualiza el iframe por si se expandió
});

// === FIN BLOQUE: BUSCADOR MANUAL DE PEDIDOS ===
}

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
        const acc = document.createElement('button');
        acc.className = 'accordion';
        acc.innerText = `Pedido #${pedido.id} – ${pedido.total} € – ${pedido.status} – ${pedido.payment_method_title || 'Método desconocido'}`;

        const panel = document.createElement('div');
        panel.dataset.orderId = pedido.id;
        panel.className = 'panel';
        panel.dataset.billing  = JSON.stringify(pedido.billing  || {});
        panel.dataset.shipping = JSON.stringify(pedido.shipping || {});

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

        pedido.line_items.forEach((item, idx) => {
          panel.innerHTML += `
            <div class="producto">
              ${item.image?.src ? `<img src="${item.image.src}" class="producto-img">` : ''}
              <strong>${item.name}</strong><br>
              (x${item.quantity})<br>
              SKU: ${item.sku||'Sin SKU'}<br>
              Variación: ${item.variation_id||'N/A'}<br>
              Precio (IVA incl.): ${(parseFloat(item.total) + parseFloat(item.total_tax)).toFixed(2)} €
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

        // Sección Stripe
        {
          const stripeContainer = document.createElement('div');
          stripeContainer.className = 'stripe-container mt-2 mb-3';
          const charges = b.email ? await loadStripeCharges(b.email) : [];
          renderStripeCharges(charges, stripeContainer, panel);
          panel.appendChild(stripeContainer);
        }

        // Sección PayPal
        {
          const paypalContainer = document.createElement('div');
          paypalContainer.className = 'paypal-container mt-2 mb-3';
          const txs = [];
          renderPayPalTransactions(txs, paypalContainer, panel);
          panel.appendChild(paypalContainer);
        }

        //sección monei//
        {
         const moneiContainer = document.createElement('div');
         moneiContainer.className = 'monei-container mt-2 mb-3';
         const charges = b.email ? await loadMoneiCharges(b.email) : [];
         renderMoneiCharges(charges, moneiContainer, panel);
         panel.appendChild(moneiContainer);
       }
        // fin seccion monei //

        // Sección BBVA SEPA-TRANSFER
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
          bbvaDetails.appendChild(form);
          panel.appendChild(bbvaDetails);

          const amountInput = form.querySelector('input[name="amount"]');
          btnSubmit.disabled = true;
          amountInput.addEventListener('input', () => {
            const v = parseFloat(amountInput.value);
            btnSubmit.disabled = isNaN(v) || v <= 0 || v > 100;
          });
          btnCancel.addEventListener('click', () => {
            form.reset();
            btnSubmit.disabled = true;
            bbvaDetails.open = false;
          });
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
    const tipo = chooser.value;
    form.innerHTML = '';
    if (!tipo) {
      form.style.display = 'none';
      return;
    }

    const datos = tipo === 'facturación' ? billing : shipping;
    const country = datos.country || 'ES';

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
            value="${datos[key]||''}"
            class="form-control"
          />
        </div>`;
    });

    // Ciudad
if (citiesList.length > 0) {
  form.innerHTML += `
    <div class="form-group">
      <label>Ciudad</label>
      <select name="${tipo}_city" class="form-control">
        ${citiesList.map(c => `<option${c === datos.city ? ' selected' : ''}>${c}</option>`).join('')}
      </select>
    </div>`;
} else {
  form.innerHTML += `
    <div class="form-group">
      <label>Ciudad</label>
      <input name="${tipo}_city" class="form-control" value="${datos.city || ''}" placeholder="Ej: Lisboa" />
    </div>`;
}

    // Provincia (solo si país ES)
    if (country === 'ES') {
      form.innerHTML += `
        <div class="form-group">
          <label>Provincia</label>
          <select name="${tipo}_state" class="form-control">
            ${provincesList.map(p => `<option${p===datos.state ? ' selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>`;
    } else {
      // Campo de texto para países como PT donde no hay lista de provincias
      form.innerHTML += `
        <div class="form-group">
          <label>Región / Provincia</label>
          <input
            name="${tipo}_state"
            value="${datos.state || ''}"
            class="form-control"
            placeholder="Ej: Lisboa"
          />
        </div>`;
    }

    // Email y Teléfono (solo facturación)
    if (tipo === 'facturación') {
      form.innerHTML += `
        <div class="form-group">
          <label>Email</label>
          <input
            name="billing_email"
            value="${billing.email || ''}"
            class="form-control"
          />
        </div>
        <div class="form-group">
          <label>Teléfono</label>
          <input
            name="billing_phone"
            value="${billing.phone || ''}"
            class="form-control"
          />
        </div>`;
    }

    // Botones
    form.innerHTML += `
      <div class="d-flex">
        <button type="button" class="btn btn-success flex-fill mr-2 btn-save-address">✓ Aceptar</button>
        <button type="button" class="btn btn-danger flex-fill btn-cancel-address">✖ Cancelar</button>
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
      let newBilling = billing;
      let newShipping = shipping;

      if (tipo === 'facturación') {
        newBilling = {
          first_name: fd.get('facturación_first_name'),
          last_name:  fd.get('facturación_last_name'),
          address_1:  fd.get('facturación_address_1'),
          address_2:  fd.get('facturación_address_2'),
          postcode:   fd.get('facturación_postcode'),
          city:       fd.get('facturación_city'),
          email:      fd.get('billing_email'),
          phone:      fd.get('billing_phone'),
          state:      fd.get('facturación_state') || 'N/A'
        };
      } else {
        newShipping = {
          first_name: fd.get('envío_first_name'),
          last_name:  fd.get('envío_last_name'),
          address_1:  fd.get('envío_address_1'),
          address_2:  fd.get('envío_address_2'),
          postcode:   fd.get('envío_postcode'),
          city:       fd.get('envío_city'),
          state:      fd.get('envío_state') || 'N/A'
        };
      }

      const params = new URLSearchParams({
        order_id:  orderId,
        billing:   encodeURIComponent(JSON.stringify(newBilling)),
        shipping:  encodeURIComponent(JSON.stringify(newShipping)),
        woocommerce_url,
        consumer_key,
        consumer_secret
      });

      const res = await fetch(`${API_BASE}/editar-direccion?${params}`, {
        method: 'PUT',
        headers: getHeaders()
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

//FIN EDITAR DIRECCIÓN//


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
});

