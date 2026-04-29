/* Utilidades, TRM, calcVenta, navegación */


// ── UTILIDADES ──
const uid  = () => 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
const fmt  = v  => isNaN(v)||v===null||v===undefined ? '$ 0' :
                   '$ ' + Number(v).toLocaleString('es-CO',{minimumFractionDigits:0,maximumFractionDigits:0});
const fmtP = v  => isNaN(v) ? '0%' : v.toFixed(1) + '%';
const fmtU = v  => isNaN(v) ? '$ 0.00' : '$ ' + Number(v).toFixed(2);
const hoy  = () => new Date().toISOString().slice(0,10);
const mes  = () => new Date().toISOString().slice(0,7);

// ── BASE DE DATOS — Firebase Firestore (definido en el módulo de arriba) ──
// DB se inyecta como window.DB desde el módulo Firebase.
// Todas las llamadas a DB son ahora async/await.

// ── TRM AUTOMÁTICO ──
let TRM_ACTUAL  = 3800; // fallback
let TRM_BASE    = 3800; // dólar oficial sin margen
let TRM_CARGADO = false;

async function cargarTRM() {
  const elText  = document.getElementById('trm-text');

  const MARGEN = 150;

  const fuentes = [
    async () => {
      const r = await fetch('https://api.frankfurter.app/latest?from=USD&to=COP');
      const d = await r.json();
      return Math.round(d.rates.COP);
    },
    async () => {
      const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const d = await r.json();
      return Math.round(d.rates.COP);
    },
    async () => {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      const d = await r.json();
      return Math.round(d.rates.COP);
    },
  ];

  for(const fn of fuentes) {
    try {
      const base = await fn();
      if(base > 3000 && base < 8000) {
        TRM_BASE   = base;
        TRM_ACTUAL = base + MARGEN;
        TRM_CARGADO = true;
        if(elText) elText.textContent = `TRM ref: ${fmt(TRM_ACTUAL)}`;
        // NO llenamos el campo v-trm automáticamente; el usuario lo ingresa
        return;
      }
    } catch(e) {}
  }

  if(elText) elText.textContent = `TRM (sin conexión)`;
}

function actualizarDesglloseTRM() {
  // Mantener por compatibilidad, ya no muestra desglose auto
}

// ── CÁLCULO DE GANANCIA ──
/**
 * Toda la lógica de ganancia en un solo lugar.
 * Recibe el objeto venta con los campos guardados.
 *
 * FÓRMULA:
 *   precioVenta_COP = usd_vendido × trm
 *   costoProducto_COP = costo_usd × trm
 *   envioInt_COP = envio_int_usd × trm
 *   totalVenta = precioVenta_COP × udes
 *   totalCostos = costoProducto_COP × udes + envioInt_COP + envioExtra
 *   ganancia = totalVenta - totalCostos
 */
function calcVenta(v) {
  const udes       = parseFloat(v.udes)         || 1;
  const trm        = parseFloat(v.trm) || getDolarComprasConfigurado();
  const costoUsd   = parseFloat(v.costo_usd)    || 0;
  const envioVal   = parseFloat(v.envio_int_usd)|| 0;
  const envioExtra = parseFloat(v.envio_extra)  || 0;

  // precio_cop es el campo principal. Para ventas antiguas: precio_usd × trm
  let precioCOP;
  if(v.precio_cop && parseFloat(v.precio_cop) > 0) {
    precioCOP = parseFloat(v.precio_cop);
  } else {
    precioCOP = (parseFloat(v.precio_usd) || 0) * trm;
  }

  // Costo producto: siempre USD × TRM (Amazon)
  const costoCOP = costoUsd * trm;

  // Envío: si está validado usar el real; si no, el estimado en COP (siempre COP desde el registro nuevo)
  let envioIntCOP;
  if(v.envio_validado && v.envio_real_cop > 0) {
    envioIntCOP = v.envio_real_cop;
  } else if(v.envio_estimado_cop > 0) {
    envioIntCOP = v.envio_estimado_cop;
  } else if(v.envio_tipo === 'servientrega' && !v.envio_int_es_cop) {
    // ventas antiguas donde Servientrega guardaba en USD
    envioIntCOP = envioVal * trm;
  } else {
    envioIntCOP = envioVal;
  }

  const totalVenta  = precioCOP;
  const totalCostos = costoCOP + envioIntCOP + envioExtra;
  const ganancia    = totalVenta - totalCostos;
  const margen      = totalVenta > 0 ? (ganancia / totalVenta) * 100 : 0;
  const usd         = trm > 0 ? precioCOP / trm : 0;

  return { udes, usd, trm, precioCOP, costoCOP, envioIntCOP, envioExtra,
           totalVenta, totalCostos, ganancia, margen };
}

