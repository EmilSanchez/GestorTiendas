/* Módulo Productos demorados (submódulo de Pendientes)
 *
 * Seguimiento de productos que aún no llegan al cliente. Cada registro está
 * ligado a una venta y guarda:
 *   etapa              'amazon' (Amazon aún no lo envía) | 'usa' (ya salió de EE.UU.) | 'colombia'
 *   guia_internacional número de guía cuando ya salió de EE.UU.
 *   cliente_informado  si el comprador ya conoce la demora
 *   nota               texto libre
 *   estado             'activo' (en seguimiento) | 'entregado'
 * Se guarda en la colección "demorados".
 */

const _DEM_ETAPAS = {
  amazon:   { label: 'Amazon aún no lo envía', corto: 'Amazon',   color: '#b45309', bg: '#fef3c7' },
  usa:      { label: 'Ya salió de EE.UU.',     corto: 'EE.UU.',   color: '#1d4ed8', bg: '#dbeafe' },
  colombia: { label: 'Ya está en Colombia',    corto: 'Colombia', color: '#047857', bg: '#d1fae5' },
};
const _DEM_ORDEN = ['amazon', 'usa', 'colombia'];

let _demEditId = null, _demVentaSel = null, _demEtapaSel = 'amazon', _demBorrarId = null;

// Días desde que se registró la demora
function _demDias(d) {
  const t = new Date(d.fecha_registro || d.fecha || Date.now());
  return Math.max(0, Math.floor((Date.now() - t.getTime()) / 86400000));
}

async function updateDemoradosCount() {
  const n = (await DB.demorados()).filter(d => d.estado !== 'entregado').length;
  const b = document.getElementById('nav-dem-count');
  if (b) { b.textContent = n; b.style.display = n ? '' : 'none'; }
}

// ══════════════════════════════════════════════════════════
// MODAL REGISTRAR / EDITAR
// ══════════════════════════════════════════════════════════
// openModalDemorado(ventaId)       → desde el Gestor de ventas (si la venta ya tiene un
//                                    seguimiento activo, se abre ese para editarlo)
// openModalDemorado(null, demId)   → editar desde el módulo
// openModalDemorado()              → registrar buscando la venta
async function openModalDemorado(ventaId, demId) {
  const todos = await DB.demorados();
  let d = demId ? todos.find(x => x.id === demId) : null;
  if (!d && ventaId) d = todos.find(x => x.venta_id === ventaId && x.estado !== 'entregado') || null;
  _demEditId = d?.id || null;
  _demVentaSel = null;

  const vid = ventaId || d?.venta_id;
  const v = vid ? (await DB.ventas()).find(x => x.id === vid) : null;
  if (v) _demVentaSel = v;

  document.getElementById('md2-title').textContent = d ? 'Seguimiento del producto demorado' : 'Registrar producto demorado';
  document.getElementById('md2-sub').textContent = v
    ? `Venta ${v.id_ml || v.id}${v.producto ? ' · ' + v.producto : ''}`
    : (d?.id_ml_venta ? `Venta ${d.id_ml_venta}` : 'Seguimiento del envío hasta que llegue al cliente');
  // Si ya viene la venta, no hace falta buscarla
  document.getElementById('md2-buscar-wrap').style.display = (v || d) ? 'none' : '';
  sv('md2-buscar', ''); document.getElementById('md2-buscar-res').innerHTML = '';
  sv('md2-guia', d?.guia_internacional || '');
  sv('md2-nota', d?.nota || '');
  document.getElementById('md2-cliente').checked = !!d?.cliente_informado;
  document.getElementById('md2-err').textContent = '';
  const btn = document.getElementById('md2-btn');
  btn.disabled = false; btn.textContent = d ? 'Guardar cambios' : 'Registrar demorado';
  _demEtapa(d?.etapa || 'amazon');
  openModal('modal-demorado');
}

function _demEtapa(et) {
  _demEtapaSel = et;
  document.querySelectorAll('#md2-etapas button').forEach(b => b.classList.toggle('on', b.dataset.etapa === et));
  // La guía internacional aplica cuando el producto ya salió de EE.UU.
  document.getElementById('md2-guia-wrap').style.display = et === 'amazon' ? 'none' : '';
}

