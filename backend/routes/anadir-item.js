// 5) Editar talla, cantidad y precio (IVA incluido)
if (e.target.matches('.btn-edit-item')) {
  const btn         = e.target;
  const orderId     = btn.dataset.orderId;
  const lineIndex   = btn.dataset.index;
  const productId   = btn.dataset.productId;
  const oldVarId    = btn.dataset.variationId;
  const oldQuantity = btn.dataset.quantity;
  const oldTotal    = parseFloat(btn.dataset.total) || 0; // total con IVA

  // Intentamos leer el form justo después del botón
  let form = btn.nextElementSibling;
  if (!form || !form.classList.contains('edit-item-form')) {
    form = document.createElement('div');
    form.className = 'edit-item-form mt-2 mb-3';

    // 1) Select de variaciones
    const selVar = document.createElement('select');
    selVar.className = 'form-control mb-2';
    selVar.innerHTML = '<option value="">— Selecciona variación —</option>';
    form.appendChild(selVar);

    // 2) Input de cantidad
    const qtyInput = document.createElement('input');
    qtyInput.type        = 'number';
    qtyInput.min         = '1';
    qtyInput.value       = oldQuantity;
    qtyInput.placeholder = 'Cantidad';
    qtyInput.className   = 'form-control mb-2';
    form.appendChild(qtyInput);

    // 3) Input precio unitario (IVA incl.)
    const priceInclInput = document.createElement('input');
    priceInclInput.type        = 'number';
    priceInclInput.step        = '0.01';
    priceInclInput.min         = '0.01';
    priceInclInput.value       = (oldTotal / oldQuantity).toFixed(2);
    priceInclInput.placeholder = 'Precio unit. (IVA incl.)';
    priceInclInput.className   = 'form-control mb-2';
    form.appendChild(priceInclInput);

    // 4) Input % IVA
    const vatInput = document.createElement('input');
    vatInput.type        = 'number';
    vatInput.step        = '0.01';
    vatInput.min         = '0';
    vatInput.value       = '21';
    vatInput.placeholder = '% IVA';
    vatInput.className   = 'form-control mb-3';
    form.appendChild(vatInput);

    // 5) Botones Aceptar / Cancelar
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

    // 6) Habilitar “Aceptar” solo si todos los campos tienen valor
    function toggleOk() {
      btnOk.disabled = !(
        selVar.value &&
        qtyInput.value &&
        priceInclInput.value &&
        vatInput.value
      );
    }
    [selVar, qtyInput, priceInclInput, vatInput].forEach(el =>
      el.addEventListener('input', toggleOk)
    );

    // 7) Cargar variaciones
    (async () => {
      const config = getWooConfig();
      const paramsVar = new URLSearchParams({
        product_id:      productId,
        woocommerce_url: config.woocommerce_url,
        consumer_key:    config.consumer_key,
        consumer_secret: config.consumer_secret
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
      toggleOk();
    })();

    // 8) Al pulsar “Aceptar”
    btnOk.addEventListener('click', async () => {
      const newVarId   = selVar.value;
      const newQty     = qtyInput.value;
      const unitIncl   = parseFloat(priceInclInput.value.replace(',', '.'));
      const vatRatePct = parseFloat(vatInput.value.replace(',', '.'));
      const config     = getWooConfig();

      try {
        // 8.1) Cambiar a pending
        console.log('⏳ [Edit] Cambiando a pending…', { orderId });
        await fetch(
          `${API_BASE}/cambiar-estado?` +
          new URLSearchParams({
            order_id:        orderId,
            status:          'pending',
            woocommerce_url: config.woocommerce_url,
            consumer_key:    config.consumer_key,
            consumer_secret: config.consumer_secret
          }),
          { method: 'PUT', headers: getHeaders() }
        );
        console.log('✅ [Edit] Estado a pending OK');

        // 8.2) Eliminar la línea original
        console.log('⏳ [Edit] Eliminando línea original…', { lineIndex });
        await fetch(
          `${API_BASE}/eliminar-item?` +
          new URLSearchParams({
            order_id:        orderId,
            line_index:      lineIndex,
            woocommerce_url: config.woocommerce_url,
            consumer_key:    config.consumer_key,
            consumer_secret: config.consumer_secret
          }),
          { method: 'DELETE', headers: getHeaders() }
        );
        console.log('✅ [Edit] Línea eliminada');

        // 8.3) Calcular valores de precio e impuestos
        const rate      = vatRatePct / 100;
        const priceExcl = parseFloat((unitIncl / (1 + rate)).toFixed(2));
        const taxUnit   = parseFloat((unitIncl - priceExcl).toFixed(2));
        const qtyNum    = Number(newQty);
        const subtotal  = parseFloat((priceExcl * qtyNum).toFixed(2));
        const totalTax  = parseFloat((taxUnit * qtyNum).toFixed(2));
        const totalLine = parseFloat((subtotal + totalTax).toFixed(2));

        // 8.4) Añadir la nueva línea CON PRECIO + IVA
        const payload = {
          product_id:    Number(productId),
          variation_id:  Number(newVarId),
          quantity:      qtyNum,
          price:         priceExcl.toFixed(2),
          subtotal:      subtotal.toFixed(2),
          total:         totalLine.toFixed(2),
          subtotal_tax:  totalTax.toFixed(2),
          total_tax:     totalTax.toFixed(2),
          woocommerce_url: config.woocommerce_url,
          consumer_key:  config.consumer_key,
          consumer_secret: config.consumer_secret
        };
        console.log('⏳ [Edit] Añadiendo nueva línea…', payload);

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
          console.error('⛔ [Edit] /anadir-item error (texto):', text);
          let errJson = {};
          try { errJson = JSON.parse(text); } catch(e) {}
          console.error('⛔ [Edit] /anadir-item error (JSON):', errJson);
          const msg = errJson.error || text || 'Error desconocido';
          return showMessage(form.parentNode, `Error al añadir: ${msg}`, 'error');
        }

        console.log('✅ [Edit] Nueva línea añadida correctamente');
        showMessage(form.parentNode, 'Artículo actualizado');
        await loadPedidos();

      } catch (error) {
        console.error('❌ [Edit] Error inesperado en el flujo de edición:', error);
        showMessage(form.parentNode, 'Error inesperado al actualizar', 'error');
      }
    });

    // 9) Insertar el form justo después del botón
    btn.insertAdjacentElement('afterend', form);
  }

  // 10) Alternar visibilidad del form
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  return;
}