// ── NAVEGACIÓN ──
const PAGES = {
  ventas:         { title:'Gestor de Ventas', icon:'' },
  envios:         { title:'Envíos', icon:'' },
  problemas:      { title:'Problemas', icon:'' },
  finanzas:       { title:'Finanzas', icon:'' },
  configuracion:  { title:'Configuración', icon:'' },
  ayudas:         { title:'Ayudas', icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>' },
};

// ── HELPERS DE FUENTE DE PAGO ──
// Billeteras: solo se cargan desde la BD. Sin valores hardcodeados.
const FUENTES_LABEL = {};
const FUENTES_ICON  = {};

async function getSaldoFuente(fuente) {
  const saldos = await DB.saldos();
  return parseFloat(saldos[fuente]) || 0;
}

async function recalcFuente() {
  const fuente = gv('v-fuente-pago');
  const monto  = parseFloat(gv('v-monto-pago')) || 0;
  const el     = document.getElementById('v-fuente-saldo-info');
  if(!el) return;
  if(!fuente) { el.innerHTML=''; return; }
  const saldo  = await getSaldoFuente(fuente);
  const icon   = FUENTES_ICON[fuente]||'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>';
  const label  = FUENTES_LABEL[fuente]||fuente;
  const resto  = saldo - monto;
  el.innerHTML = `${icon} Saldo ${label}: <b>${fmt(saldo)}</b>`
    + (monto > 0 ? ` → Quedarían: <b style="color:${resto<0?'var(--red)':'var(--green)'};">${fmt(resto)}</b>` : '');
}

function recalcValidacionEnvio() {
  const estimado = parseFloat(gv('v-envio-estimado')) || 0;
  const real     = parseFloat(gv('v-envio-real'))     || 0;
  const estEl    = document.getElementById('envio-validacion-estado');
  const diffEl   = document.getElementById('envio-validacion-diff');
  if(!real) {
    if(estEl) estEl.innerHTML = '<span style="font-size:11px;color:var(--yellow);font-weight:600;"> Pendiente de confirmar</span>';
    if(diffEl) diffEl.innerHTML = '';
    return;
  }
  const diff = real - estimado;
  const ok   = Math.abs(diff) < 500;
  if(estEl) estEl.innerHTML = ok
    ? '<span style="font-size:11px;color:var(--green);font-weight:600;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Validado</span>'
    : `<span style="font-size:11px;color:${diff>0?'var(--red)':'var(--teal)'};font-weight:600;">${diff>0?'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg> Mayor al estimado':'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg> Menor al estimado'}</span>`;
  if(diffEl) diffEl.innerHTML = ok
    ? 'El valor real coincide con el estimado.'
    : `Diferencia: <b style="color:${diff>0?'var(--red)':'var(--teal)'};">${diff>0?'+':''}${fmt(diff)}</b> — el costo real se usará para el cálculo de ganancia.`;
}

// ── ENVÍOS POR MES (función independiente) ──
async function renderEnviosMes() {
  const mesSelEl = document.getElementById('fin-envios-mes');
  const mesAct   = mesSelEl?.value || mes();
  const ventas   = await DB.ventas();
  const tiendas  = await DB.tiendas();
  const _tNombre = (id) => tiendas.find(x=>x.id===id)?.nombre || id;

  const ventasMes = ventas.filter(v=>v.fecha_venta?.startsWith(mesAct));
  const vAg = ventasMes.filter(v=>v.envio_tipo==='aguachica'    && v.envio_int_usd>0);
  const vSv = ventasMes.filter(v=>v.envio_tipo==='servientrega' && v.envio_int_usd>0);

  const _envVal = v => v.envio_validado ? (v.envio_real_cop||0) : (v.envio_estimado_cop||v.envio_int_usd||0);

  const totalAg     = vAg.reduce((s,v)=>s+_envVal(v), 0);
  const totalSv     = vSv.reduce((s,v)=>s+_envVal(v), 0);
  const enviosTotal = totalAg + totalSv;
  const enviosCount = vAg.length + vSv.length;

  const mesNombres = {'01':'Enero','02':'Febrero','03':'Marzo','04':'Abril','05':'Mayo','06':'Junio',
    '07':'Julio','08':'Agosto','09':'Septiembre','10':'Octubre','11':'Noviembre','12':'Diciembre'};
  const [y,mo] = mesAct.split('-');
  const mesLabel = `${mesNombres[mo]||mo} ${y}`;

  const el = (id) => document.getElementById(id);
  if(el('fin-envios-total'))  el('fin-envios-total').textContent = fmt(enviosTotal);
  if(el('fin-env-ag-total'))  el('fin-env-ag-total').textContent = fmt(totalAg);
  if(el('fin-env-sv-total'))  el('fin-env-sv-total').textContent = fmt(totalSv);
  if(el('fin-envios-sub'))    el('fin-envios-sub').textContent   = `${enviosCount} envío(s) · ${mesLabel}`;

  const _filaEnvio = v => {
    const val = _envVal(v);
    const est = v.envio_estimado_cop || v.envio_int_usd || 0;
    const badge = v.envio_validado
      ? `<span style="color:var(--green);font-weight:700;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ${fmt(val)}</span>`
      : `<span style="color:var(--yellow);font-weight:700;"> ~${fmt(est)}</span>`;
    return `<div style="display:flex;justify-content:space-between;align-items:center;
              padding:5px 0;border-bottom:1px dashed #e0eaea;">
      <div style="min-width:0;flex:1;padding-right:8px;">
        <div style="font-weight:600;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${v.producto?.slice(0,34)||'—'}</div>
        <div style="color:var(--text3);font-size:10px;">${_tNombre(v.tienda_id)} · ${v.fecha_venta||''}</div>
      </div>
      <div style="flex-shrink:0;">${badge}</div>
    </div>`;
  };

  if(el('fin-env-ag-detalle')) el('fin-env-ag-detalle').innerHTML = vAg.length
    ? vAg.map(_filaEnvio).join('')
    : '<div style="color:var(--text3);padding:6px 0;font-size:11px;">Sin envíos Aguachica este mes</div>';

  if(el('fin-env-sv-detalle')) el('fin-env-sv-detalle').innerHTML = vSv.length
    ? vSv.map(_filaEnvio).join('')
    : '<div style="color:var(--text3);padding:6px 0;font-size:11px;">Sin envíos Servientrega este mes</div>';

  const validados  = ventasMes.filter(v=>v.envio_validado && v.envio_int_usd>0).length;
  const pendientes = ventasMes.filter(v=>!v.envio_validado && v.envio_int_usd>0).length;
  if(el('fin-envios-detalle')) el('fin-envios-detalle').innerHTML = enviosCount
    ? `<span style="color:var(--green);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ${validados} validado(s)</span>
       <span style="margin-left:14px;color:var(--yellow);"> ${pendientes} pendiente(s)</span>`
    : `<span style="color:var(--text3);">Sin envíos en ${mesLabel}</span>`;
}



// ── NAVEGACIÓN ──
async function navigate(page) {
  // Limpiar timer de sesión si se navega fuera de configuración
  if(page !== 'configuracion' && window._sessionTimerInterval) {
    clearInterval(window._sessionTimerInterval);
    window._sessionTimerInterval = null;
  }
  document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+page)?.classList.add('active');
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  const p = PAGES[page]||{};
  if(document.getElementById('tb-title')) document.getElementById('tb-title').textContent = p.title||page;
  if(document.getElementById('tb-icon'))  document.getElementById('tb-icon').textContent  = p.icon||'';
  // Guardar página actual en el hash para sobrevivir recargas
  if(location.hash !== '#' + page) history.replaceState(null, '', '#' + page);
  await render(page);
}