async function _demBuscarVenta() {
  const q = gv('md2-buscar').toLowerCase().trim();
  const el = document.getElementById('md2-buscar-res');
  if (!q) return;
  const [ventas, tiendas] = await Promise.all([DB.ventas(), DB.tiendas()]);
  const res = ventas.filter(v =>
    (v.id_ml || '').toLowerCase().includes(q) || (v.id || '').toLowerCase().includes(q) ||
    (v.producto || '').toLowerCase().includes(q) || (v.cliente || '').toLowerCase().includes(q) ||
    (v.nombre_cliente || '').toLowerCase().includes(q)).slice(0, 5);
  if (!res.length) { el.innerHTML = '<div style="font-size:11px;color:var(--text3);">No se encontraron ventas.</div>'; return; }
  el.innerHTML = res.map(v => {
    const t = tiendas.find(x => x.id === v.tienda_id);
    return `<div class="dem-res" onclick="_demElegirVenta('${v.id}')"><strong>${_esc2(v.id_ml || v.id)}</strong>
      <span class="c-dim">· ${_esc2(v.producto || '')} · ${_esc2(t?.nombre || '?')} · ${v.fecha_venta || ''}</span></div>`;
  }).join('');
}

async function _demElegirVenta(id) {
  const v = (await DB.ventas()).find(x => x.id === id);
  if (!v) return;
  // Si esa venta ya tiene un seguimiento activo, se abre ese en vez de duplicarlo
  const existente = (await DB.demorados()).find(x => x.venta_id === id && x.estado !== 'entregado');
  if (existente) { showToast('Esa venta ya tiene un seguimiento activo', 'info', 2500); return openModalDemorado(null, existente.id); }
  _demVentaSel = v;
  document.getElementById('md2-buscar-res').innerHTML = `
    <div class="mp-sel-venta">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#16a34a" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="11" stroke="none"/><polyline points="17 8.5 10.5 15 7 11.5"/></svg>
      <strong>${_esc2(v.id_ml || v.id)}</strong><span class="c-dim">— ${_esc2(v.producto || '')}</span>
    </div>`;
  document.getElementById('md2-sub').textContent = `Venta ${v.id_ml || v.id}${v.producto ? ' · ' + v.producto : ''}`;
}

async function guardarDemorado() {
  const btn = document.getElementById('md2-btn');
  const err = document.getElementById('md2-err');
  if (btn.disabled) return;
  const antes = _demEditId ? (await DB.demorados()).find(x => x.id === _demEditId) : null;
  const v = _demVentaSel;
  if (!antes && !v) { err.textContent = 'Busca y selecciona la venta.'; document.getElementById('md2-buscar').focus(); return; }
  err.textContent = '';
  btn.disabled = true;
  const txt = btn.textContent; btn.textContent = 'Guardando…';
  const ahora = new Date().toISOString();
  const d = {
    ...(antes || {}),
    id:                 antes?.id || uid(),
    venta_id:           v?.id || antes?.venta_id || '',
    id_ml_venta:        v?.id_ml || antes?.id_ml_venta || '',
    tienda_id:          v?.tienda_id || antes?.tienda_id || '',
    producto:           v?.producto || antes?.producto || '',
    etapa:              _demEtapaSel,
    guia_internacional: _demEtapaSel === 'amazon' ? (antes?.guia_internacional || '') : gv('md2-guia').trim(),
    cliente_informado:  document.getElementById('md2-cliente').checked,
    nota:               gv('md2-nota').trim(),
    estado:             antes?.estado || 'activo',
    fecha_registro:     antes?.fecha_registro || ahora,
    fecha_actualizacion: ahora,
  };
  try {
    await DB.upsertDemorado(d);
  } catch (e) {
    console.error('Demorado:', e);
    err.textContent = 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.';
    btn.disabled = false; btn.textContent = txt;
    return;
  }
  Sonido.play(antes ? 'guardar' : 'registrar');
  showToast(antes ? 'Seguimiento actualizado' : 'Producto demorado registrado', 'success', 2200);
  closeModal('modal-demorado');
  btn.disabled = false; btn.textContent = txt;
  await _demRefrescar();
}

async function _demRefrescar() {
  await updateDemoradosCount();
  if (location.hash === '#demorados') await renderDemorados();
  if (typeof renderVentasGanancias === 'function' && location.hash === '#ventas') { try { await renderVentasGanancias(); } catch (e) {} }
}

