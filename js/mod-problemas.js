/* Módulo Problemas */

// ── PROBLEMAS ──
var _editProbId = null;
var _ventaSelProblema = null;

// ══════════════════════════════════════════════════════════
// CATEGORÍAS DE PROBLEMA — editables, sincronizadas con Firestore
// (localStorage se usa solo como caché local para poder leerlas
// de forma síncrona; la fuente de verdad real es Firestore, en
// config/categorias_problema, para que sean las mismas en todos
// los navegadores y sesiones).
// ══════════════════════════════════════════════════════════
const _CATS_KEY = 'mm_prob_cats_v1';

const _CATS_DEFAULT = [
  { id:'producto_danado',   label:'Producto dañado'      },
  { id:'devolucion',        label:'Devolución'            },
  { id:'reclamo',           label:'Reclamo del cliente'   },
  { id:'envio_perdido',     label:'Envío perdido'         },
  { id:'no_recibio',        label:'Cliente no recibió'    },
  { id:'diferencia_precio', label:'Diferencia de precio'  },
  { id:'cancelacion',       label:'Cancelación'           },
  { id:'otro',              label:'Otro'                  },
];

function _getCats() {
  try {
    const raw = localStorage.getItem(_CATS_KEY);
    if (raw) return JSON.parse(raw);
    // Primera vez: guardar los defaults para que persistan
    localStorage.setItem(_CATS_KEY, JSON.stringify(_CATS_DEFAULT));
    return [..._CATS_DEFAULT];
  } catch { return [..._CATS_DEFAULT]; }
}

async function _saveCats(cats) {
  localStorage.setItem(_CATS_KEY, JSON.stringify(cats));
  try { await _cfg('categorias_problema').set({ cats }); }
  catch(e) { console.warn('No se pudo sincronizar categorías con Firebase:', e); }
}

// Trae las categorías guardadas en Firestore y actualiza el caché local
// (localStorage). Si en Firestore todavía no hay nada guardado (primera
// vez que se usa esta función tras la actualización), sube las categorías
// locales actuales para que queden disponibles para todos los navegadores.
let _catsSyncing = false;
async function _syncCatsFromFirestore() {
  if (_catsSyncing) return;
  _catsSyncing = true;
  try {
    const snap = await _cfg('categorias_problema').get();
    const remoto = snap.exists ? snap.data().cats : null;
    if (Array.isArray(remoto) && remoto.length) {
      localStorage.setItem(_CATS_KEY, JSON.stringify(remoto));
    } else {
      await _cfg('categorias_problema').set({ cats: _getCats() });
    }
  } catch(e) { console.warn('No se pudo sincronizar categorías con Firebase:', e); }
  finally {
    _catsSyncing = false;
    _fillTipoSelects();
    if (document.getElementById('modal-categorias')?.classList.contains('open')) _renderCatList();
  }
}

// Sincroniza TIPO_LABELS con las categorías actuales
function _buildTipoLabels() {
  const obj = {};
  _getCats().forEach(c => { obj[c.id] = c.label; });
  return obj;
}
let TIPO_LABELS = _buildTipoLabels();

// Conteo de problemas sin cerrar (estado 'abierto'), total y por categoría.
// Alimenta el número del menú lateral y los del filtro de categoría.
let _probAbiertosPorTipo = null;
let _probAbiertosTotal = 0;
async function updatePendientesCount(problemas) {
  problemas = problemas || await DB.problemas();
  const porTipo = {};
  let total = 0;
  problemas.forEach(p => {
    if (p.estado !== 'abierto') return;
    total++;
    porTipo[p.tipo] = (porTipo[p.tipo] || 0) + 1;
  });
  _probAbiertosPorTipo = porTipo;
  _probAbiertosTotal = total;
  const b = document.getElementById('nav-prob-count');
  if (b) { b.textContent = total; b.style.display = total ? '' : 'none'; }
  _fillTipoSelects();
}

// Llena cualquier <select> de tipos con las categorías actuales
function _fillTipoSelects() {
  TIPO_LABELS = _buildTipoLabels();
  const cats = _getCats();
  // En el filtro, cada categoría muestra cuántos pendientes sin cerrar tiene
  const cnt = n => _probAbiertosPorTipo ? ` (${n || 0})` : '';
  const optsFilter = `<option value="">Todas${cnt(_probAbiertosTotal)}</option>` +
    cats.map(c => `<option value="${c.id}">${c.label}${cnt(_probAbiertosPorTipo?.[c.id])}</option>`).join('');
  const optsForm = cats.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
  const pf = document.getElementById('pf-tipo');
  const pt = document.getElementById('p-tipo');
  // Conservar la opción elegida: reconstruir el innerHTML la resetea a la primera
  // (en el filtro eso volvía a "Todas" justo antes de filtrar).
  const _refill = (el, html) => {
    if (!el) return;
    if (el.dataset.optsHtml === html) return; // sin cambios: no tocar la selección
    const prev = el.value;
    el.innerHTML = html;
    el.dataset.optsHtml = html;
    if (prev && [...el.options].some(o => o.value === prev)) el.value = prev;
  };
  _refill(pf, optsFilter);
  _refill(pt, optsForm);
}

// ── MODAL GESTIONAR CATEGORÍAS ──
async function openModalCategorias() {
  _renderCatList();
  document.getElementById('modal-categorias').classList.add('open');
  await _syncCatsFromFirestore(); // refresca con lo último guardado por otros navegadores/usuarios
}

