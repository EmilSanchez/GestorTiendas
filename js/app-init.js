/* Autenticación, toast, spinner, confirmación, init principal */

// ══════════════════════════════════════════════════════════
// SESIÓN
// ══════════════════════════════════════════════════════════
// ── Sesión basada en localStorage ──
const _SK = 'mm_session';

function _getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(_SK)||'null');
    if (!s || (Date.now()-s.ts) >= 8*60*60*1000) return null;
    return s;
  } catch { return null; }
}

function _getSessionStart() {
  const s = _getSession();
  return s ? s.ts : null;
}

function _guardSession() {
  if (!_getSession()) window.location.href = 'index.html';
}

function _lockApp() {
  localStorage.removeItem(_SK);
  const overlay = document.createElement('div');
  overlay.id = '_lock_anim';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;display:flex;flex-direction:column;'
    + 'align-items:center;justify-content:center;gap:18px;'
    + 'background:linear-gradient(135deg,#1a2332 0%,#243049 60%,#1e3a5f 100%);'
    + 'animation:lockFadeIn .3s ease;';
  overlay.innerHTML = `
    <div style="font-size:64px;animation:lockBounce 1.5s ease forwards;"></div>
    <div style="font-size:16px;font-weight:700;color:#fff;letter-spacing:.5px;">Bloqueando...</div>
    <div style="font-size:12px;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:1px;">Meli Manager</div>
  `;
  if (!document.getElementById('_lock_styles')) {
    const s = document.createElement('style');
    s.id = '_lock_styles';
    s.textContent = `
      @keyframes lockFadeIn { from{opacity:0;} to{opacity:1;} }
      @keyframes lockBounce {
        0%   { transform:scale(0.3) rotate(-20deg); opacity:0; }
        40%  { transform:scale(1.25) rotate(8deg);  opacity:1; }
        65%  { transform:scale(0.92) rotate(-4deg); }
        80%  { transform:scale(1.07) rotate(2deg);  }
        100% { transform:scale(1)    rotate(0deg);  }
      }
    `;
    document.head.appendChild(s);
  }
  document.body.appendChild(overlay);
  setTimeout(() => { window.location.href = 'index.html'; }, 1500);
}

// ══════════════════════════════════════════════════════════
// SPINNER
// ══════════════════════════════════════════════════════════
function showSpinner(msg = 'Cargando...') {
  let el = document.getElementById('_fb_spinner');
  if (!el) {
    el = document.createElement('div');
    el.id = '_fb_spinner';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,.85);'
      + 'z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;';
    document.body.appendChild(el);
  }
  el.innerHTML = `<div style="font-size:38px;animation:pulse 1.5s infinite;"></div>
    <div style="font-size:14px;font-weight:700;color:#00897b;">${msg}</div>
    <div style="font-size:11px;color:#8aabaa;">Meli Manager</div>`;
}
function hideSpinner() {
  const el = document.getElementById('_fb_spinner');
  if (el) el.remove();
}