async function render(page) {
  switch(page) {
    case 'ventas':        await renderVentasGanancias(); break;
    case 'envios':        await renderEnvios();          break;
    case 'problemas':     await renderProblemas();       break;
    case 'finanzas':      await renderFinanzas();        break;
    case 'configuracion': await renderConfiguracion();   break;
    case 'ayudas':        await renderAyudas();          break;
  }
}

// ── Custom Estado Dropdown (shared) ──
const _ESTADO_COLORS = {
  pendiente: { bg:'#ffc000', color:'#000', border:'#e0a800', label:'PENDIENTE' },
  en_camino: { bg:'#70ad47', color:'#fff', border:'#5a9438', label:'EN CAMINO' },
  entregado: { bg:'#002060', color:'#fff', border:'#001540', label:'ENTREGADO' },
  cancelado: { bg:'#ff0000', color:'#000', border:'#cc0000', label:'CANCELADO' },
  problema:  { bg:'#f9a825', color:'#000', border:'#e08c00', label:'PROBLEMA'  },
  devuelto:  { bg:'#ff00ff', color:'#fff', border:'#cc00cc', label:'DEVUELTO'  },
  error:     { bg:'#a61c00', color:'#fff', border:'#7a1400', label:'ERROR'      },
  // Skydropx keys (capitalized)
  Pendiente: { bg:'#ffc000', color:'#000', border:'#e0a800', label:'PENDIENTE' },
  'En camino':{ bg:'#70ad47', color:'#fff', border:'#5a9438', label:'EN CAMINO' },
  Entregado: { bg:'#002060', color:'#fff', border:'#001540', label:'ENTREGADO' },
  Novedad:   { bg:'#ff0000', color:'#fff', border:'#cc0000', label:'NOVEDAD'   },
};