function _renderCatList() {
  const cats = _getCats();
  const list = document.getElementById('cat-list');
  if (!list) return;
  list.innerHTML = cats.map((c, i) => `
    <div class="cat-row" id="cat-row-${i}" style="
      display:flex;align-items:center;gap:8px;padding:8px 12px;
      background:var(--white);border:1px solid var(--border);border-radius:8px;
      animation:ayudaIn .2s ease both;animation-delay:${i*30}ms;
    ">
      <span style="font-size:11px;color:var(--text3);min-width:20px;text-align:right;">${i+1}</span>
      <input type="text" value="${_esc2(c.label)}" id="cat-label-${i}"
        style="flex:1;font-size:0.85rem;border:1px solid var(--border);border-radius:6px;
               padding:5px 9px;transition:border-color .15s;"
        onkeydown="if(event.key==='Enter')guardarCat(${i})"
        onfocus="this.style.borderColor='var(--teal)'"
        onblur="this.style.borderColor='var(--border)'">
      <button onclick="guardarCat(${i})" title="Guardar" style="
        width:28px;height:28px;border:none;border-radius:6px;cursor:default;
        background:var(--teal-bg);color:var(--teal);font-size:14px;
        display:flex;align-items:center;justify-content:center;transition:all .15s;"
        onmouseover="this.style.background='var(--teal)';this.style.color='#fff'"
        onmouseout="this.style.background='var(--teal-bg)';this.style.color='var(--teal)'"
        ><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>
      ${cats.length > 1 ? `<button onclick="_eliminarCat(${i})" title="Eliminar" style="
        width:28px;height:28px;border:none;border-radius:6px;cursor:default;
        background:transparent;color:var(--text3);font-size:14px;
        display:flex;align-items:center;justify-content:center;transition:all .15s;"
        onmouseover="this.style.background='var(--red-bg)';this.style.color='var(--red)'"
        onmouseout="this.style.background='transparent';this.style.color='var(--text3)'"
        ><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>` : ''}
    </div>
  `).join('');
}

async function guardarCat(i) {
  const cats = _getCats();
  const input = document.getElementById(`cat-label-${i}`);
  if (!input) return;
  const newLabel = input.value.trim();
  if (!newLabel) {
    input.style.borderColor = 'var(--red)';
    input.classList.add('shake');
    setTimeout(() => { input.style.borderColor = 'var(--border)'; input.classList.remove('shake'); }, 500);
    return;
  }
  const oldId    = cats[i].id;
  const oldLabel = cats[i].label;
  cats[i].label  = newLabel;
  await _saveCats(cats);
  _fillTipoSelects();

  // Actualizar tipo_label en todos los problemas de Firebase que usen este tipo
  if (oldLabel !== newLabel) {
    try {
      const problemas = await DB.problemas();
      let cambios = 0;
      problemas.forEach(p => {
        if (p.tipo === oldId) { p.tipo_label = newLabel; cambios++; }
      });
      if (cambios > 0) await DB.saveProblemas(problemas);
    } catch(e) { console.warn('No se pudo actualizar tipo_label en Firebase:', e); }
  }

  // Flash verde en la fila
  const row = document.getElementById(`cat-row-${i}`);
  if (row) {
    row.style.background = 'var(--green-bg)';
    row.style.borderColor = '#6cc490';
    setTimeout(() => { row.style.background = ''; row.style.borderColor = 'var(--border)'; }, 800);
  }
  showToast('Categoría actualizada', 'success', 1800);
}

async function _eliminarCat(i) {
  const cats = _getCats();
  if (cats.length <= 1) return;
  cats.splice(i, 1);
  await _saveCats(cats);
  _fillTipoSelects();
  _renderCatList();
  showToast('Categoría eliminada', 'info', 1800);
}

async function agregarCat() {
  const input = document.getElementById('cat-nueva-label');
  if (!input) return;
  const label = input.value.trim();
  if (!label) {
    input.style.borderColor = 'var(--red)';
    input.classList.add('shake');
    setTimeout(() => { input.style.borderColor = 'var(--border)'; input.classList.remove('shake'); }, 500);
    return;
  }
  const id = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_áéíóúñ]/g, '').replace(/[áéíóúñ]/g, c => ({á:'a',é:'e',í:'i',ó:'o',ú:'u',ñ:'n'}[c]||c));
  const cats = _getCats();
  if (cats.find(c => c.id === id)) { showToast('Ya existe una categoría con ese nombre', 'error', 2000); return; }
  cats.push({ id, label });
  await _saveCats(cats);
  _fillTipoSelects();
  input.value = '';
  _renderCatList();
  showToast('Categoría agregada', 'success', 1800);
}