async function marcarDemoradoEntregado(id, entregado = true) {
  const d = (await DB.demorados()).find(x => x.id === id);
  if (!d) return;
  await DB.upsertDemorado({ ...d, estado: entregado ? 'entregado' : 'activo',
    fecha_entrega: entregado ? new Date().toISOString() : null, fecha_actualizacion: new Date().toISOString() });
  Sonido.play(entregado ? 'resolver' : 'editar');
  showToast(entregado ? 'Marcado como entregado' : 'Seguimiento reabierto', 'success', 2000);
  await _demRefrescar();
}

function eliminarDemorado(id) {
  document.querySelectorAll('.pc-menu').forEach(m => m.remove());
  _demBorrarId = id;
  openModal('modal-del-demorado');
}
async function _demConfirmarEliminar() {
  if (!_demBorrarId) return;
  await DB.deleteDemorado(_demBorrarId);
  _demBorrarId = null;
  closeModal('modal-del-demorado');
  Sonido.play('eliminar');
  showToast('Seguimiento eliminado', 'success', 2000);
  await _demRefrescar();
}

function _demMenu(btn, id) {
  document.querySelectorAll('.pc-menu').forEach(m => m.remove());
  const d = ((typeof _cache !== 'undefined' && _cache.demorados) || []).find(x => x.id === id);
  const m = document.createElement('div');
  m.className = 'pc-menu';
  const ic = p => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  m.innerHTML = `
    ${d?.venta_id && typeof openModalVenta === 'function' ? `<button onclick="document.querySelectorAll('.pc-menu').forEach(x=>x.remove());openModalVenta('${d.venta_id}')">${ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>')} Editar venta</button>` : ''}
    ${d?.estado === 'entregado' ? `<button onclick="document.querySelectorAll('.pc-menu').forEach(x=>x.remove());marcarDemoradoEntregado('${id}', false)">${ic('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>')} Reabrir seguimiento</button>` : ''}
    <div class="pc-menu-sep"></div>
    <button class="danger" onclick="eliminarDemorado('${id}')">${ic('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>')} Eliminar</button>`;
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect();
  m.style.top  = (r.bottom + 4) + 'px';
  m.style.left = Math.max(8, r.right - m.offsetWidth) + 'px';
  const cerrar = () => { m.remove(); document.removeEventListener('click', cerrar, true); };
  setTimeout(() => document.addEventListener('click', cerrar, true), 0);
}

// ══════════════════════════════════════════════════════════
// MÓDULO (tarjetas)
// ══════════════════════════════════════════════════════════
function _demCardHTML(d, tiendas, ventas) {
  const t = tiendas.find(x => x.id === d.tienda_id);
  const v = ventas.find(x => x.id === d.venta_id);
  const esc = s => _esc2(s == null ? '' : s);
  const et = _DEM_ETAPAS[d.etapa] || _DEM_ETAPAS.amazon;
  const entregado = d.estado === 'entregado';
  const idVenta = d.id_ml_venta || v?.id_ml || d.venta_id || '';
  const dias = _demDias(d);
  const pos = _DEM_ORDEN.indexOf(d.etapa);
  const pasos = _DEM_ORDEN.map((k, i) => {
    const e = _DEM_ETAPAS[k];
    const cls = entregado || i < pos ? 'hecho' : i === pos ? 'actual' : '';
    return `<div class="dem-paso ${cls}" style="--c:${e.color};--bg:${e.bg};"><span class="dem-punto"></span><span class="dem-paso-l">${e.corto}</span></div>`;
  }).join('<div class="dem-linea"></div>');

  return `
  <div class="pc dem-card" data-dem-id="${d.id}">
    <div class="pc-head">
      <div class="pc-estado-wrap">
        <span class="pc-tienda">${t ? esc(t.nombre) : '—'}</span>
        <span class="pc-estado" style="background:${entregado ? '#d1fae5' : '#fef3c7'};color:${entregado ? '#047857' : '#b45309'};">${entregado ? _PI.check : _PI.clock}${entregado ? 'ENTREGADO' : 'DEMORADO'}</span>
        <span class="pc-fecha">${_probFechaCorta(d.fecha_registro)}</span>
      </div>
      <div class="pc-sep"></div>
      <div style="min-width:0;flex:1;">
        <div class="pc-title" style="color:${entregado ? 'var(--text)' : et.color};">${esc(entregado ? 'Producto entregado' : et.label)}</div>
        <hr class="pc-hr">
        <div class="pc-sub pc-venta">${idVenta ? `Venta <span class="venta-id" onclick="copiarIdVenta('${esc(idVenta)}',this)" title="Clic para copiar">${esc(idVenta)}</span>${_btnVerEnML(d.id_ml_venta || v?.id_ml, true)}` : 'Sin venta vinculada'}</div>
      </div>
      <button class="pc-menu-btn" title="Más opciones" onclick="event.stopPropagation();_demMenu(this,'${d.id}')">${_PI.dots}</button>
    </div>

    ${d.producto || v?.producto ? `<div class="dem-producto">${esc(d.producto || v.producto)}</div>` : ''}

    <div class="dem-pasos">${pasos}</div>

    <div class="dem-datos">
      <div class="dem-dato">
        <span class="pc-lbl">Guía internacional</span>
        <span class="pc-val strong">${d.guia_internacional ? `<span class="venta-id" onclick="copiarIdVenta('${esc(d.guia_internacional)}',this)" title="Clic para copiar">${esc(d.guia_internacional)}</span>` : '<span style="color:var(--text3);font-weight:500;">—</span>'}</span>
      </div>
      <div class="dem-dato">
        <span class="pc-lbl">Cliente</span>
        <span class="dem-chip ${d.cliente_informado ? 'si' : 'no'}">${d.cliente_informado ? '✓ Ya está informado' : '✕ No sabe aún'}</span>
      </div>
      <div class="dem-dato">
        <span class="pc-lbl">${entregado ? 'Demoró' : 'Demorado hace'}</span>
        <span class="pc-val strong" style="color:${!entregado && dias >= 15 ? 'var(--red)' : 'var(--text)'};">${dias} día${dias === 1 ? '' : 's'}</span>
      </div>
    </div>

    <div class="pc-box" style="background:rgba(100,116,139,.08);">
      <div class="pc-box-ico" style="background:#6b7280;">${_PI.pencil}</div>
      <div style="min-width:0;"><div class="pc-box-t" style="color:#111827;">Nota</div>
        <div class="pc-box-d" style="${d.nota ? '' : 'color:var(--text3);font-style:italic;'}">${d.nota ? esc(d.nota) : 'Sin notas'}</div>
        ${d.fecha_actualizacion && d.fecha_actualizacion !== d.fecha_registro ? `<div style="font-size:10.5px;color:var(--text3);margin-top:4px;">Actualizado el ${_probFechaCorta(d.fecha_actualizacion)}</div>` : ''}
      </div>
    </div>

    <div class="pc-foot">
      <button class="btn btn-ghost" onclick="openModalDemorado(null,'${d.id}')">${_PI.pencil} Actualizar</button>
      <div style="flex:1;"></div>
      ${entregado ? '' : `<button class="btn btn-success" onclick="marcarDemoradoEntregado('${d.id}')">${_PI.ok} Entregado</button>`}
    </div>
  </div>`;
}

async function renderDemorados() {
  const cont = document.getElementById('demorados-container');
  if (!cont) return;
  const [tiendas, ventas] = await Promise.all([DB.tiendas(), DB.ventas()]);
  let lista = await DB.demorados();
  updateDemoradosCount();

  const s  = gv('df-search').toLowerCase().trim();
  const fe = gv('df-estado');
  const ft = gv('df-etapa');
  const fc = gv('df-cliente');
  if (fe === 'activo')    lista = lista.filter(d => d.estado !== 'entregado');
  if (fe === 'entregado') lista = lista.filter(d => d.estado === 'entregado');
  if (ft) lista = lista.filter(d => d.etapa === ft);
  if (fc) lista = lista.filter(d => !!d.cliente_informado === (fc === 'si'));
  if (s)  lista = lista.filter(d => [d.id_ml_venta, d.guia_internacional, d.nota, d.producto].join(' ').toLowerCase().includes(s));
  // Los que más tiempo llevan demorados primero
  lista.sort((a, b) => (a.fecha_registro || '').localeCompare(b.fecha_registro || ''));

  if (!lista.length) {
    cont.innerHTML = `<div class="empty-state"><div class="empty-title">Sin productos demorados</div>
      <div class="c-dim" style="font-size:12px;">Regístralos desde el botón del reloj en el Gestor de ventas o con "Registrar demorado".</div></div>`;
    return;
  }
  cont.innerHTML = `<div class="dem-grid">${lista.map(d => _demCardHTML(d, tiendas, ventas)).join('')}</div>`;
}
