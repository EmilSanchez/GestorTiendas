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

const _DEM_RASTREO_SERVIENTREGA = 'https://servientregainternacional.com/Forms/Rastreo';

// Días entre dos fechas (por día calendario local)
function _demDiasEntre(desde, hasta) {
  const a = new Date(desde), b = new Date(hasta);
  if (isNaN(a) || isNaN(b)) return 0;
  const d0 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const d1 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.max(0, Math.round((d1 - d0) / 86400000));
}
// Días de demora. Si se ingresaron los días que ya muestra Mercado Libre, se parte
// de ese número y suma uno por cada día que pasa; si no, cuenta desde el registro.
// Cuando ya llegó, el conteo se detiene en la fecha de llegada.
function _demDias(d) {
  const hasta = d.estado === 'entregado' && d.fecha_entrega ? d.fecha_entrega : new Date();
  if (d.dias_ml != null && d.dias_ml !== '' && d.dias_ml_fecha)
    return (parseInt(d.dias_ml) || 0) + _demDiasEntre(d.dias_ml_fecha + 'T12:00:00', hasta);
  return _demDiasEntre(d.fecha_registro || d.fecha || new Date(), hasta);
}

async function updateDemoradosCount() {
  const n = (await DB.demorados()).filter(d => d.estado !== 'entregado').length;
  ['nav-dem-count', 'nav-dem-count-top'].forEach(id => {
    const b = document.getElementById(id);
    if (b) { b.textContent = n; b.style.display = n ? '' : 'none'; }
  });
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
  sv('md2-img', d?.imagen || '');
  _demPrevImg();
  // Días en ML: se muestra el conteo de hoy (el guardado + los días que han pasado)
  const tieneMl = d && d.dias_ml != null && d.dias_ml !== '';
  sv('md2-ml-dias', tieneMl ? _demDias(d) : '');
  _demMl(tieneMl ? 'si' : 'no');
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

function _demMl(v) {
  document.querySelectorAll('#md2-ml-seg button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  document.getElementById('md2-ml-wrap').style.display = v === 'si' ? 'flex' : 'none';
  if (v === 'si') setTimeout(() => document.getElementById('md2-ml-dias')?.focus(), 50);
}
function _demPrevImg() {
  const url = gv('md2-img').trim();
  const el = document.getElementById('md2-img-prev');
  el.innerHTML = /^https?:\/\//i.test(url) ? `<img src="${_esc2(url)}" alt="" onerror="this.parentNode.innerHTML='<span>✕</span>'">` : '';
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
    imagen:             gv('md2-img').trim(),
    ..._demMlGuardar(),
    estado:             antes?.estado || 'activo',
    fecha_registro:     antes?.fecha_registro || ahora,
    fecha_actualizacion: ahora,
  };
  d.historial = _demHistorialCon(antes, d);
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

// Días de ML: se guarda el número de hoy y la fecha; desde ahí sube solo cada día
function _demMlGuardar() {
  const si = document.querySelector('#md2-ml-seg button.on')?.dataset.v === 'si';
  const n = parseInt(gv('md2-ml-dias'));
  if (!si || isNaN(n)) return { dias_ml: null, dias_ml_fecha: null };
  return { dias_ml: Math.max(0, n), dias_ml_fecha: hoy() };
}

async function _demRefrescar() {
  await updateDemoradosCount();
  if (location.hash === '#demorados') await renderDemorados();
  if (typeof renderVentasGanancias === 'function' && location.hash === '#ventas') { try { await renderVentasGanancias(); } catch (e) {} }
}

async function marcarDemoradoEntregado(id, entregado = true) {
  const d = (await DB.demorados()).find(x => x.id === id);
  if (!d) return;
  const nuevo = { ...d, estado: entregado ? 'entregado' : 'activo',
    fecha_entrega: entregado ? new Date().toISOString() : null, fecha_actualizacion: new Date().toISOString() };
  nuevo.historial = _demHistorialCon(d, nuevo, entregado ? 'llego' : 'reabierto');
  await DB.upsertDemorado(nuevo);
  Sonido.play(entregado ? 'resolver' : 'editar');
  showToast(entregado ? '¡El producto ya llegó!' : 'Seguimiento reabierto', 'success', 2000);
  await _demRefrescar();
}

// "Ya llegó": pide confirmación antes de marcarlo como recibido
let _demLlegoId = null;
function pedirDemoradoLlego(id) {
  document.querySelectorAll('.pc-menu').forEach(m => m.remove());
  const d = ((typeof _cache !== 'undefined' && _cache.demorados) || []).find(x => x.id === id);
  _demLlegoId = id;
  document.getElementById('mld-detalle').innerHTML = d?.id_ml_venta
    ? `La venta <strong>${_esc2(d.id_ml_venta)}</strong> se marcará como recibida y saldrá de los demorados en seguimiento.`
    : 'Se marcará como recibido y saldrá de los demorados en seguimiento.';
  document.getElementById('mld-btn').disabled = false;
  openModal('modal-llego-demorado');
}
async function _demConfirmarLlego() {
  const btn = document.getElementById('mld-btn');
  if (!_demLlegoId || btn.disabled) return;
  btn.disabled = true;
  closeModal('modal-llego-demorado');
  await marcarDemoradoEntregado(_demLlegoId, true);
  _demLlegoId = null;
}

// ══════════════════════════════════════════════════════════
// ACTUALIZACIONES ANTERIORES (historial)
// ══════════════════════════════════════════════════════════
// Cada guardado deja una entrada con la etapa y la nota de ese momento, y qué cambió.
const _DEM_HIST_CAMPOS = { etapa: 'Etapa', guia_internacional: 'Guía', cliente_informado: 'Cliente', dias: 'Días en ML', imagen: 'Imagen' };
function _demHistValor(campo, v) {
  if (campo === 'cliente_informado') return v ? 'Ya está informado' : 'No sabe aún';
  if (v == null || v === '') return '—';
  if (campo === 'etapa') return _DEM_ETAPAS[v]?.label || v;
  return String(v);
}
function _demHistorialCon(antes, nuevo, accion) {
  const hist = Array.isArray(antes?.historial) ? antes.historial.slice() : [];
  const usuario = (typeof _currentUser !== 'undefined' && _currentUser?.usuario) || '';
  const base = { fecha: nuevo.fecha_actualizacion || new Date().toISOString(), usuario, etapa: nuevo.etapa, nota: nuevo.nota || '' };
  if (!antes) { hist.push({ ...base, accion: 'creado', cambios: [] }); return hist; }
  // Registros de antes de existir el historial: lo que había queda como punto de partida
  if (!hist.length) hist.push(..._demHistInicial(antes));
  const usaMl = x => x.dias_ml != null && x.dias_ml !== '';
  const val = (x, k) => k === 'dias' ? (usaMl(x) ? _demDias(x) : '') : k === 'cliente_informado' ? !!x[k] : (x[k] ?? '');
  const cambios = Object.keys(_DEM_HIST_CAMPOS)
    .filter(k => String(val(antes, k)) !== String(val(nuevo, k)))
    .map(k => ({ campo: k, antes: val(antes, k), despues: val(nuevo, k) }));
  const notaNueva = (antes.nota || '') !== (nuevo.nota || '');
  if (!accion && !cambios.length && !notaNueva) return hist;
  hist.push({ ...base, accion: accion || 'actualizado', nota_nueva: notaNueva, cambios });
  return hist;
}

// Lo que se sabe de un registro sin historial: cuándo se creó y su última actualización
function _demHistInicial(d) {
  const editado = d.fecha_actualizacion && d.fecha_actualizacion !== d.fecha_registro;
  const h = [{ fecha: d.fecha_registro, accion: 'creado', etapa: editado ? null : d.etapa, nota: editado ? '' : d.nota || '', cambios: [] }];
  if (editado) h.push({ fecha: d.fecha_actualizacion, accion: 'previo', etapa: d.etapa, nota: d.nota || '', cambios: [] });
  return h;
}

async function verHistorialDemorado(id) {
  document.querySelectorAll('.pc-menu').forEach(m => m.remove());
  const d = (await DB.demorados()).find(x => x.id === id);
  if (!d) return;
  const ACC = {
    creado:      'Seguimiento registrado',
    previo:      'Última actualización registrada',
    actualizado: 'Seguimiento actualizado',
    llego:       'El producto ya llegó',
    reabierto:   'Seguimiento reabierto',
  };
  const hist = Array.isArray(d.historial) && d.historial.length ? d.historial.slice() : _demHistInicial(d);
  hist.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const esc = s => _esc2(s == null ? '' : s);
  const fh = typeof _fmtFechaHora === 'function' ? _fmtFechaHora : _probFechaCorta;
  document.getElementById('mhp-title').textContent = 'Actualizaciones';
  document.getElementById('mhp-sub').textContent = `Producto demorado${d.id_ml_venta ? ' · Venta ' + d.id_ml_venta : ''}`;
  document.getElementById('mhp-body').innerHTML = hist.map(h => {
    const et = _DEM_ETAPAS[h.etapa];
    const color = h.accion === 'llego' ? '#10b981' : h.accion === 'reabierto' ? '#f59e0b' : (et?.color || '#64748b');
    const verNota = h.nota && (h.accion === 'creado' || h.accion === 'previo' || h.nota_nueva);
    const det = (h.cambios || []).filter(c => c.campo !== 'etapa' || h.accion !== 'creado')
      .map(c => c.campo === 'imagen'
        ? `<div class="hp-diff"><strong>Imagen:</strong> ${c.despues ? 'actualizada' : 'quitada'}</div>`
        : `<div class="hp-diff"><strong>${_DEM_HIST_CAMPOS[c.campo]}:</strong> <s>${esc(_demHistValor(c.campo, c.antes))}</s> → ${esc(_demHistValor(c.campo, c.despues))}</div>`).join('');
    return `<div class="hp-item"><span class="hp-dot" style="background:${color};"></span>
      <div class="hp-when">${h.fecha ? fh(h.fecha) : ''}${h.usuario ? ' · ' + esc(h.usuario) : ''}</div>
      <div class="hp-what">${ACC[h.accion] || 'Actualización'}</div>
      ${et && h.accion !== 'llego' ? `<span class="dem-hist-etapa" style="background:${et.bg};color:${et.color};">${et.label}</span>` : ''}
      ${verNota ? `<div class="dem-hist-nota">${esc(h.nota)}</div>` : ''}${det}</div>`;
  }).join('');
  openModal('modal-historial-problema');
}

function _demMenu(btn, id) {
  document.querySelectorAll('.pc-menu').forEach(m => m.remove());
  const d = ((typeof _cache !== 'undefined' && _cache.demorados) || []).find(x => x.id === id);
  const m = document.createElement('div');
  m.className = 'pc-menu';
  const ic = p => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  m.innerHTML = `
    <button onclick="verHistorialDemorado('${id}')">${ic('<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>')} Actualizaciones anteriores</button>
    ${d?.venta_id && typeof openModalVenta === 'function' ? `<button onclick="document.querySelectorAll('.pc-menu').forEach(x=>x.remove());openModalVenta('${d.venta_id}')">${ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>')} Editar venta</button>` : ''}
    ${d?.estado === 'entregado' ? `<button onclick="document.querySelectorAll('.pc-menu').forEach(x=>x.remove());marcarDemoradoEntregado('${id}', false)">${ic('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>')} Reabrir seguimiento</button>` : ''}
    ${d?.estado !== 'entregado' ? `<div class="pc-menu-sep"></div>
    <button onclick="pedirDemoradoLlego('${id}')" style="color:#047857;">${ic('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="7.5 12 10.5 15 16.5 9"/>')} Ya llegó</button>` : ''}`;
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
  const pos = entregado ? 99 : _DEM_ORDEN.indexOf(d.etapa);
  // Lo que ya pasó (✓) y lo que aún no (✕)
  const hitos = [
    ['Amazon lo envió',  pos >= 1],
    ['Salió de EE.UU.',  pos >= 1],
    ['Llegó a Colombia', pos >= 2],
  ].map(([l, ok]) => `<div class="dem-hito ${ok ? 'ok' : 'no'}"><span class="dem-hito-i">${ok ? '✓' : '✕'}</span>${l}</div>`).join('');
  const usaMl = d.dias_ml != null && d.dias_ml !== '';
  const guia = d.guia_internacional ? esc(d.guia_internacional) : '';
  const img = d.imagen ? esc(d.imagen) : '';
  const producto = d.producto || v?.producto || '';
  const numMl = d.id_ml_venta || v?.id_ml;
  const nHist = Array.isArray(d.historial) ? d.historial.length : 0;  // "Ver anteriores" si hay más de una
  return `
  <div class="pc dem-card" data-dem-id="${d.id}">
    <div class="pc-head">
      ${img ? `<a href="${img}" target="_blank" rel="noopener" class="dem-thumb" title="${esc(producto) || 'Ver imagen'}"><img src="${img}" alt="" loading="lazy" onerror="this.parentNode.classList.add('err','vacio')">${_DEM_ICO_CAJA}</a>`
            : `<div class="dem-thumb vacio" title="Sin imagen">${_DEM_ICO_CAJA}</div>`}
      <div class="pc-sep"></div>
      <div class="pc-estado-wrap">
        <span class="pc-tienda">${t ? esc(t.nombre) : '—'}</span>
        <span class="pc-estado" style="background:${entregado ? '#d1fae5' : '#fef3c7'};color:${entregado ? '#047857' : '#b45309'};">${entregado ? _PI.check : _PI.clock}${entregado ? 'YA LLEGÓ' : 'DEMORADO'}</span>
        <span class="pc-fecha">${_probFechaCorta(d.fecha_registro)}</span>
      </div>
      <div class="pc-sep"></div>
      <div style="min-width:0;flex:1;">
        <div class="pc-title" style="color:${entregado ? 'var(--text)' : et.color};">${esc(entregado ? 'El producto ya llegó' : et.label)}</div>
        <hr class="pc-hr">
        ${idVenta ? `<div class="dem-venta">
          <span class="venta-id" onclick="copiarIdVenta('${esc(idVenta)}',this)" title="Clic para copiar el número de venta">${esc(idVenta)}</span>
          ${numMl ? `<a class="dem-ml-btn" href="${_mlVentaUrl(numMl)}" target="_blank" rel="noopener" onclick="event.stopPropagation();" title="Ver la venta en Mercado Libre">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Ver en Mercado Libre</a>` : ''}
        </div>` : '<div class="pc-sub">Sin venta vinculada</div>'}
        ${producto ? `<div class="dem-producto" title="${esc(producto)}">${esc(producto)}</div>` : ''}
      </div>
      <button class="pc-menu-btn" title="Más opciones" onclick="event.stopPropagation();_demMenu(this,'${d.id}')">${_PI.dots}</button>
    </div>

    <div class="dem-hitos">${hitos}</div>

    <div class="dem-datos">
      <div class="dem-dato">
        <span class="pc-lbl">Guía internacional</span>
        ${guia ? `<span class="dem-guia">
          <span class="venta-id" onclick="copiarIdVenta('${guia}',this)" title="Clic para copiar">${guia}</span>
          <button class="dem-ico-btn" title="Copiar guía" onclick="copiarIdVenta('${guia}',this)">${_PI.copy}</button>
          <button class="dem-ico-btn" title="Rastrear en Servientrega Internacional (copia la guía para pegarla)" onclick="_demRastrear('${guia}', this)">${_DEM_ICO_SERVIENTREGA}</button>
        </span>` : '<span class="pc-val" style="color:var(--text3);">—</span>'}
      </div>
      <div class="dem-dato">
        <span class="pc-lbl">Cliente</span>
        <span class="dem-chip ${d.cliente_informado ? 'si' : 'no'}">${d.cliente_informado ? '✓ Ya está informado' : '✕ No sabe aún'}</span>
      </div>
      <div class="dem-dato">
        <span class="pc-lbl">${usaMl ? (entregado ? 'Demora en ML' : 'Días en ML') : (entregado ? 'Demoró' : 'Demorado hace')}</span>
        <span class="pc-val strong" style="color:${!entregado && dias >= 15 ? 'var(--red)' : 'var(--text)'};">${dias} día${dias === 1 ? '' : 's'}</span>
      </div>
    </div>

    <div class="pc-box" style="background:rgba(100,116,139,.08);">
      <div class="pc-box-ico" style="background:#6b7280;">${_PI.pencil}</div>
      <div style="min-width:0;flex:1;"><div class="pc-box-t" style="color:#111827;">Nota</div>
        <div class="pc-box-d" style="${d.nota ? '' : 'color:var(--text3);font-style:italic;'}">${d.nota ? esc(d.nota) : 'Sin notas'}</div>
        ${d.fecha_actualizacion && d.fecha_actualizacion !== d.fecha_registro ? `<div class="dem-nota-pie">Actualizado el ${_probFechaCorta(d.fecha_actualizacion)}${nHist > 1 ? ` · <a onclick="verHistorialDemorado('${d.id}')">Ver anteriores</a>` : ''}</div>` : ''}
      </div>
    </div>

    <div class="pc-foot">
      <button class="btn btn-ghost" onclick="openModalDemorado(null,'${d.id}')">${_PI.pencil} Actualizar</button>
      <div style="flex:1;"></div>
      ${entregado ? '' : `<button class="btn btn-success" onclick="pedirDemoradoLlego('${d.id}')">${_PI.ok} Ya llegó</button>`}
    </div>
  </div>`;
}

// Ícono de Servientrega (hoja verde con la "S") y de caja para tarjetas sin foto
const _DEM_ICO_SERVIENTREGA = `<svg width="20" height="20" viewBox="0 0 24 24" aria-label="Servientrega"><path d="M9.5 1.5H20a2.5 2.5 0 0 1 2.5 2.5v10.5a8 8 0 0 1-8 8H4A2.5 2.5 0 0 1 1.5 20V9.5a8 8 0 0 1 8-8z" fill="#3fae49"/><path d="M15.7 8.6c-.8-1.1-2.1-1.7-3.7-1.7-2 0-3.4 1-3.4 2.5 0 1.6 1.4 2.2 3.5 2.6 2.2.4 3.6 1.1 3.6 2.8s-1.5 2.8-3.7 2.8c-1.7 0-3.1-.7-3.9-1.8" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round"/></svg>`;
const _DEM_ICO_CAJA = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;

// Copia la guía y abre el rastreo de Servientrega Internacional (allí se pega)
function _demRastrear(guia, btn) {
  copiarIdVenta(guia, btn);
  window.open(_DEM_RASTREO_SERVIENTREGA, '_blank', 'noopener');
  showToast('Guía copiada — pégala en el rastreo de Servientrega', 'info', 3000);
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