function _esc2(s) {
  return String(s).replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ══════════════════════════════════════════════════════════
// MODAL / FORM PROBLEMA
// ══════════════════════════════════════════════════════════
async function openModalProblema(ventaId, probId) {
  _editProbId = probId || null;
  _ventaSelProblema = null;
  document.getElementById('mp-title').textContent = probId ? 'Editar problema' : 'Registrar problema';
  document.getElementById('mp-tab-form').textContent = probId ? 'Editar' : 'Registrar';
  document.getElementById('p-buscar').value = '';
  document.getElementById('p-buscar-resultado').innerHTML = '';
  document.getElementById('p-num-venta-manual').value = '';
  sv('p-fecha', hoy()); sv('p-tipo','producto_danado');
  sv('p-descripcion',''); sv('p-solucion',''); sv('p-estado','abierto'); sv('p-perdida','');

  _fillTipoSelects();

  let p = null;
  if (probId) p = (await DB.problemas()).find(x => x.id === probId) || null;
  const vid = ventaId || p?.venta_id;
  if (vid) {
    const v = (await DB.ventas()).find(x => x.id === vid);
    if (v) { document.getElementById('p-buscar').value = v.id_ml || v.id; await seleccionarVentaProblema(v); }
  }
  if (p) {
    sv('p-fecha', p.fecha); sv('p-tipo', p.tipo);
    sv('p-descripcion', p.descripcion); sv('p-solucion', p.solucion || '');
    sv('p-estado', p.estado); sv('p-perdida', p.valor_perdida || '');
    sv('p-num-venta-manual', p.id_ml_venta || '');
  }
  _mpTogglePerdida();

  // Otros problemas de la misma venta → pestaña "Problemas anteriores".
  // Desde el gestor de ventas, si la venta tiene alguno abierto, se abre en esa pestaña.
  const previos = vid ? (await DB.problemas()).filter(x => x.venta_id === vid && x.id !== probId) : [];
  await _mpRenderPrevios(previos);
  _mpTab(!probId && previos.some(x => x.estado === 'abierto') ? 'prev' : 'form');
  openModal('modal-problema');
}

function _mpTab(tab) {
  const prev = tab === 'prev';
  document.getElementById('mp-tab-form').classList.toggle('active', !prev);
  document.getElementById('mp-tab-prev').classList.toggle('active', prev);
  document.getElementById('mp-pane-form').style.display = prev ? 'none' : '';
  document.getElementById('mp-pane-prev').style.display = prev ? '' : 'none';
  document.getElementById('mp-footer').style.display = prev ? 'none' : '';
}

function _mpTogglePerdida() {
  const w = document.getElementById('p-perdida-wrap');
  if (w) w.style.display = gv('p-estado') === 'perdida' ? '' : 'none';
}

async function _mpRenderPrevios(previos) {
  const tab = document.getElementById('mp-tab-prev');
  const pane = document.getElementById('mp-pane-prev');
  tab.style.display = previos.length ? '' : 'none';
  document.getElementById('mp-prev-count').textContent = previos.length;
  if (!previos.length) { pane.innerHTML = ''; return; }
  const [tiendas, ventas] = await Promise.all([DB.tiendas(), DB.ventas()]);
  previos.sort((a,b) => (b.fecha_registro||'').localeCompare(a.fecha_registro||''));
  pane.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;">${previos.map(p => _probCardHTML(p, tiendas, ventas, true)).join('')}</div>`;
}
async function buscarVentaProblema() {
  const query = gv('p-buscar').toLowerCase().trim();
  if (!query) return;
  const ventas = await DB.ventas();
  const resultados = ventas.filter(v =>
    (v.id_ml||'').toLowerCase().includes(query) ||
    (v.id||'').toLowerCase().includes(query) ||
    (v.producto||'').toLowerCase().includes(query) ||
    (v.cliente||'').toLowerCase().includes(query)
  ).slice(0, 5);

  const el = document.getElementById('p-buscar-resultado');
  if (!resultados.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:4px 0;">No se encontraron ventas.</div>';
    return;
  }
  const tiendas = await DB.tiendas();
  el.innerHTML = resultados.map(v => {
    const t = tiendas.find(x => x.id === v.tienda_id);
    return `<div onclick="seleccionarVentaProblema(${JSON.stringify(v).replace(/"/g,'&quot;')})"
      style="padding:7px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);
             margin-top:3px;cursor:default;font-size:12px;"
      onmouseover="this.style.background='var(--teal-bg)'" onmouseout="this.style.background='var(--bg)'">
      <strong class="venta-id" onclick="copiarIdVenta('${v.id_ml||v.id}',this)" title="Clic para copiar ID">${v.id_ml||v.id}</strong>
      <span class="c-dim" style="margin:0 6px;">·</span>${v.producto}
      <span class="c-dim" style="margin:0 4px;">·</span>
      <span style="font-size:10px;">${t?.nombre||'?'}</span>
      <span class="badge badge-${v.estado||'pendiente'}" style="margin-left:6px;">${v.estado||'?'}</span>
    </div>`;
  }).join('');
}

async function seleccionarVentaProblema(v) {
  _ventaSelProblema = typeof v === 'string' ? JSON.parse(v) : v;
  const t = (await DB.tiendas()).find(x => x.id === _ventaSelProblema.tienda_id);
  document.getElementById('p-buscar-resultado').innerHTML = `
    <div class="mp-sel-venta">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#16a34a" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="11" stroke="none"/><polyline points="17 8.5 10.5 15 7 11.5"/></svg>
      <strong>${_ventaSelProblema.id_ml||_ventaSelProblema.id}</strong>
      <span class="c-dim">— ${t?.nombre||'?'} — ${_ventaSelProblema.fecha_venta||''}</span>
    </div>`;
}

async function saveProblema() {
  const desc   = gv('p-descripcion').trim();
  const estado = gv('p-estado');
  const solucion = gv('p-solucion').trim();
  if (!desc) { alert('La descripción es requerida.'); return; }
  if ((estado==='resuelto'||estado==='perdida') && !solucion) {
    alert('Para marcar como resuelto o con pérdida, debes registrar la solución.');
    document.getElementById('p-solucion').focus();
    return;
  }

  const tipo = gv('p-tipo');
  const numVentaManual = gv('p-num-venta-manual').trim();
  const existingProb = _editProbId ? (await DB.problemas()).find(x => x.id === _editProbId) : null;

  const nuevo = {
    id:           _editProbId || uid(),
    venta_id:     _ventaSelProblema?.id || existingProb?.venta_id || '',
    id_ml_venta:  _ventaSelProblema?.id_ml || numVentaManual || existingProb?.id_ml_venta || '',
    producto:     _ventaSelProblema?.producto || existingProb?.producto || '',
    tienda_id:    _ventaSelProblema?.tienda_id || existingProb?.tienda_id || '',
    fecha:        gv('p-fecha'),
    tipo,
    tipo_label:   TIPO_LABELS[tipo] || tipo,
    descripcion:  desc,
    solucion:     gv('p-solucion').trim(),
    estado:       gv('p-estado'),
    valor_perdida: parseFloat(gv('p-perdida')) || 0,
    fecha_registro: existingProb?.fecha_registro || new Date().toISOString(),
    // Fecha/hora de la última edición — nunca toca fecha_registro (la fecha original de creación)
    fecha_actualizacion: new Date().toISOString(),
  };
  nuevo.historial = _probHistorialCon(existingProb, nuevo);
  await DB.upsertProblema(nuevo);
  closeModal('modal-problema');
  // Renderizar módulo de problemas si está activo
  try { await renderProblemas(); } catch(e) {}
  try { await updateAlertaBadge(); } catch(e) {}
  try { await _actualizarBotonesProblema(); } catch(e) {}
  // Actualizar gestor de ventas siempre
  if (typeof renderVentasGanancias === 'function') await renderVentasGanancias();
  else if (typeof renderVentas === 'function') await renderVentas();
}

// Un cambio de filtro dispara varias llamadas casi simultáneas (onchange + listeners
// input/change). Solo la última en empezar puede pintar; las anteriores que terminen
// después se descartan para no pisar el filtro con un resultado viejo.
let _probRenderSeq = 0;
async function renderProblemas() {
  const seq = ++_probRenderSeq;
  await _syncCatsFromFirestore();
  const tiendas   = await DB.tiendas();
  const ventas    = await DB.ventas();
  let   problemas = await DB.problemas();
  if (seq !== _probRenderSeq) return;
  await updatePendientesCount(problemas);
  if (seq !== _probRenderSeq) return;

  const s   = gv('pf-search').toLowerCase();
  const fe  = gv('pf-estado');
  const ft  = gv('pf-tienda');
  const ftp = gv('pf-tipo');

  if (s)   problemas = problemas.filter(p => (p.id_ml_venta+p.producto+p.descripcion).toLowerCase().includes(s));
  if (fe)  problemas = problemas.filter(p => p.estado === fe);
  if (ft)  problemas = problemas.filter(p => p.tienda_id === ft);
  if (ftp) problemas = problemas.filter(p => p.tipo === ftp);
  // Orden: por fecha_registro (momento real en que se creó, no la fecha manual del
  // problema). El filtro "Orden" permite elegir de más reciente a más viejo o al revés.
  const orden = gv('pf-orden') || 'desc';
  problemas.sort((a,b) => orden === 'asc'
    ? (a.fecha_registro||'').localeCompare(b.fecha_registro||'')
    : (b.fecha_registro||'').localeCompare(a.fecha_registro||''));

  if (!problemas.length) {
    document.getElementById('problemas-container')._probCards = null;
    document.getElementById('problemas-container').innerHTML = `
      <div class="empty-state"><div class="empty-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
      <div class="empty-title">Sin problemas registrados</div>
      <div class="c-dim" style="font-size:12px;">Puedes registrar novedades desde aquí o desde el detalle de cada venta</div></div>`;
    return;
  }

  const cont = document.getElementById('problemas-container');
  const tmp = document.createElement('div');
  tmp.innerHTML = problemas.map(p => _probCardHTML(p, tiendas, ventas)).join('');
  cont._probCards = [...tmp.children];
  cont._probCols = 0;
  _probLayout(true);
}

// Las tarjetas se reparten en columnas independientes (en orden: 1ª a la
// izquierda, 2ª a su derecha…). Así, al desplegar una tarjeta solo se empujan
// hacia abajo las de su misma columna y las de los lados no se mueven.
const _PROB_COL_MIN = 440, _PROB_GAP = 16;
function _probLayout(forzar) {
  const cont = document.getElementById('problemas-container');
  const cards = cont?._probCards;
  if (!cards || !cards.length) return;
  const w = cont.clientWidth;
  if (!w && !forzar) return;  // módulo oculto: se acomoda al mostrarse
  const n = Math.max(1, Math.floor((w + _PROB_GAP) / (_PROB_COL_MIN + _PROB_GAP)));
  if (!forzar && n === cont._probCols) return;
  cont._probCols = n;
  const wrap = document.createElement('div');
  wrap.className = 'pc-cols';
  const cols = Array.from({ length: n }, () => {
    const c = document.createElement('div');
    c.className = 'pc-col';
    wrap.appendChild(c);
    return c;
  });
  cards.forEach((card, i) => cols[i % n].appendChild(card));
  cont.replaceChildren(wrap);
  if (!cont._probRO && typeof ResizeObserver !== 'undefined') {
    cont._probRO = new ResizeObserver(() => _probLayout());
    cont._probRO.observe(cont);
  }
}

// ══════════════════════════════════════════════════════════
// TARJETA DE PROBLEMA
// ══════════════════════════════════════════════════════════
const _PROB_ESTADO_CFG = {
  abierto:  { bg:'#fef3c7', color:'#b45309', label:'ABIERTO',  dot:'#f59e0b' },
  resuelto: { bg:'#d1fae5', color:'#047857', label:'RESUELTO', dot:'#10b981' },
  perdida:  { bg:'#fee2e2', color:'#b91c1c', label:'PÉRDIDA',  dot:'#ef4444' },
};
const _PI = {
  clock:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 7 12 12 15 14"/></svg>',
  check:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="16.5 9 10.5 15 7.5 12"/></svg>',
  doc:    '<svg class="pc-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>',
  store:  '<svg class="pc-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v8h14v-8"/><path d="M10 21v-5h4v5"/></svg>',
  cal:    '<svg class="pc-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>',
  sync:   '<svg class="pc-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  tag:    '<svg class="pc-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  trend:  '<svg class="pc-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  down:   '<svg class="pc-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>',
  copy:   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  dots:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  pencil: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  ok:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
};

function _probCardHTML(p, tiendas, ventas, compacto) {
  const t  = tiendas.find(x => x.id === p.tienda_id);
  const v  = ventas.find(x => x.id === p.venta_id);
  const cv = v ? calcVenta(v) : null;
  const ec = _PROB_ESTADO_CFG[p.estado] || { bg:'#f3f4f6', color:'#374151', label: String(p.estado||'').toUpperCase() };
  const tipoLabel = TIPO_LABELS[p.tipo] || p.tipo_label || p.tipo || '';
  const idVenta = p.id_ml_venta || p.venta_id || '';
  const esc = s => _esc2(s == null ? '' : s);
  const gan = cv ? cv.ganancia : null;
  const ganColor = gan == null ? 'var(--text3)' : gan >= 0 ? '#047857' : '#b91c1c';
  const actualizado = p.fecha_actualizacion && p.fecha_actualizacion !== p.fecha_registro;

  return `
  <div class="pc${_probAbiertas.has(p.id) ? ' open' : ''}" data-prob-id="${p.id}">
    <div class="pc-head">
      <span class="pc-estado" style="background:${ec.bg};color:${ec.color};">${p.estado === 'abierto' ? _PI.clock : _PI.check}${ec.label}</span>
      <div class="pc-sep"></div>
      <div style="min-width:0;">
        <div class="pc-title">${esc(tipoLabel)}</div>
        <div class="pc-sub">${t ? esc(t.nombre) : '—'}</div>
      </div>
      <button class="pc-menu-btn pc-toggle" title="Ver detalles" onclick="_probToggle(this,'${p.id}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
      <button class="pc-menu-btn" style="margin-left:0;" title="Más opciones" onclick="event.stopPropagation();_probMenu(this,'${p.id}')">${_PI.dots}</button>
    </div>
    <div class="pc-collapse"><div><div class="pc-grid">
      <div class="pc-cell">${_PI.doc}<div style="min-width:0;"><div class="pc-lbl">ID de venta</div>
        <div class="pc-val strong" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">${idVenta ? `<span class="venta-id" onclick="copiarIdVenta('${esc(idVenta)}',this)" title="Clic para copiar">${esc(idVenta)}</span>${_btnVerEnML(p.id_ml_venta, true)}` : '—'}</div></div></div>
      <div class="pc-cell">${_PI.store}<div><div class="pc-lbl">Tienda</div><div class="pc-val">${t ? esc(t.nombre) : '—'}</div></div></div>
      ${compacto ? '' : `
      <div class="pc-cell">${_PI.cal}<div><div class="pc-lbl">Registrado</div><div class="pc-val">${p.fecha_registro ? _fmtFechaHora(p.fecha_registro) : fmtFecha(p.fecha)}</div></div></div>
      <div class="pc-cell">${_PI.sync}<div><div class="pc-lbl">Última actualización</div><div class="pc-val">${actualizado ? _fmtFechaConDia(p.fecha_actualizacion) : '—'}</div></div></div>`}
      <div class="pc-cell">${_PI.tag}<div><div class="pc-lbl">Venta</div><div class="pc-val strong">${cv ? fmt(cv.totalVenta) : '—'}</div></div></div>
      <div class="pc-cell" style="color:${ganColor};">${gan != null && gan < 0 ? _PI.down : _PI.trend}<div><div class="pc-lbl">${gan != null && gan < 0 ? 'Pérdida' : 'Ganancia'}</div><div class="pc-val strong" style="color:${ganColor};">${gan != null ? fmt(gan) : '—'}</div></div></div>
    </div></div></div>
    <div class="pc-box" style="background:rgba(100,116,139,.08);">
      <div class="pc-box-ico" style="background:#6b7280;font-weight:800;font-size:15px;">!</div>
      <div style="min-width:0;"><div class="pc-box-t" style="color:#111827;">Problema</div><div class="pc-box-d">${esc(p.descripcion)}</div></div>
    </div>
    <div class="pc-box" style="background:${p.solucion ? '#ecfdf5' : 'var(--bg)'};">
      <div class="pc-box-ico" style="background:${p.solucion ? '#059669' : '#9ca3af'};">${_PI.ok}</div>
      <div style="min-width:0;"><div class="pc-box-t" style="color:${p.solucion ? '#047857' : 'var(--text3)'};">Solución</div>
        <div class="pc-box-d" style="${p.solucion ? '' : 'color:var(--text3);font-style:italic;'}">${p.solucion ? esc(p.solucion) : 'Sin solución planteada'}</div>
        ${p.valor_perdida > 0 ? `<div style="font-size:11px;font-weight:700;color:#b91c1c;margin-top:4px;">Pérdida registrada: ${fmt(p.valor_perdida)}</div>` : ''}
        ${p.fecha_resolucion ? `<div style="font-size:10.5px;color:var(--text3);margin-top:4px;">Resuelta el ${p.fecha_resolucion}</div>` : ''}
      </div>
    </div>
    <div class="pc-foot">
      <button class="btn btn-ghost" onclick="openModalProblema(null,'${p.id}')">${_PI.pencil} Editar</button>
      <div style="flex:1;"></div>
      ${p.estado === 'abierto' ? `<button class="btn btn-success" onclick="openResolverProblema('${p.id}','resuelto')">${_PI.ok} Resolver</button>` : ''}
    </div>
  </div>`;
}

// Detalles de la tarjeta (venta, tienda, fechas, ganancia): plegados por defecto.
// Se recuerda cuáles abrió el usuario para que sigan abiertos al refiltrar.
const _probAbiertas = new Set();
function _probToggle(btn, id) {
  const card = btn.closest('.pc');
  const open = !card.classList.contains('open');
  card.classList.toggle('open', open);
  btn.title = open ? 'Ocultar detalles' : 'Ver detalles';
  open ? _probAbiertas.add(id) : _probAbiertas.delete(id);
}

// Menú de los 3 puntos de la tarjeta
function _probMenu(btn, id) {
  document.querySelectorAll('.pc-menu').forEach(m => m.remove());
  const m = document.createElement('div');
  m.className = 'pc-menu';
  m.innerHTML = `
    <button onclick="verHistorialProblema('${id}')">${_PI.sync.replace('class="pc-ico"','width="15" height="15"')} Ver historial de cambios</button>
    <button class="danger" onclick="deleteProb('${id}')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg> Eliminar</button>`;
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect();
  m.style.top  = (r.bottom + 4) + 'px';
  m.style.left = Math.max(8, r.right - m.offsetWidth) + 'px';
  const cerrar = () => { m.remove(); document.removeEventListener('click', cerrar, true); };
  setTimeout(() => document.addEventListener('click', cerrar, true), 0);
}

// ══════════════════════════════════════════════════════════
// HISTORIAL DE CAMBIOS
// ══════════════════════════════════════════════════════════
const _HIST_CAMPOS = {
  estado: 'Estado', tipo: 'Tipo', descripcion: 'Qué sucedió', solucion: 'Solución',
  fecha: 'Fecha del problema', valor_perdida: 'Pérdida', id_ml_venta: 'Venta',
};
function _histValor(campo, v) {
  if (v == null || v === '') return '—';
  if (campo === 'estado') return (_PROB_ESTADO_CFG[v]?.label || v);
  if (campo === 'tipo') return TIPO_LABELS[v] || v;
  if (campo === 'valor_perdida') return v ? fmt(v) : '—';
  return String(v);
}
// Devuelve el historial de `nuevo` agregando la entrada de este guardado
function _probHistorialCon(antes, nuevo, accion) {
  const hist = Array.isArray(antes?.historial) ? antes.historial.slice() : [];
  const usuario = (typeof _currentUser !== 'undefined' && _currentUser?.usuario) || '';
  const ahora = new Date().toISOString();
  if (!antes) {
    hist.push({ fecha: ahora, accion: 'creado', usuario, cambios: [] });
    return hist;
  }
  const cambios = Object.keys(_HIST_CAMPOS)
    .filter(k => String(antes[k] ?? '') !== String(nuevo[k] ?? '') && !(k === 'valor_perdida' && !antes[k] && !nuevo[k]))
    .map(k => ({ campo: k, antes: antes[k] ?? '', despues: nuevo[k] ?? '' }));
  if (!cambios.length) return hist;
  if (!accion) accion = (antes.estado === 'abierto' && nuevo.estado !== 'abierto') ? nuevo.estado
                      : (antes.estado !== 'abierto' && nuevo.estado === 'abierto') ? 'reabierto' : 'editado';
  hist.push({ fecha: ahora, accion, usuario, cambios });
  return hist;
}

async function verHistorialProblema(id) {
  document.querySelectorAll('.pc-menu').forEach(m => m.remove());
  const p = (await DB.problemas()).find(x => x.id === id);
  if (!p) return;
  const ACC = {
    creado:    { t:'Problema registrado', c:'#3b82f6' },
    editado:   { t:'Problema editado',    c:'#64748b' },
    resuelto:  { t:'Marcado como resuelto', c:'#10b981' },
    perdida:   { t:'Resuelto con pérdida', c:'#ef4444' },
    reabierto: { t:'Problema reabierto',  c:'#f59e0b' },
  };
  let hist = Array.isArray(p.historial) ? p.historial.slice() : [];
  // Problemas creados antes del historial: reconstruir lo que se sabe
  if (!hist.some(h => h.accion === 'creado') && p.fecha_registro)
    hist.unshift({ fecha: p.fecha_registro, accion: 'creado', cambios: [] });
  if (!p.historial?.length && p.fecha_actualizacion && p.fecha_actualizacion !== p.fecha_registro)
    hist.push({ fecha: p.fecha_actualizacion, accion: 'editado', cambios: [], sinDetalle: true });
  hist.sort((a,b) => (b.fecha||'').localeCompare(a.fecha||''));

  const esc = s => _esc2(s == null ? '' : s);
  document.getElementById('mhp-sub').textContent =
    `${TIPO_LABELS[p.tipo] || p.tipo_label || p.tipo || ''}${p.id_ml_venta ? ' · Venta ' + p.id_ml_venta : ''}`;
  document.getElementById('mhp-body').innerHTML = hist.length ? hist.map(h => {
    const a = ACC[h.accion] || { t: h.accion, c:'#64748b' };
    const det = h.sinDetalle
      ? '<div class="hp-diff" style="font-style:italic;">Cambio anterior al historial: no hay detalle.</div>'
      : (h.cambios || []).map(c => `<div class="hp-diff"><strong>${_HIST_CAMPOS[c.campo] || c.campo}:</strong> <s>${esc(_histValor(c.campo, c.antes))}</s> → ${esc(_histValor(c.campo, c.despues))}</div>`).join('');
    return `<div class="hp-item"><span class="hp-dot" style="background:${a.c};"></span>
      <div class="hp-when">${_fmtFechaHora(h.fecha)}${h.usuario ? ' · ' + esc(h.usuario) : ''}</div>
      <div class="hp-what">${a.t}</div>${det}</div>`;
  }).join('') : '<div class="c-dim" style="font-size:12px;">Sin cambios registrados.</div>';
  openModal('modal-historial-problema');
}

async function resolverProblema(id, estado) {
  await openResolverProblema(id, estado);
}

async function openResolverProblema(id, estado) {
  closeModal('modal-problema'); // puede venir de la pestaña "Problemas anteriores"
  const probs = await DB.problemas();
  const p = probs.find(x => x.id === id);
  if (!p) return;

  document.getElementById('mrp-prob-id').value     = id;
  document.getElementById('mrp-estado-nuevo').value = estado;
  document.getElementById('mrp-solucion').value     = p.solucion || '';
  document.getElementById('mrp-perdida').value      = p.valor_perdida || '';
  document.getElementById('mrp-solucion-error').style.display = 'none';
  document.getElementById('mrp-solucion').style.borderColor = 'var(--border)';

  const esPerdida = estado === 'perdida';
  document.getElementById('mrp-title').textContent = esPerdida ? 'Registrar como Pérdida' : 'Resolver Problema';
  document.getElementById('mrp-perdida-group').style.display = esPerdida ? '' : 'none';

  const tiendas = await DB.tiendas();
  const t = tiendas.find(x => x.id === p.tienda_id);
  document.getElementById('mrp-info').innerHTML =
    `<strong>${p.tipo_label||p.tipo}</strong> — ${p.descripcion}` +
    (t ? `<span style="color:var(--text3);margin-left:8px;">· ${t.nombre}</span>` : '') +
    (p.id_ml_venta ? `<div style="margin-top:4px;font-family:monospace;font-size:11px;color:var(--teal);">Venta: ${p.id_ml_venta}</div>` : '');

  const previewEl = document.getElementById('mrp-estado-preview');
  if (esPerdida) {
    previewEl.innerHTML = 'El problema quedará marcado como <strong style="color:var(--red);margin-left:4px;">Pérdida registrada</strong>';
    previewEl.style.background = 'var(--red-bg)';
    previewEl.style.color = 'var(--red)';
    document.getElementById('mrp-confirmar-btn').style.background = 'var(--red)';
    document.getElementById('mrp-confirmar-btn').textContent = 'Registrar Pérdida';
  } else {
    previewEl.innerHTML = 'El problema quedará marcado como <strong style="color:var(--green);margin-left:4px;">Resuelto</strong>';
    previewEl.style.background = 'var(--green-bg)';
    previewEl.style.color = 'var(--green)';
    document.getElementById('mrp-confirmar-btn').style.background = 'var(--teal)';
    document.getElementById('mrp-confirmar-btn').textContent = 'Confirmar Resolución';
  }

  openModal('modal-resolver-problema');
  setTimeout(() => document.getElementById('mrp-solucion')?.focus(), 120);
}

async function confirmarResolver() {
  const id       = document.getElementById('mrp-prob-id').value;
  const estado   = document.getElementById('mrp-estado-nuevo').value;
  const solucion = document.getElementById('mrp-solucion').value.trim();
  const perdida  = parseFloat(document.getElementById('mrp-perdida').value) || 0;
  const errEl    = document.getElementById('mrp-solucion-error');
  const inputEl  = document.getElementById('mrp-solucion');

  if (!solucion) {
    errEl.style.display = '';
    inputEl.style.borderColor = 'var(--red)';
    inputEl.focus();
    return;
  }
  if (estado === 'perdida' && perdida <= 0) {
    const perdidaInput = document.getElementById('mrp-perdida');
    perdidaInput.style.borderColor = 'var(--red)';
    perdidaInput.focus();
    setTimeout(() => perdidaInput.style.borderColor = '', 2000);
    alert('Ingresa el valor de la pérdida en COP.');
    return;
  }

  const probs = await DB.problemas();
  const p = probs.find(x => x.id === id);
  if (!p) return;

  const antes = { ...p };
  p.estado   = estado;
  p.solucion = solucion;
  p.fecha_resolucion = hoy(); // fecha LOCAL — ver nota junto a mes() en core.js
  p.fecha_actualizacion = new Date().toISOString();
  if (estado === 'perdida') p.valor_perdida = perdida;
  p.historial = _probHistorialCon(antes, p, estado);

  await DB.saveProblemas(probs);
  closeModal('modal-resolver-problema');
  showConfirmAnim('resuelto', false);
  await renderProblemas();
  await updateAlertaBadge();
  try { await _actualizarBotonesProblema(); } catch(e) {}
}

var _deleteProbId = null;

function deleteProb(id) {
  closeModal('modal-problema');
  _deleteProbId = id;
  const inp = document.getElementById('del-prob-code-input');
  const err = document.getElementById('del-prob-code-error');
  if (inp) inp.value = '';
  if (err) err.textContent = '';
  openModal('modal-delete-problema');
  setTimeout(() => inp && inp.focus(), 150);
}

async function _confirmDeleteProb() {
  const inp    = document.getElementById('del-prob-code-input');
  const err    = document.getElementById('del-prob-code-error');
  const btn    = document.getElementById('del-prob-confirm-btn');
  const codigo = inp ? inp.value.trim() : '';

  if (!codigo) {
    if (err) err.textContent = 'Ingresa el código de acceso.';
    if (inp) { inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 400); }
    return;
  }

  if (btn) { btn.textContent = 'Verificando...'; btn.disabled = true; }
  if (err) err.textContent = '';

  try {
    const ok = await _verificarCodigoAcceso(codigo);
    if (!ok) {
      if (err) err.textContent = 'Código incorrecto. Intenta de nuevo.';
      if (inp) { inp.value = ''; inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 400); inp.focus(); }
      return;
    }
    closeModal('modal-delete-problema');
    await DB.deleteProblema(_deleteProbId);
    _deleteProbId = null;
    await renderProblemas();
    await updateAlertaBadge();
    try { await _actualizarBotonesProblema(); } catch(e) {}
    if (typeof showToast === 'function') showToast('Problema eliminado', 'success');
  } catch(e) {
    if (err) err.textContent = 'Error al verificar. Intenta de nuevo.';
    console.error(e);
  } finally {
    if (btn) { btn.textContent = 'Eliminar'; btn.disabled = false; }
  }
}

