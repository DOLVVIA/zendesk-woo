// zendesk/assets/script.js
const client = ZAFClient.init();

client.on('app.registered', async () => {
  const { settings: SETTINGS } = await client.metadata();
  const API_BASE = 'https://zendesk-woo.onrender.com/api';

  // Helpers
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

  // Cached data
  let orderStatuses = [];
  let productsList = [];
  let citiesList = [];
  let provincesList = [];

  // Resize helper
  function ajustarAlto() {
    client.invoke('resize', { height: `${document.body.scrollHeight}px` }).catch(console.error);
  }

  // Loaders
  async function loadOrderStatuses() {
    try {
      const res = await fetch(`${API_BASE}/get-estados`, {
        method: 'GET',
        headers: getHeaders(),
        body: JSON.stringify(getWooConfig())
      });
      orderStatuses = await res.json();
    } catch (e) {
      console.error(e);
    }
  }
  async function loadProducts() {
    if (productsList.length) return;
    try {
      const res = await fetch(`${API_BASE}/get-productos`, {
        method: 'GET',
        headers: getHeaders(),
        body: JSON.stringify(getWooConfig())
      });
      productsList = await res.json();
    } catch (e) {
      console.error(e);
    }
  }
  async function loadCities() {
    if (citiesList.length) return;
    try {
      const res = await fetch(`${API_BASE}/get-ciudades`, {
        method: 'GET',
        headers: getHeaders(),
        body: JSON.stringify(getWooConfig())
      });
      citiesList = await res.json();
    } catch (e) {
      console.error(e);
    }
  }
  async function loadProvincias() {
    if (provincesList.length) return;
    try {
      const res = await fetch(`${API_BASE}/get-provincias?country=ES`, {
        method: 'GET',
        headers: getHeaders(),
        body: JSON.stringify(getWooConfig())
      });
      provincesList = await res.json();
    } catch (e) {
      console.error(e);
    }
  }

  // Toasts
  function showMessage(panel, text, type = 'success') {
    const msg = document.createElement('div');
    msg.className = `inline-msg inline-msg--${type}`;
    msg.innerText = text;
    panel.prepend(msg);
    setTimeout(() => msg.remove(), 3000);
  }

  // Stripe
  async function loadStripeCharges(email) {
    try {
      const res = await fetch(
        `${API_BASE}/get-stripe-charges?email=${encodeURIComponent(email)}`,
        {
          method: 'GET',
          headers: getHeaders(),
          body: JSON.stringify(getStripeConfig())
        }
      );
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
          <span class="badge ${isFull||isPartial?'success':c.status==='succeeded'?'success':'failed'}">
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
          return alert('Importe inválido (0 < importe ≤ ' + amount + ')');
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

  // PayPal
  async function loadPayPalTransaction(captureId) {
    try {
      const res = await fetch(
        `${API_BASE}/get-paypal-transaction?captureId=${captureId}`,
        {
          method: 'GET',
          headers: getHeaders(),
          body: JSON.stringify(getPayPalConfig())
        }
      );
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
      const wrapper = document.createElement('div');
      wrapper.className = 'refund-buttons';
      wrapper.append(btnFull, btnPartial, formPartial);
      li.appendChild(wrapper);
      ul.appendChild(li);
    });
    details.appendChild(ul);
    container.appendChild(details);
  }

  // Load / Refresh Orders
  async function loadPedidos() {
    const { 'ticket.requester.email': email } = await client.get('ticket.requester.email');
    if (!email) return;
    const resultados = document.getElementById('resultados');
    resultados.innerHTML = '';
    try {
      const res = await fetch(
        `${API_BASE}/buscar-pedidos?email=${encodeURIComponent(email)}`,
        {
          method: 'GET',
          headers: getHeaders(),
          body: JSON.stringify(getWooConfig())
        }
      );
      const { pedidos } = await res.json();
      if (!pedidos.length) {
        resultados.innerHTML = `<p>No hay pedidos para <strong>${email}</strong>.</p>`;
        ajustarAlto();
        return;
      }
      await loadCities();
      await loadProvincias();
      pedidos.forEach(async pedido => {
        const acc = document.createElement('button');
        acc.className = 'accordion';
        acc.innerText = `Pedido #${pedido.id} – ${pedido.total} € – ${pedido.status}`;
        const panel = document.createElement('div');
        panel.className = 'panel';
        const b = pedido.billing || {};
        panel.innerHTML = `
          <p><strong>Cliente:</strong> ${b.first_name||''} ${b.last_name||''}</p>
          <p><strong>Email:</strong> ${b.email||''}</p>
          <p><strong>Teléfono:</strong> ${b.phone||''}</p>
          <p><strong>Dirección facturación:</strong> ${b.address_1||''} ${b.address_2||''}, ${b.postcode||''} ${b.city||''}, ${b.country||''}</p>
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
              Precio: ${item.total} €
            </div>
            <button class="btn-edit-item" data-order-id="${pedido.id}" data-index="${idx}" data-product-id="${item.product_id}">Editar talla/cantidad</button>
            <button class="btn-delete-item" data-order-id="${pedido.id}" data-index="${idx}">Eliminar artículo</button>
          `;
        });
        const btnAdd = document.createElement('button');
        btnAdd.className = 'btn-add-item';
        btnAdd.dataset.orderId = pedido.id;
        btnAdd.innerText = 'Añadir artículo';
        panel.appendChild(btnAdd);
        const btnStatus = document.createElement('button');
        btnStatus.className = 'btn-change-status';
        btnStatus.dataset.orderId = pedido.id;
        btnStatus.dataset.status = pedido.status;
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
          <label>Nombre:<input name="first_name" type="text" value="${b.first_name||''}"></label>
          <label>Apellidos:<input name="last_name" type="text" value="${b.last_name||''}"></label>
          <label>Teléfono:<input name="phone" type="text" value="${b.phone||''}"></label>
          <label>Dirección:<input name="address_1" type="text" value="${b.address_1||''}"></label>
          <label>Dirección opc.:<input name="address_2" type="text" value="${b.address_2||''}"></label>
          <label>Provincia:
            <select name="state">
              ${[b.state||'',...provincesList.filter(p=>p!==b.state)].filter(Boolean).map(p=>`<option value="${p}" ${p===b.state?'selected':''}>${p}</option>`).join('')}
            </select>
          </label>
          <label>Ciudad:
            <select name="city">
              ${[b.city||'',...citiesList.filter(c=>c!==b.city)].filter(Boolean).map(c=>`<option value="${c}" ${c===b.city?'selected':''}>${c}</option>`).join('')}
            </select>
          </label>
          <label>Código postal:<input name="postcode" type="text" value="${b.postcode||''}"></label>
          <label>País:<input name="country" type="text" value="${b.country||''}"></label>
          <h4>Envío</h4>
          <label>Dirección envío:<input name="shipping_address_1" type="text" value="${pedido.shipping?.address_1||''}"></label>
          <label>Dirección opc. envío:<input name="shipping_address_2" type="text" value="${pedido.shipping?.address_2||''}"></label>
          <label>Provincia envío:
            <select name="shipping_state">
              ${[pedido.shipping?.state||'',...provincesList.filter(p=>p!==pedido.shipping?.state)].filter(Boolean).map(p=>`<option value="${p}" ${p===pedido.shipping?.state?'selected':''}>${p}</option>`).join('')}
            </select>
          </label>
          <label>Ciudad envío:
            <select name="shipping_city">
              ${[pedido.shipping?.city||'',...citiesList.filter(c=>c!==pedido.shipping?.city)].filter(Boolean).map(c=>`<option value="${c}" ${c===pedido.shipping?.city?'selected':''}>${c}</option>`).join('')}
            </select>
          </label>
          <label>Código postal envío:<input name="shipping_postcode" type="text" value="${pedido.shipping?.postcode||''}"></label>
          <label>País envío:<input name="shipping_country" type="text" value="${pedido.shipping?.country||''}"></label>
          <button type="button" class="btn-save-address">Guardar Dirección</button>
        `;
        panel.appendChild(formAddr);
        const stripeSection = document.createElement('div');
        stripeSection.className = 'stripe-section';
        stripeSection.innerHTML = '<h4>Cargos Stripe</h4>';
        panel.appendChild(stripeSection);
        const charges = await loadStripeCharges(b.email);
        renderStripeCharges(charges, stripeSection, panel);
        const captureId =
          pedido.transaction_id ||
          (pedido.meta_data?.find(m => m.key === 'transaction_id')?.value);
        const paypalSection = document.createElement('div');
        paypalSection.className = 'paypal-section';
        paypalSection.innerHTML = '<h4>Transacción PayPal</h4>';
        panel.appendChild(paypalSection);
        if (captureId) {
          const paypalTxs = await loadPayPalTransaction(captureId);
          renderPayPalTransactions(paypalTxs, paypalSection, panel);
        } else {
          paypalSection.innerHTML += '<p>No hay transacción PayPal para este pedido.</p>';
        }
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

  // Event listeners for item edit, delete, add, status change, address edit/save
  document.addEventListener('click', async e => {
    // Edit item
    if (e.target.matches('.btn-edit-item')) {
      const btn = e.target;
      const orderId = btn.dataset.orderId;
      const lineIndex = +btn.dataset.index;
      const productId = btn.dataset.productId;
      const panel = btn.closest('.panel');
      const productos = Array.from(panel.querySelectorAll('.producto'));
      const prodDiv = productos[lineIndex];
      let vars = [];
      try {
        const res = await fetch(
          `${API_BASE}/get-variaciones?product_id=${productId}`,
          {
            method: 'GET',
            headers: getHeaders(),
            body: JSON.stringify(getWooConfig())
          }
        );
        vars = await res.json();
      } catch {}
      const match = prodDiv.innerText.match(/\(x(\d+)\)/);
      const currentQty = match ? +match[1] : 1;
      const form = document.createElement('form');
      form.className = 'inline-edit-form';
      form.innerHTML = `
        <div class="inline-edit-fields">
          <label>Talla:
            ${vars.length
              ? `<select name="variation_id">${vars
                  .map(v => `<option value="${v.id}">${v.attributes.map(a => a.option).join(' / ')}</option>`)
                  .join('')}</select>`
              : `<span style="padding:6px 8px; background:#eee; border-radius:4px;">N/A</span>`
            }
          </label>
          <label>Cantidad:
            <input name="quantity" type="number" min="1" value="${currentQty}">
          </label>
          <label>Precio total (opcional):
            <input name="custom_total" type="number" step="0.01" placeholder="Ej: 29.99">
          </label>
          <button type="submit">Aceptar</button>
          <button type="button" class="cancel-edit">Cancelar</button>
        </div>
      `;
      prodDiv.style.display = 'none';
      panel.insertBefore(form, btn);
      form.querySelector('.cancel-edit').onclick = () => {
        form.remove();
        prodDiv.style.display = '';
        ajustarAlto();
      };
      form.onsubmit = async ev => {
        ev.preventDefault();
        const fd = new FormData(form);
        const body = { quantity: +fd.get('quantity') };
        if (vars.length) body.variation_id = +fd.get('variation_id');
        const custom = fd.get('custom_total');
        if (custom) body.total = parseFloat(custom).toFixed(2);
        try {
          await fetch(
            `${API_BASE}/editar-item?order_id=${orderId}&line_index=${lineIndex}`, {
              method: 'PUT',
              headers: getHeaders(),
              body: JSON.stringify({ ...body, ...getWooConfig() })
            }
          );
          showMessage(panel, 'Artículo actualizado.');
          form.remove();
          prodDiv.style.display = '';
          await loadPedidos();
        } catch {
          showMessage(panel, 'Error al actualizar.', 'error');
        }
      };
    }

    // Delete item
    if (e.target.matches('.btn-delete-item')) {
      const btn = e.target;
      const panel = btn.closest('.panel');
      if (!panel.querySelector('.confirm-delete')) {
        const div = document.createElement('div');
        div.className = 'delete-confirm';
        div.innerHTML = `
          <button class="confirm-delete">Confirmar eliminación</button>
          <button class="cancel-delete">Cancelar</button>
        `;
        panel.insertBefore(div, btn.nextSibling);
        div.querySelector('.cancel-delete').onclick = () => {
          div.remove();
          ajustarAlto();
        };
        div.querySelector('.confirm-delete').onclick = async () => {
          try {
            await fetch(
              `${API_BASE}/eliminar-item?order_id=${btn.dataset.orderId}&line_index=${btn.dataset.index}`, {
                method: 'DELETE',
                headers: getHeaders(),
                body: JSON.stringify(getWooConfig())
              }
            );
            showMessage(panel, 'Artículo eliminado.');
            await loadPedidos();
          } catch {
            showMessage(panel, 'Error al eliminar.', 'error');
          }
        };
        ajustarAlto();
      }
    }

    // Add item
    if (e.target.matches('.btn-add-item')) {
      const btn = e.target;
      const panel = btn.closest('.panel');
      if (panel.querySelector('.add-form')) return;
      await loadProducts();
      const form = document.createElement('form');
      form.className = 'add-form';
      form.innerHTML = `
        <div class="inline-edit-fields">
          <label>Producto:
            <select name="product_id" required>
              <option value="">– Selecciona –</option>
              ${productsList.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </label>
          <label>Variación:
            <select name="variation_id" disabled><option>– N/A –</option></select>
          </label>
          <label>Cantidad:
            <input name="quantity" type="number" min="1" value="1" required>
          </label>
          <label>Precio total (opcional):
            <input name="custom_total" type="number" step="0.01" placeholder="Ej: 59.90">
          </label>
          <button type="submit">Añadir</button>
          <button type="button" class="cancel-add">Cancelar</button>
        </div>
      `;
      panel.insertBefore(form, btn.nextSibling);
      form.querySelector('.cancel-add').onclick = () => {
        form.remove();
        ajustarAlto();
      };
      const prodSel = form.querySelector('select[name="product_id"]');
      const varSel = form.querySelector('select[name="variation_id"]');
      prodSel.onchange = async () => {
        if (!prodSel.value) {
          varSel.innerHTML = `<option>– N/A –</option>`;
          varSel.disabled = true;
          ajustarAlto();
          return;
        }
        try {
          const res = await fetch(
            `${API_BASE}/get-variaciones?product_id=${prodSel.value}`, {
              method: 'GET',
              headers: getHeaders(),
              body: JSON.stringify(getWooConfig())
            }
          );
          const vars = await res.json();
          if (vars.length) {
            varSel.disabled = false;
            varSel.innerHTML = vars
              .map(v => `<option value="${v.id}">${v.attributes.map(a => a.option).join(' / ')}</option>`)
              .join('');
          } else {
            varSel.disabled = true;
            varSel.innerHTML = `<option>– N/A –</option>`;
          }
          ajustarAlto();
        } catch {
          console.error('Error cargando variaciones');
        }
      };
      form.onsubmit = async ev => {
        ev.preventDefault();
        const fd = new FormData(form);
        const payload = {
          product_id: +fd.get('product_id'),
          quantity: +fd.get('quantity')
        };
        if (!varSel.disabled) payload.variation_id = +fd.get('variation_id');
        const custom = fd.get('custom_total');
        if (custom) payload.total = parseFloat(custom).toFixed(2);
        try {
          await fetch(
            `${API_BASE}/anadir-item?order_id=${btn.dataset.orderId}`, {
              method: 'POST',
              headers: getHeaders(),
              body: JSON.stringify({ ...payload, ...getWooConfig() })
            }
          );
          showMessage(panel, 'Artículo añadido.');
          form.remove();
          await loadPedidos();
        } catch {
          showMessage(panel, 'Error al añadir artículo.', 'error');
        }
      };
    }

    // Toggle address form
    if (e.target.matches('.btn-edit-address')) {
      const orderId = e.target.dataset.orderId;
      const form = document.querySelector(`.form-address[data-order-id="${orderId}"]`);
      form.style.display = form.style.display === 'block' ? 'none' : 'block';
      ajustarAlto();
    }

    // Change status controls
    if (e.target.matches('.btn-change-status')) {
      const orderId = e.target.dataset.orderId;
      const panel = e.target.closest('.panel');
      if (panel.querySelector('.select-status')) return;
      const sel = document.createElement('select');
      sel.className = 'select-status';
      sel.dataset.orderId = orderId;
      const current = e.target.dataset.status;
      orderStatuses.forEach(s => {
        sel.innerHTML += `<option value="${s.slug}" ${s.slug === current ? 'selected' : ''}>${s.name}</option>`;
      });
      const btnAccept = document.createElement('button');
      btnAccept.className = 'btn-status-accept';
      btnAccept.innerText = 'Aceptar';
      const btnCancel = document.createElement('button');
      btnCancel.className = 'btn-status-cancel';
      btnCancel.innerText = 'Cancelar';
      panel.appendChild(sel);
      panel.appendChild(btnAccept);
      panel.appendChild(btnCancel);
      ajustarAlto();
    }

    if (e.target.matches('.btn-status-cancel')) {
      const panel = e.target.closest('.panel');
      panel.querySelector('.select-status')?.remove();
      panel.querySelector('.btn-status-accept')?.remove();
      panel.querySelector('.btn-status-cancel')?.remove();
      ajustarAlto();
    }

    if (e.target.matches('.btn-status-accept')) {
      const panel = e.target.closest('.panel');
      const sel = panel.querySelector('.select-status');
      const orderId = sel.dataset.orderId;
      const newStatus = sel.value;
      try {
        await fetch(
          `${API_BASE}/cambiar-estado?order_id=${orderId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ status: newStatus, ...getWooConfig() })
          }
        );
        showMessage(panel, 'Estado actualizado.');
      } catch {
        showMessage(panel, 'Error cambiando estado.', 'error');
      }
      sel.remove();
      panel.querySelector('.btn-status-accept')?.remove();
      panel.querySelector('.btn-status-cancel')?.remove();
      await loadPedidos();
    }

    // Save address
    if (e.target.matches('.btn-save-address')) {
      const form = e.target.closest('.form-address');
      const panel = form.closest('.panel');
      const fd = new FormData(form);
      const payload = {
        billing: {
          first_name: fd.get('first_name'),
          last_name: fd.get('last_name'),
          phone: fd.get('phone'),
          address_1: fd.get('address_1'),
          address_2: fd.get('address_2'),
          state: fd.get('state'),
          city: fd.get('city'),
          postcode: fd.get('postcode'),
          country: fd.get('country')
        },
        shipping: {
          address_1: fd.get('shipping_address_1'),
          address_2: fd.get('shipping_address_2'),
          state: fd.get('shipping_state'),
          city: fd.get('shipping_city'),
          postcode: fd.get('shipping_postcode'),
          country: fd.get('shipping_country')
        }
      };
      try {
        await fetch(
          `${API_BASE}/editar-direccion?order_id=${form.dataset.orderId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ ...payload, ...getWooConfig() })
          }
        );
        showMessage(panel, 'Dirección actualizada.');
        await loadPedidos();
      } catch {
        showMessage(panel, 'Error guardando dirección.', 'error');
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
