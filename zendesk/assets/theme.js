// theme.js
(function() {
    // Inicializamos el cliente Zendesk
    const client = ZAFClient.init();
  
    // Helper: dispara resize al tamaño exacto de la app
    function doResize() {
      const height = document.documentElement.scrollHeight;
      client.invoke('resize', { width: '100%', height });
    }
  
    document.addEventListener('DOMContentLoaded', () => {
      // 1) Override showMessage (sin llamar al original)
      window.showMessage = (text, type) => {
        const msg = document.getElementById('status-message');
        if (!msg) return;
        msg.textContent = text;
        msg.className = type;
        msg.style.display = 'block';
        clearTimeout(window._msgTimeout);
        window._msgTimeout = setTimeout(() => msg.style.display = 'none', 2500);
      };
  
      // 2) Overlay de carga
      const overlay = document.createElement('div');
      overlay.className = 'loading-overlay';
      overlay.innerText = 'Cargando…';
      document.body.appendChild(overlay);
  
      // 3) Wrapper de fetch
      const origFetch = window.fetch;
      window.fetch = async function(...args) {
        overlay.style.display = 'flex';
        window.showMessage('Procesando…', 'info');
        try {
          const res = await origFetch.apply(this, args);
          overlay.style.display = 'none';
          window.showMessage(res.ok ? '¡Completado con éxito!' : 'Ha ocurrido un error.', res.ok ? 'success' : 'error');
          doResize();
          return res;
        } catch (e) {
          overlay.style.display = 'none';
          window.showMessage('Error de red.', 'error');
          doResize();
          throw e;
        }
      };
  
      // 4) Override de loadPedidos para preservar estado y redimensionar
      if (typeof window.loadPedidos === 'function') {
        const origLoad = window.loadPedidos;
        window.loadPedidos = async function(...args) {
          // Guardamos scroll y paneles abiertos
          const container = document.getElementById('resultados');
          const prevScroll = container.scrollTop;
          const openIds = Array.from(container.querySelectorAll('.panel.open'))
                               .map(p => p.getAttribute('data-order-id'));
  
          // Llamamos a la carga original
          await origLoad.apply(this, args);
  
          // Restauramos scroll y paneles
          container.scrollTop = prevScroll;
          openIds.forEach(id => {
            const panel = container.querySelector(`.panel[data-order-id="${id}"]`);
            if (panel) panel.classList.add('open');
          });
  
          // Redimensionamos iframe
          doResize();
        };
      }
  
      // 5) Al final, un primer resize
      doResize();
    });
  })();
  