// ── HELPERS DOM ──
const gv = id => { const el = document.getElementById(id); return el ? el.value : ''; };
const sv = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
const st = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { const el = document.getElementById(id); if(el){el.classList.remove('close');el.classList.remove('open');} }

// ── COPIAR ID DE VENTA AL PORTAPAPELES ──
function copiarIdVenta(id, el) {
  // Seleccionar la fila al copiar
  const tr = el.closest('tr');
  if (tr && typeof _selectRow === 'function') _selectRow(tr);

  const _apply = () => {
    // Quitar copied de cualquier otro badge
    document.querySelectorAll('.venta-id.copied').forEach(b => { if(b!==el) b.classList.remove('copied'); });
    el.classList.add('copied');

    // Tooltip "Copiado": va en <body> con posición fija para que no lo recorte
    // un contenedor con overflow (p. ej. los detalles plegables de las tarjetas).
    let tip = document.getElementById('copiado-tip');
    if (!tip) {
      tip = document.createElement('span');
      tip.id = 'copiado-tip';
      tip.textContent = 'Copiado';
      tip.style.cssText = 'position:fixed;transform:translateX(-50%);background:#00897b;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap;pointer-events:none;z-index:9999;animation:toastIn .2s ease;';
      document.body.appendChild(tip);
    }
    const r = el.getBoundingClientRect();
    tip.style.left = (r.left + r.width / 2) + 'px';
    tip.style.top  = (r.top - 24) + 'px';
    tip.style.display = 'block';
    clearTimeout(tip._timer);
    tip._timer = setTimeout(() => { tip.style.display = 'none'; }, 1500);
  };

  navigator.clipboard.writeText(id).then(_apply).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = id; ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta); _apply();
  });
}

