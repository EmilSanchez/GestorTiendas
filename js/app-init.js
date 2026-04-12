/* Autenticación, toast, spinner, confirmación, init principal */

// ══════════════════════════════════════════════════════════
// SESIÓN
// ══════════════════════════════════════════════════════════
const _SESSION_KEY = 'mm_auth_ok';
const _SESSION_TTL = 8 * 60 * 60 * 1000;

function _checkSession() {
  try {
    const raw = localStorage.getItem(_SESSION_KEY);
    if (!raw) return false;
    const { ts } = JSON.parse(raw);
    return (Date.now() - ts) < _SESSION_TTL;
  } catch { return false; }
}

function _getSessionStart() {
  try {
    const raw = localStorage.getItem(_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw).ts || null;
  } catch { return null; }
}

function _guardSession() {
  if (!_checkSession()) window.location.href = 'index.html';
}

function _lockApp() {
  localStorage.removeItem(_SESSION_KEY);
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
  el.innerHTML = `<div style="font-size:38px;animation:pulse 1.5s infinite;">🔥</div>
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
async function refreshModulo(page) {
  const btn = document.getElementById(`btn-actualizar-${page}`);
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = '.6';
    const originalHTML = btn.innerHTML;
    const span = document.createElement('span');
    span.className = '_ri btn-refreshing';
    span.style.display = 'inline-block';
    span.textContent = '↻';
    btn.innerHTML = '';
    btn.appendChild(span);
    btn.appendChild(document.createTextNode(' Actualizando...'));
    await new Promise(r => setTimeout(r, 500));
    btn.innerHTML = originalHTML;
    btn.disabled = false;
    btn.style.opacity = '1';
  }
  _cache[page === 'ventas' ? 'ventas' : page === 'envios' ? 'ventas' : page === 'problemas' ? 'problemas' : page] = null;
  if (page === 'envios') _cache.ventas = null;
  await _cargarTodo();
  await render(page);
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
  toastIcon.textContent = esEdicion ? '✎' : '✓';
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
    if (statusEl) statusEl.textContent = 'v6.0 · Firebase ✓';
  } catch(e) {
    console.warn('Firebase no disponible:', e.message);
    if (statusEl) statusEl.textContent = 'v6.0 · Sin conexión ⚠️';
  }
  hideSpinner();

  const bws = await DB.billeteras();
  Object.keys(FUENTES_LABEL).forEach(k => delete FUENTES_LABEL[k]);
  Object.keys(FUENTES_ICON).forEach(k  => delete FUENTES_ICON[k]);
  bws.forEach(b => {
    FUENTES_LABEL[b.id] = b.nombre;
    FUENTES_ICON[b.id]  = b.icono || '💳';
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

  ['vf-search','vf-tienda','vf-estado','vf-mes','vf-dia'].forEach(id => {
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

  await navigate('ventas');
  await updateAlertaBadge();
}

// ══════════════════════════════════════════════════════════
// ARRANQUE
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  _guardSession();
  await init();
});