// ══════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════
function showToast(msg, type = 'info', duration = 3000) {
  const el = document.getElementById('_toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.className = type; }, duration);
}

// ══════════════════════════════════════════════════════════
// REFRESH MÓDULO
// ══════════════════════════════════════════════════════════
// ── ANIMACIÓN SLIDE-UP por ítem al actualizar ──
const _REFRESH_STYLE_ID = '_refresh-anim-style';

function _injectRefreshStyle() {
  if (document.getElementById(_REFRESH_STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = _REFRESH_STYLE_ID;
  s.textContent = `
    @keyframes _slideUp {
      from { opacity:0; transform:translateY(18px); }
      to   { opacity:1; transform:translateY(0); }
    }
    ._refresh-item {
      animation: _slideUp .22s cubic-bezier(.25,.46,.45,.94) both;
    }
  `;
  document.head.appendChild(s);
}

// Aplica animación escalonada a los hijos directos de un contenedor
function _animateContainer(containerId, childSelector) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const items = childSelector
    ? container.querySelectorAll(childSelector)
    : container.children;
  Array.from(items).forEach((el, i) => {
    el.classList.remove('_refresh-item');
    // Forzar reflow para reiniciar la animación
    void el.offsetWidth;
    el.style.animationDelay = `${i * 30}ms`;
    el.classList.add('_refresh-item');
  });
}

async function refreshModulo(page) {
  _injectRefreshStyle();

  const btn = document.getElementById(`btn-actualizar-${page}`);
  const originalHTML = btn ? btn.innerHTML : null;

  // ── Girar el ícono ↻ mientras carga ──
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span style="display:inline-block;animation:_spin .6s linear infinite;">↻</span> Actualizar`;
  }

  // ── Limpiar TODO el caché y recargar desde Firebase ──
  Object.keys(_cache).forEach(k => { _cache[k] = null; });
  await _cargarTodo();
  await render(page);

  // ── Animar los ítems del módulo recién renderizado ──
  switch (page) {
    case 'ventas':
      _animateContainer('ventas-tbody', 'tr');
      break;
    case 'envios':
      _animateContainer('envios-tbody', 'tr');
      break;
    case 'problemas':
      _animateContainer('problemas-container', '.prob-card');
      break;
    case 'ayudas':
      _animateContainer('ayudas-grid', '.ayuda-card');
      break;
    case 'configuracion':
      _animateContainer('cfg-tiendas-grid', ':scope > div');
      break;
    case 'finanzas':
      _animateContainer('fin-saldos', '.stat-card');
      _animateContainer('fin-movimientos', ':scope > *');
      break;
    default:
      // Animar cualquier hijo directo del page-section
      _animateContainer(`page-${page}`, ':scope > *');
  }

  // ── Restaurar botón ──
  if (btn) {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }

  showToast('Datos actualizados', 'success', 2000);
}

// ══════════════════════════════════════════════════════════
// ANIMACIÓN CONFIRMACIÓN
// ══════════════════════════════════════════════════════════
const _CA_MSGS = {
  venta:    { reg:'Venta registrada',         edit:'Venta editada'          },
  problema: { reg:'Problema registrado',      edit:'Problema editado'       },
  resuelto: { reg:'Problema resuelto',        edit:'Resolución actualizada' },
  validado: { reg:'Envío validado',           edit:'Envío actualizado'      },
  pago:     { reg:'Pago de envío registrado', edit:'Pago actualizado'       },
  ayuda:    { reg:'Ayuda guardada',           edit:'Ayuda actualizada'      },
};

function showConfirmAnim(tipo, esEdicion) {
  const msgs     = _CA_MSGS[tipo] || _CA_MSGS.venta;
  const msg      = esEdicion ? msgs.edit : msgs.reg;
  const overlay  = document.getElementById('_confirm-anim');
  const toast    = document.getElementById('_ca-toast');
  const toastMsg = document.getElementById('_ca-toast-msg');
  const toastIcon= document.getElementById('_ca-toast-icon');
  if (!overlay || !toast) return;
  toastIcon.textContent = esEdicion ? '' : '';
  toastMsg.textContent  = msg;
  overlay.classList.add('show');
  setTimeout(() => {
    overlay.classList.remove('show');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2400);
  }, 500);
}

// ══════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════
async function init() {
  showSpinner('Conectando con Firebase...');
  const statusEl = document.getElementById('db-status');
  try {
    await _cargarTodo();
    if (statusEl) statusEl.textContent = 'v6.0 · Firebase ';
  } catch(e) {
    console.warn('Firebase no disponible:', e.message);
    if (statusEl) statusEl.textContent = 'v6.0 · Sin conexión <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  }
  hideSpinner();

  const bws = await DB.billeteras();
  Object.keys(FUENTES_LABEL).forEach(k => delete FUENTES_LABEL[k]);
  Object.keys(FUENTES_ICON).forEach(k  => delete FUENTES_ICON[k]);
  bws.forEach(b => {
    FUENTES_LABEL[b.id] = b.nombre;
    FUENTES_ICON[b.id]  = b.icono || '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>';
  });

  await cargarTRM();
  const ajustesInit = await DB.ajustes();
  if (ajustesInit.dolar_compras_cop > 0) {
    localStorage.setItem('dolar_compras_cop', ajustesInit.dolar_compras_cop);
  }

  await populateSelects();

  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.page));
  });

  document.getElementById('btn-nueva-venta')?.addEventListener('click', () => openModalVenta());

  document.querySelectorAll('.overlay').forEach(o => {
    if (o.id === 'modal-venta') return;
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
  });

  document.getElementById('v-id')?.addEventListener('input', function() {
    const refEl = document.getElementById('v-ref-pago');
    if (refEl && !refEl.value) refEl.value = this.value ? '#' + this.value : '';
  });

  ['vf-search','vf-tienda','vf-estado','vf-mes','vf-desde','vf-hasta'].forEach(id => {
    document.getElementById(id)?.addEventListener('input',  () => renderVentasGanancias());
    document.getElementById(id)?.addEventListener('change', () => renderVentasGanancias());
  });
  ['ef-search','ef-empresa','ef-tienda','ef-pago','ef-mes'].forEach(id => {
    document.getElementById(id)?.addEventListener('input',  () => renderEnvios());
    document.getElementById(id)?.addEventListener('change', () => renderEnvios());
  });
  ['pf-search','pf-estado','pf-tienda','pf-tipo'].forEach(id => {
    document.getElementById(id)?.addEventListener('input',  () => renderProblemas());
    document.getElementById(id)?.addEventListener('change', () => renderProblemas());
  });
  document.getElementById('p-buscar')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') buscarVentaProblema();
  });

  // Restaurar la última página visitada desde el hash de la URL
  const VALID_PAGES = ['ventas','envios','problemas','finanzas','configuracion','ayudas'];
  const hashPage = location.hash.replace('#','');
  const startPage = VALID_PAGES.includes(hashPage) ? hashPage : 'ventas';
  await navigate(startPage);
  await updateAlertaBadge();
}

// ══════════════════════════════════════════════════════════
// ARRANQUE
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  const sesion = _getSession();
  if (!sesion) { window.location.href = 'index.html'; return; }

  // Setear usuario actual en firebase.js
  _currentUser = sesion;

  // Mostrar info en sidebar
  const nameEl  = document.getElementById('sb-user-name');
  const emailEl = document.getElementById('sb-user-email');
  if (nameEl)  nameEl.textContent = sesion.nombre || sesion.usuario || 'Admin';
  if (emailEl) emailEl.textContent = sesion.rol === 'admin' ? 'Administrador' : `@${sesion.usuario}`;

  await init();
});