// Actualiza el color del ícono de problema en la tabla de ventas sin re-render
async function _actualizarBotonesProblema() {
  const problemas = await DB.problemas();
  // Build a map: venta_id → problema
  // venta_id → lista de problemas (una venta puede tener varios)
  const mapaProb = {};
  problemas.forEach(p => {
    if (p.venta_id) (mapaProb[p.venta_id] = mapaProb[p.venta_id] || []).push(p);
  });

  document.querySelectorAll('button.btn-prob[data-venta-id]').forEach(btn => {
    const vid  = btn.dataset.ventaId;
    const lista = mapaProb[vid];
    if (!lista) {
      btn.style.background = ''; btn.style.borderColor = '';
      const im = btn.querySelector('img'); if (im) im.style.filter = '';
      btn.title = 'Registrar problema';
      return;
    }
    btn.setAttribute('onclick', `openModalProblema('${vid}')`);
    const solved = !lista.some(p => p.estado === 'abierto');
    btn.style.background  = solved ? '#d1f0e0' : '#fee2e2';
    btn.style.borderColor = solved ? '#6cc490' : '#fca5a5';
    const img = btn.querySelector('img');
    if (img) img.style.filter = solved
      ? 'sepia(1) saturate(4) hue-rotate(80deg)'
      : 'sepia(1) saturate(5) hue-rotate(-30deg)';
    btn.title = solved ? `${lista.length} problema(s) resuelto(s) ✓ — registrar otro` : 'Ver problema activo';
  });
}

async function updateAlertaBadge() {
  const el = document.getElementById('alertas-count');
  if (el) el.textContent = (await getAlertas()).length;
  try { await updatePendientesCount(); } catch(e) {}
}

async function populateSelects() {
  const tiendas = await DB.tiendas();
  const opts = tiendas.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
  const blank = '<option value="">Todas</option>';
  ['vf-tienda','pf-tienda','ef-tienda'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = blank + opts;
  });
  await _syncCatsFromFirestore();
}

// ══════════════════════════════════════════════════════════