const _CHEVRON = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

// Registry to avoid inline onclick issues with special chars in IDs
const _dropRegistry = {};

function _buildEstadoDrop(estadoActual, opciones, onChangeFn, id) {
  const safeKey = 'k' + Math.random().toString(36).slice(2,8);
  _dropRegistry[safeKey] = { id, fn: onChangeFn };

  const p = _ESTADO_COLORS[estadoActual] || { bg:'#e5e7eb', color:'#374151', border:'#d1d5db', label:(estadoActual||'—').toUpperCase() };

  const opts = opciones.map(op => {
    const op_p = _ESTADO_COLORS[op] || { bg:'#e5e7eb', color:'#374151', label:op.toUpperCase() };
    return `<button class="estado-drop-opt"
      data-key="${safeKey}" data-val="${op}"
      style="background:${op_p.bg};color:${op_p.color};">
      ${op_p.label}
    </button>`;
  }).join('');

  return `<div class="estado-drop">
    <div class="estado-drop-btn" data-key="${safeKey}"
      style="background:${p.bg};color:${p.color};border-color:${p.border};">
      ${p.label} ${_CHEVRON}
    </div>
    <div class="estado-drop-menu">${opts}</div>
  </div>`;
}

// Single delegated listener on document for all dropdown interactions
document.addEventListener('click', function(e) {
  const btn  = e.target.closest('.estado-drop-btn');
  const opt  = e.target.closest('.estado-drop-opt');
  const drop = e.target.closest('.estado-drop');

  if (opt) {
    e.stopPropagation();
    const key = opt.dataset.key;
    const val = opt.dataset.val;
    const reg = _dropRegistry[key];
    if (!reg) return;

    const p = _ESTADO_COLORS[val] || { bg:'#e5e7eb', color:'#374151', border:'#d1d5db', label:val.toUpperCase() };
    const parentDrop = opt.closest('.estado-drop');
    const dropBtn = parentDrop.querySelector('.estado-drop-btn');
    dropBtn.style.background  = p.bg;
    dropBtn.style.color       = p.color;
    dropBtn.style.borderColor = p.border;
    dropBtn.innerHTML = p.label + ' ' + _CHEVRON;
    parentDrop.querySelector('.estado-drop-menu').classList.remove('open');

    window[reg.fn](reg.id, val);
    return;
  }

  if (btn) {
    e.stopPropagation();
    const menu = btn.nextElementSibling;
    const isOpen = menu.classList.contains('open');
    // Close all
    document.querySelectorAll('.estado-drop-menu.open').forEach(m => m.classList.remove('open'));
    if (!isOpen) {
      // Position with fixed coords before showing
      const btnRect = btn.getBoundingClientRect();
      menu.style.left = btnRect.left + 'px';
      menu.style.top  = (btnRect.bottom + 4) + 'px';
      menu.classList.add('open');
      // Flip up if not enough space below
      const menuH = menu.offsetHeight || 160;
      if (btnRect.bottom + menuH + 4 > window.innerHeight) {
        menu.style.top = (btnRect.top - menuH - 4) + 'px';
      }
    }
    return;
  }

  if (!drop) {
    document.querySelectorAll('.estado-drop-menu.open').forEach(m => m.classList.remove('open'));
  }
});