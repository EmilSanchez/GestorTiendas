// ── Overlay spinner ──
function _tareaSpinner(show) {
  let ov = document.getElementById('tareas-overlay-spinner');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'tareas-overlay-spinner';
    ov.innerHTML = '<div class="tareas-overlay-dots"><span></span><span></span><span></span></div>';
    document.body.appendChild(ov);
  }
  ov.classList.toggle('active', show);
}

// ══════════════════════════════════════════════════════════
// MÓDULO: TAREAS
// ══════════════════════════════════════════════════════════

const _DIAS_SEMANA = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const _DIAS_SHORT  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const _MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
var _tareasCache = null;

function _diaHoy() { return new Date().getDay(); }
function _fechaHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function _fechaSumar(fecha, dias) {
  const d = new Date(fecha + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function _fmtCreado(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2,'0');
  const ampm = h >= 12 ? 'p.m.' : 'a.m.';
  h = h % 12; if (h === 0) h = 12;
  return `${d.getDate()} ${_MESES_SHORT[d.getMonth()]} ${d.getFullYear()} · ${h}:${m} ${ampm}`;
}
function _esc3(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Firebase ──
async function _getTareas() {
  if (_tareasCache) return _tareasCache;
  const snap = await _col('tareas').get();
  _tareasCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return _tareasCache;
}
async function _saveTarea(t) {
  await _col('tareas').doc(t.id).set(JSON.parse(JSON.stringify(t)));
  _tareasCache = null;
}
async function _deleteTareaDB(id) {
  await _col('tareas').doc(id).delete();
  _tareasCache = null;
}

// ══════════════════════════════════════════════════════════
// CATEGORÍAS DE TAREA — editables, guardadas en localStorage
// ══════════════════════════════════════════════════════════
const _TCATS_KEY = 'mm_tareas_cats_v1';
const _TCATS_DEFAULT = [
  { id:'producto_danado', label:'Producto dañado' },
  { id:'cliente',         label:'Cliente'          },
  { id:'seguimiento',     label:'Seguimiento'      },
  { id:'preventa',        label:'Preventa'         },
  { id:'postventa',       label:'Postventa'        },
  { id:'general',         label:'General'          },
];
const _TCAT_PALETTE = [
  { bg:'#e3f2fd', color:'#1565c0', border:'#90caf9' },
  { bg:'#e0f2f1', color:'#00695c', border:'#80cbc4' },
  { bg:'#ede7f6', color:'#5e35b1', border:'#c5b3e6' },
  { bg:'#fff8e1', color:'#8a6d00', border:'#ffe082' },
  { bg:'#fce4ec', color:'#ad1457', border:'#f8bbd0' },
  { bg:'#fff3e0', color:'#b45309', border:'#ffcc80' },
  { bg:'#e8f5e9', color:'#2e7d32', border:'#a5d6a7' },
  { bg:'#fde8ea', color:'#b0202e', border:'#f5b5bb' },
];

function _getTareaCats() {
  try {
    const raw = localStorage.getItem(_TCATS_KEY);
    if (raw) return JSON.parse(raw);
    localStorage.setItem(_TCATS_KEY, JSON.stringify(_TCATS_DEFAULT));
    return [..._TCATS_DEFAULT];
  } catch { return [..._TCATS_DEFAULT]; }
}
function _saveTareaCats(cats) { localStorage.setItem(_TCATS_KEY, JSON.stringify(cats)); }

function _catColorFor(id, cats) {
  const idx = Math.max(0, cats.findIndex(c => c.id === id));
  return _TCAT_PALETTE[idx % _TCAT_PALETTE.length];
}
function _catLabelFor(id, cats) {
  if (!id) return '';
  const c = cats.find(x => x.id === id);
  return c ? c.label : '';
}
function _catBadge(id, cats) {
  if (!id) return `<span style="font-size:11px;color:var(--text3);">—</span>`;
  const label = _catLabelFor(id, cats);
  if (!label) return `<span style="font-size:11px;color:var(--text3);">—</span>`;
  const p = _catColorFor(id, cats);
  return `<span style="display:inline-block;font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:20px;background:${p.bg};color:${p.color};border:1px solid ${p.border};white-space:nowrap;">${_esc3(label)}</span>`;
}

// ── MODAL GESTIONAR CATEGORÍAS DE TAREA ──
function openModalCategoriasTareas() {
  _renderTareaCatList();
  document.getElementById('modal-categorias-tareas')?.classList.add('open');
}
function _renderTareaCatList() {
  const cats = _getTareaCats();
  const list = document.getElementById('cat-tareas-list');
  if (!list) return;
  list.innerHTML = cats.map((c, i) => {
    const p = _TCAT_PALETTE[i % _TCAT_PALETTE.length];
    return `
    <div class="cat-row" id="cat-tareas-row-${i}" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--white);border:1px solid var(--border);border-radius:8px;">
      <span style="width:11px;height:11px;border-radius:50%;background:${p.color};flex-shrink:0;border:1px solid ${p.border};"></span>
      <input type="text" value="${_esc3(c.label)}" id="tarea-cat-label-${i}"
        style="flex:1;font-size:0.85rem;border:1px solid var(--border);border-radius:6px;padding:5px 9px;"
        onkeydown="if(event.key==='Enter')guardarTareaCat(${i})">
      <button onclick="guardarTareaCat(${i})" title="Guardar" class="btn btn-ghost btn-icon btn-sm" style="color:var(--teal);">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
      ${cats.length > 1 ? `<button onclick="_eliminarTareaCat(${i})" title="Eliminar" class="btn btn-ghost btn-icon btn-sm" style="color:var(--red);">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>` : ''}
    </div>`;
  }).join('');
}
function guardarTareaCat(i) {
  const cats = _getTareaCats();
  const input = document.getElementById(`tarea-cat-label-${i}`);
  if (!input) return;
  const newLabel = input.value.trim();
  if (!newLabel) { input.style.borderColor = 'var(--red)'; return; }
  cats[i].label = newLabel;
  _saveTareaCats(cats);
  _renderTareaCatList();
  renderTareas();
  showToast('Categoría actualizada', 'success', 1800);
}
function _eliminarTareaCat(i) {
  const cats = _getTareaCats();
  if (cats.length <= 1) return;
  cats.splice(i, 1);
  _saveTareaCats(cats);
  _renderTareaCatList();
  renderTareas();
  showToast('Categoría eliminada', 'info', 1800);
}
function agregarTareaCat() {
  const input = document.getElementById('cat-tareas-nueva-label');
  if (!input) return;
  const label = input.value.trim();
  if (!label) { input.style.borderColor = 'var(--red)'; return; }
  const id = label.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_áéíóúñ]/g,'')
    .replace(/[áéíóúñ]/g, c => ({á:'a',é:'e',í:'i',ó:'o',ú:'u',ñ:'n'}[c]||c));
  const cats = _getTareaCats();
  if (cats.find(c => c.id === id)) { showToast('Ya existe una categoría con ese nombre', 'error', 2000); return; }
  cats.push({ id, label });
  _saveTareaCats(cats);
  input.value = '';
  _renderTareaCatList();
  renderTareas();
  showToast('Categoría agregada', 'success', 1800);
}

// ══════════════════════════════════════════════════════════
// FILTROS (estado en memoria de módulo, no se resetea entre renders)
// ══════════════════════════════════════════════════════════
var _tareasFiltro = { search:'', estado:'todos', categoria:'', tienda:'', orden:'recientes' };
var _tareasEstadoActual = null; // { pendientes, completadas, fecha, cats, tiendasMap }

// ── Semana actual (para el stat "Tareas esta semana") ──
function _tareasContarSemana(tareas, hoyDia, fechaHoy) {
  const inicioSemana = _fechaSumar(fechaHoy, -hoyDia);
  const finSemana    = _fechaSumar(fechaHoy, 6 - hoyDia);
  let count = 0;
  tareas.forEach(t => {
    if (t.tipo === 'recurrente' && Array.isArray(t.dias)) {
      count += t.dias.length;
    } else if (t.tipo === 'puntual' && t.fecha >= inicioSemana && t.fecha <= finSemana) {
      count += 1;
    }
  });
  return count;
}

// ══ RENDER PRINCIPAL ══
async function renderTareas() {
  const tareas  = await _getTareas();
  const hoy     = _diaHoy();
  const fecha   = _fechaHoy();
  const nombreDia = _DIAS_SEMANA[hoy];
  const cats    = _getTareaCats();

  let tiendas = [];
  try { tiendas = await DB.tiendas(); } catch { tiendas = []; }
  const tiendasMap = {};
  tiendas.forEach(t => { tiendasMap[t.id] = t.nombre; });

  // Tareas de hoy
  const recurrentes = tareas.filter(t => t.tipo === 'recurrente' && Array.isArray(t.dias) && t.dias.includes(hoy));
  const puntuales   = tareas.filter(t => t.tipo === 'puntual' && t.fecha === fecha);
  const hoyTareas   = [...recurrentes, ...puntuales];

  const pendientes  = hoyTareas.filter(t => !(t.completadas || {})[fecha]);
  const completadas = hoyTareas.filter(t =>  (t.completadas || {})[fecha])
    .sort((a,b) => ((b.completadas||{})[fecha+'_ts']||0) - ((a.completadas||{})[fecha+'_ts']||0));

  // Tareas no cumplidas (puntuales de días anteriores no completadas)
  const noCumplidas = tareas.filter(t => {
    if (t.tipo !== 'puntual') return false;
    if (t.fecha >= fecha) return false;
    if ((t.completadas || {})[t.fecha]) return false;
    return true;
  }).sort((a,b) => b.fecha.localeCompare(a.fecha));

  const el = document.getElementById('tareas-container');
  if (!el) return;

  const totalHoy   = hoyTareas.length;
  const doneCount  = completadas.length;
  const pendCount  = pendientes.length;
  const semanaCount = _tareasContarSemana(tareas, hoy, fecha);

  // Guardar estado para los filtros (evita re-render completo al escribir en el buscador)
  _tareasEstadoActual = { pendientes, completadas, fecha, cats, tiendasMap, noCumplidas };

  // Opciones de categoría / tienda para los selects de filtro
  const optsCatFiltro    = cats.map(c => `<option value="${c.id}">${_esc3(c.label)}</option>`).join('');
  const optsTiendaFiltro = tiendas.map(t => `<option value="${t.id}">${_esc3(t.nombre)}</option>`).join('');

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--text3);">
          ${nombreDia} · ${fmtFecha(fecha)}
        </div>
        <div style="font-size:18px;font-weight:700;color:var(--text);margin-top:3px;">
          Tareas de hoy
          ${totalHoy > 0 ? `<span class="tarea-counter" id="tareas-badge-completadas">${doneCount}/${totalHoy} completadas</span>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        ${noCumplidas.length ? `<span style="font-size:11px;font-weight:700;background:var(--red-bg);color:var(--red);padding:4px 10px;border-radius:20px;border:1px solid #fca5a5;">${noCumplidas.length} no cumplida${noCumplidas.length>1?'s':''}</span>` : ''}
        <button class="btn btn-ghost btn-icon btn-sm" onclick="renderTareas()" title="Actualizar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </button>
        <button class="btn btn-ghost btn-sm" onclick="openModalCategoriasTareas()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41L11 3.83V3H10.17L1 12.17V19a2 2 0 0 0 2 2h6.83l9.17-9.17a2 2 0 0 0 0-2.42z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          Categorías
        </button>
        <button class="btn btn-primary btn-sm" onclick="openModalTarea()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva tarea
        </button>
      </div>
    </div>

    <!-- STAT CARDS -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px;">
      <div class="stat-card teal">
        <div class="stat-label">Total de hoy</div>
        <div class="stat-value teal" style="font-size:1.6rem;font-weight:800;">${totalHoy}</div>
        <div class="stat-delta">${doneCount}/${totalHoy||0} completadas</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-label">Pendientes de hoy</div>
        <div class="stat-value" style="font-size:1.6rem;font-weight:800;color:var(--yellow);">${pendCount}</div>
        <div class="stat-delta">por completar</div>
      </div>
      <div class="stat-card green">
        <div class="stat-label">Completadas hoy</div>
        <div class="stat-value" style="font-size:1.6rem;font-weight:800;color:#198754;">${doneCount}</div>
        <div class="stat-delta">hoy</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-label">Tareas esta semana</div>
        <div class="stat-value" style="font-size:1.6rem;font-weight:800;color:#c0620a;">${semanaCount}</div>
        <div class="stat-delta">incluyendo hoy</div>
      </div>
    </div>

    <!-- FILTROS -->
    <div class="filters-bar">
      <input type="text" id="tf-search" placeholder="Buscar por nombre o descripción..." style="flex:1;min-width:180px;" value="${_esc3(_tareasFiltro.search)}" oninput="_tareasSetFiltro('search',this.value)">
      <span class="fl" style="font-size:11px;color:var(--text3);">Estado</span>
      <select id="tf-estado" onchange="_tareasSetFiltro('estado',this.value)">
        <option value="abierto"    ${_tareasFiltro.estado==='abierto'?'selected':''}>Abierto</option>
        <option value="completada" ${_tareasFiltro.estado==='completada'?'selected':''}>Completada</option>
        <option value="todos"      ${_tareasFiltro.estado==='todos'?'selected':''}>Todas</option>
      </select>
      <span class="fl" style="font-size:11px;color:var(--text3);">Categoría</span>
      <select id="tf-categoria" onchange="_tareasSetFiltro('categoria',this.value)">
        <option value="">Todas</option>
        ${optsCatFiltro.replace(`value="${_tareasFiltro.categoria}"`, `value="${_tareasFiltro.categoria}" selected`)}
      </select>
      <span class="fl" style="font-size:11px;color:var(--text3);">Tienda</span>
      <select id="tf-tienda" onchange="_tareasSetFiltro('tienda',this.value)">
        <option value="">Todas</option>
        ${optsTiendaFiltro.replace(`value="${_tareasFiltro.tienda}"`, `value="${_tareasFiltro.tienda}" selected`)}
      </select>
    </div>

    <!-- LAYOUT PRINCIPAL: lista + aside -->
    <div id="tareas-main-grid" style="display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:stretch;">

      <div class="card" style="padding:0;overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);">
          <div style="font-size:14px;font-weight:700;color:var(--text);" id="tareas-lista-titulo">Pendientes de hoy</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:11px;color:var(--text3);">Ordenar por:</span>
            <select id="tf-orden" onchange="_tareasSetFiltro('orden',this.value)" style="font-size:12px;padding:4px 8px;">
              <option value="recientes" ${_tareasFiltro.orden==='recientes'?'selected':''}>Más recientes</option>
              <option value="nombre"    ${_tareasFiltro.orden==='nombre'?'selected':''}>Nombre A-Z</option>
            </select>
            <button class="btn btn-ghost btn-icon btn-sm" onclick="_abrirModalPendientes()" title="Ver todas en un modal">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
            </button>
          </div>
        </div>

        <div style="padding:14px 16px;max-height:440px;overflow-y:auto;">
          <div id="tareas-lista-hoy" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:stretch;"></div>
        </div>

        <div style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);">
          <button class="btn btn-ghost btn-sm" onclick="openModalTarea()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Añadir tarea pendiente
          </button>
          <span style="font-size:11px;color:var(--text3);" id="tareas-count-info"></span>
        </div>
      </div>

      <div id="tareas-aside" style="display:flex;flex-direction:column;gap:14px;height:100%;">
        ${_renderNoCumplidasCard(noCumplidas)}
        ${_renderHistorialCard(tareas, fecha)}
      </div>
    </div>

    ${_renderProximas(tareas, hoy, fecha)}
  `;

  _tareasAplicarFiltros();
}

// ── Aplica filtros/orden sobre la lista de "hoy" sin re-renderizar toda la página ──
function _tareasFiltradas() {
  const st = _tareasEstadoActual;
  if (!st) return { base: [], filtradas: [], titulo: '' };

  const f = _tareasFiltro;
  let base, titulo;
  if (f.estado === 'completada') { base = st.completadas.slice(); titulo = 'Completadas de hoy'; }
  else if (f.estado === 'todos') { base = [...st.pendientes, ...st.completadas]; titulo = 'Tareas de hoy'; }
  else { base = st.pendientes.slice(); titulo = 'Pendientes de hoy'; }

  const search = f.search.trim().toLowerCase();
  let filtradas = base.filter(t => {
    if (search && !(`${t.nombre||''} ${t.descripcion||''}`.toLowerCase().includes(search))) return false;
    if (f.categoria && t.categoria_id !== f.categoria) return false;
    if (f.tienda && t.tienda_id !== f.tienda) return false;
    return true;
  });

  if (f.orden === 'nombre') {
    filtradas.sort((a,b) => (a.nombre||'').localeCompare(b.nombre||''));
  } else {
    filtradas.sort((a,b) => new Date(b.creado||0) - new Date(a.creado||0));
  }

  return { base, filtradas, titulo };
}

function _tareasAplicarFiltros() {
  const st = _tareasEstadoActual;
  if (!st) return;
  const tbody = document.getElementById('tareas-lista-hoy');
  if (!tbody) return;

  const { base, filtradas, titulo } = _tareasFiltradas();

  const tituloEl = document.getElementById('tareas-lista-titulo');
  if (tituloEl) tituloEl.textContent = titulo;

  tbody.innerHTML = filtradas.length
    ? filtradas.map(t => _renderTareaRow(t, st.fecha, st.cats, st.tiendasMap)).join('')
    : `<div style="grid-column:1/-1;text-align:center;padding:32px 16px;color:var(--text3);">
         <div style="font-size:13px;font-weight:600;margin-bottom:4px;">Sin tareas para este filtro</div>
         <div style="font-size:11px;">Ajusta los filtros o crea una nueva tarea.</div>
       </div>`;

  const countInfo = document.getElementById('tareas-count-info');
  if (countInfo) countInfo.textContent = `Mostrando ${filtradas.length} de ${base.length} tarea${base.length===1?'':'s'}`;
}

// ── Modal: ver todas las tareas de la lista principal (respeta filtros actuales) ──
function _abrirModalPendientes() {
  const st = _tareasEstadoActual;
  if (!st) return;
  const { filtradas, titulo } = _tareasFiltradas();

  const titleEl = document.getElementById('modal-pendientes-title');
  if (titleEl) titleEl.textContent = titulo;
  const countEl = document.getElementById('modal-pendientes-count');
  if (countEl) countEl.textContent = `${filtradas.length} tarea${filtradas.length===1?'':'s'}`;

  const list = document.getElementById('modal-pendientes-list');
  if (list) {
    list.innerHTML = filtradas.length
      ? filtradas.map(t => _renderTareaRow(t, st.fecha, st.cats, st.tiendasMap)).join('')
      : `<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--text3);font-size:12px;">Sin tareas para este filtro.</div>`;
  }
  openModal('modal-tareas-pendientes');
}

function _tareasSetFiltro(campo, valor) {
  _tareasFiltro[campo] = valor;
  _tareasAplicarFiltros();
}

function _renderTareaRow(t, fecha, cats, tiendasMap) {
  const done = !!(t.completadas || {})[fecha];
  const esPuntual = t.tipo === 'puntual';
  const tiendaNombre = t.tienda_id ? (tiendasMap[t.tienda_id] || '—') : '—';
  return `
    <div class="tarea-item-card ${done ? 'tarea-done' : ''}" id="tarea-row-${t.id}" style="height:100%;box-sizing:border-box;align-items:flex-start;">
      <button class="tarea-checkbox ${done ? 'checked' : ''}"
        onclick="_toggleTarea('${t.id}','${fecha}')"
        title="${done ? 'Marcar pendiente' : 'Marcar completada'}" style="margin-top:1px;">
        <svg class="tarea-check-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
      <div style="flex:1;min-width:0;">
        <div class="tarea-nombre ${done ? 'tarea-nombre-done' : ''}">${_esc3(t.nombre)}</div>
        ${t.descripcion ? `<div style="font-size:11px;color:var(--text3);margin-top:2px;">${_esc3(t.descripcion)}</div>` : ''}
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px;">
          ${_catBadge(t.categoria_id, cats)}
          ${tiendaNombre !== '—' ? `<span style="font-size:10.5px;color:var(--text2);">${_esc3(tiendaNombre)}</span>` : ''}
          ${esPuntual
            ? `<span style="font-size:10px;background:#e0f2f1;color:var(--teal);padding:1px 8px;border-radius:20px;font-weight:600;border:1px solid #b2dfdb;">Solo hoy</span>`
            : `<span style="font-size:10px;color:var(--text3);">${(t.dias||[]).map(d=>_DIAS_SHORT[d]).join(' · ')}</span>`
          }
        </div>
        <div style="font-size:10px;color:var(--text3);margin-top:5px;">${_fmtCreado(t.creado)}</div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0;">
        <button class="btn btn-ghost btn-icon btn-sm" onclick="openModalTarea('${t.id}')" title="Editar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="_confirmarDeleteTarea('${t.id}')" title="Eliminar" style="color:var(--red);">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </div>
    </div>`;
}

// ── Sección: No cumplidas (tarjeta lateral) ──
function _noCumplidaFila(t) {
  return `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
      <div style="width:22px;height:22px;border-radius:6px;border:2px solid #fca5a5;background:var(--red-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12.5px;font-weight:700;color:var(--text);">${_esc3(t.nombre)}</div>
        <div style="font-size:10px;color:var(--red);margin-top:2px;font-weight:600;">Debía cumplirse el ${fmtFecha(t.fecha)}</div>
      </div>
      <div style="display:flex;gap:3px;flex-shrink:0;">
        <button class="btn btn-ghost btn-icon btn-sm" title="Marcar como cumplida" onclick="event.stopPropagation();_marcarNoCumplidaComoHecha('${t.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="event.stopPropagation();openModalTarea('${t.id}')" title="Editar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="event.stopPropagation();_confirmarDeleteTarea('${t.id}')" title="Eliminar" style="color:var(--red);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    </div>`;
}

function _renderNoCumplidasCard(noCumplidas) {
  if (!noCumplidas.length) {
    return `
      <div class="card" style="flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);">No cumplidas</div>
        </div>
        <div style="font-size:12px;color:var(--text3);padding:4px 0;">Sin pendientes atrasadas.</div>
      </div>`;
  }
  return `
    <div class="card" style="flex-shrink:0;max-height:230px;display:flex;flex-direction:column;cursor:pointer;" onclick="_abrirModalNoCumplidas()" title="Ver todas">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:8px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--red);">No cumplidas</div>
        </div>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:.6;flex-shrink:0;"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
      </div>
      <div style="overflow-y:auto;flex:1;min-height:0;">
        ${noCumplidas.map(t => _noCumplidaFila(t)).join('')}
      </div>
    </div>`;
}

// ── Modal: ver todas las "No cumplidas" ──
function _abrirModalNoCumplidas() {
  const noCumplidas = _tareasEstadoActual?.noCumplidas || [];
  const list = document.getElementById('modal-no-cumplidas-list');
  if (list) {
    list.innerHTML = noCumplidas.length
      ? noCumplidas.map(t => _noCumplidaFila(t)).join('')
      : `<div style="text-align:center;padding:24px;color:var(--text3);font-size:12px;">Sin pendientes atrasadas.</div>`;
  }
  const countEl = document.getElementById('modal-no-cumplidas-count');
  if (countEl) countEl.textContent = noCumplidas.length;
  openModal('modal-no-cumplidas');
}

// ── Sección: Historial (tarjeta lateral) ──
function _fmtHoraTs(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return '';
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2,'0');
  const ampm = h >= 12 ? 'p.m.' : 'a.m.';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

function _renderHistorialCard(tareas, fechaHoy) {
  const historial = [];
  tareas.forEach(t => {
    const comp = t.completadas || {};
    Object.keys(comp).forEach(fecha => {
      if (fecha <= fechaHoy && fecha.length === 10 && comp[fecha] === true) {
        historial.push({ tarea: t, fecha, ts: comp[fecha+'_ts'] || 0 });
      }
    });
  });
  if (!historial.length) {
    return `
      <div class="card" style="flex:1;min-height:0;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);">Historial reciente</div>
        </div>
        <div style="font-size:12px;color:var(--text3);padding:4px 0;">Aún no hay tareas completadas.</div>
      </div>`;
  }

  const porFecha = {};
  historial.forEach(h => {
    if (!porFecha[h.fecha]) porFecha[h.fecha] = [];
    porFecha[h.fecha].push(h);
  });
  // Más recientes primero dentro de cada día
  Object.keys(porFecha).forEach(f => porFecha[f].sort((a,b) => b.ts - a.ts));
  const todasFechas = Object.keys(porFecha).sort((a,b) => b.localeCompare(a));
  const selectedHist = window._historialFecha && porFecha[window._historialFecha] ? window._historialFecha : todasFechas[0];

  return `
    <div class="card" style="flex:1;min-height:0;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:8px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);">Historial reciente</div>
        </div>
        <select onchange="window._historialFecha=this.value;renderTareas()" style="font-size:11px;padding:4px 6px;">
          ${todasFechas.map(f => `<option value="${f}" ${f===selectedHist?'selected':''}>${fmtFecha(f)}</option>`).join('')}
        </select>
      </div>
      <div style="overflow-y:auto;flex:1;min-height:0;">
        ${(porFecha[selectedHist]||[]).map(h => `
          <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>
            <span style="font-size:12.5px;font-weight:600;color:var(--text);flex:1;min-width:0;">${_esc3(h.tarea.nombre)}</span>
            ${h.ts ? `<span style="font-size:10.5px;color:var(--text3);flex-shrink:0;">${_fmtHoraTs(h.ts)}</span>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
}

// ── Sección: Próximas (recurrentes resto de la semana) — colapsable ──
function _renderProximas(tareas, hoyDia, fechaHoy) {
  const recurrentes = tareas.filter(t => t.tipo === 'recurrente' && Array.isArray(t.dias));
  if (!recurrentes.length) return '';
  const porDia = {};
  recurrentes.forEach(t => {
    t.dias.forEach(d => {
      if (d === hoyDia) return;
      if (!porDia[d]) porDia[d] = [];
      porDia[d].push(t);
    });
  });
  const dias = Object.keys(porDia).map(Number).sort((a,b) => ((a-hoyDia+7)%7||7) - ((b-hoyDia+7)%7||7));
  if (!dias.length) return '';
  return `
    <div class="card" style="margin-top:16px;padding:0;overflow:hidden;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;cursor:pointer;" onclick="_toggleProximas(this)">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);">
          Tareas recurrentes — resto de la semana
        </div>
        <svg id="tareas-proximas-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="transition:transform .2s;transform:rotate(-90deg);"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div id="tareas-proximas-body" style="display:none;padding:0 16px 16px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">
          ${dias.map(d => `
            <div style="background:var(--white);border:1px solid var(--border);border-radius:10px;overflow:hidden;box-shadow:var(--shadow);">
              <div style="padding:8px 14px;background:var(--bg);border-bottom:1px solid var(--border);font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;letter-spacing:.6px;">
                ${_DIAS_SEMANA[d]}
              </div>
              <div style="display:flex;flex-direction:column;gap:0;">
                ${porDia[d].map(t => `
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-bottom:1px solid var(--border);">
                    <div style="flex:1;min-width:0;">
                      <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc3(t.nombre)}</div>
                      ${t.descripcion ? `<div style="font-size:10px;color:var(--text3);margin-top:1px;">${_esc3(t.descripcion)}</div>` : ''}
                    </div>
                    <div style="display:flex;gap:3px;flex-shrink:0;">
                      <button class="btn btn-ghost btn-icon btn-sm" onclick="openModalTarea('${t.id}')" title="Editar">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button class="btn btn-ghost btn-icon btn-sm" onclick="_confirmarDeleteTarea('${t.id}')" title="Eliminar" style="color:var(--red);">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                      </button>
                    </div>
                  </div>`).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}
function _toggleProximas(header) {
  const body = document.getElementById('tareas-proximas-body');
  const chevron = document.getElementById('tareas-proximas-chevron');
  if (!body) return;
  const abierto = body.style.display !== 'none';
  body.style.display = abierto ? 'none' : 'block';
  if (chevron) chevron.style.transform = abierto ? 'rotate(-90deg)' : 'rotate(0deg)';
}

// ══ TOGGLE COMPLETADA ══
async function _toggleTarea(id, fecha) {
  _tareaSpinner(true);
  const tareas = await _getTareas();
  const t = tareas.find(x => x.id === id);
  if (!t) { _tareaSpinner(false); return; }
  if (!t.completadas) t.completadas = {};
  const nowDone = !t.completadas[fecha];
  t.completadas[fecha] = nowDone;
  if (nowDone) t.completadas[fecha+'_ts'] = Date.now();
  else delete t.completadas[fecha+'_ts'];

  await _saveTarea(t);
  _tareaSpinner(false);
  await renderTareas();
}

// ── Marcar no cumplida como hecha ──
async function _marcarNoCumplidaComoHecha(id) {
  const tareas = await _getTareas();
  const t = tareas.find(x => x.id === id);
  if (!t) return;
  if (!t.completadas) t.completadas = {};
  t.completadas[t.fecha] = true;
  t.completadas[t.fecha+'_ts'] = Date.now();
  await _saveTarea(t);
  await renderTareas();
  closeModal('modal-no-cumplidas');
  showToast('Tarea marcada como cumplida', 'success', 2000);
}

// ══ MODAL NUEVA/EDITAR TAREA ══
var _editTareaId = null;

async function openModalTarea(id) {
  _editTareaId = id || null;
  document.getElementById('tarea-nombre').value = '';
  document.getElementById('tarea-descripcion').value = '';
  document.getElementById('tarea-tipo-recurrente').checked = true;
  document.getElementById('tarea-fecha-wrap').style.display = 'none';
  document.getElementById('tarea-dias-wrap').style.display = 'block';
  document.getElementById('tarea-fecha').value = _fechaHoy();
  document.getElementById('tarea-err').textContent = '';
  document.getElementById('modal-tarea-title').textContent = id ? 'Editar tarea' : 'Nueva tarea';
  document.querySelectorAll('.tarea-dia-btn').forEach(b => b.classList.remove('active'));

  // Poblar selects de categoría y tienda
  const cats = _getTareaCats();
  const catSel = document.getElementById('tarea-categoria');
  if (catSel) catSel.innerHTML = `<option value="">Sin categoría</option>` + cats.map(c => `<option value="${c.id}">${_esc3(c.label)}</option>`).join('');

  let tiendas = [];
  try { tiendas = await DB.tiendas(); } catch { tiendas = []; }
  const tSel = document.getElementById('tarea-tienda');
  if (tSel) tSel.innerHTML = `<option value="">Sin tienda / todas</option>` + tiendas.map(t => `<option value="${t.id}">${_esc3(t.nombre)}</option>`).join('');

  if (id) {
    _getTareas().then(tareas => {
      const t = tareas.find(x => x.id === id);
      if (!t) return;
      document.getElementById('tarea-nombre').value = t.nombre || '';
      document.getElementById('tarea-descripcion').value = t.descripcion || '';
      if (catSel) catSel.value = t.categoria_id || '';
      if (tSel) tSel.value = t.tienda_id || '';
      if (t.tipo === 'puntual') {
        document.getElementById('tarea-tipo-puntual').checked = true;
        document.getElementById('tarea-fecha-wrap').style.display = 'block';
        document.getElementById('tarea-dias-wrap').style.display = 'none';
        document.getElementById('tarea-fecha').value = t.fecha || _fechaHoy();
      } else {
        (t.dias || []).forEach(d => {
          const btn = document.querySelector(`.tarea-dia-btn[data-dia="${d}"]`);
          if (btn) btn.classList.add('active');
        });
      }
    });
  } else {
    const btn = document.querySelector(`.tarea-dia-btn[data-dia="${_diaHoy()}"]`);
    if (btn) btn.classList.add('active');
  }

  openModal('modal-tarea');
  setTimeout(() => document.getElementById('tarea-nombre').focus(), 150);
}

function _toggleTipoTarea() {
  const esPuntual = document.getElementById('tarea-tipo-puntual').checked;
  document.getElementById('tarea-fecha-wrap').style.display = esPuntual ? 'block' : 'none';
  document.getElementById('tarea-dias-wrap').style.display  = esPuntual ? 'none'  : 'block';
}

function _toggleDiaBtn(btn) { btn.classList.toggle('active'); }

async function guardarTarea() {
  const nombre = document.getElementById('tarea-nombre').value.trim();
  const errEl  = document.getElementById('tarea-err');
  if (!nombre) { errEl.textContent = 'El nombre es requerido.'; return; }
  const esPuntual = document.getElementById('tarea-tipo-puntual').checked;
  const dias = esPuntual ? [] : Array.from(document.querySelectorAll('.tarea-dia-btn.active')).map(b => parseInt(b.dataset.dia));
  if (!esPuntual && !dias.length) { errEl.textContent = 'Selecciona al menos un día.'; return; }

  const t = {
    id:          _editTareaId || uid(),
    nombre,
    descripcion: document.getElementById('tarea-descripcion').value.trim(),
    categoria_id: document.getElementById('tarea-categoria')?.value || '',
    tienda_id:    document.getElementById('tarea-tienda')?.value || '',
    tipo:        esPuntual ? 'puntual' : 'recurrente',
    dias:        esPuntual ? [] : dias,
    fecha:       esPuntual ? document.getElementById('tarea-fecha').value : '',
    completadas: {},
    creado:      new Date().toISOString(),
  };

  if (_editTareaId) {
    const tareas = await _getTareas();
    const old = tareas.find(x => x.id === _editTareaId);
    if (old?.completadas) t.completadas = old.completadas;
    if (old?.creado) t.creado = old.creado;
  }

  _tareaSpinner(true);
  await _saveTarea(t);
  closeModal('modal-tarea');
  await renderTareas();
  _tareaSpinner(false);
  showToast(_editTareaId ? 'Tarea actualizada' : 'Tarea creada', 'success', 2000);
}

async function _confirmarDeleteTarea(id) {
  const tareas = await _getTareas();
  const t = tareas.find(x => x.id === id);
  if (!t) return;
  document.getElementById('del-tarea-nombre').textContent = t.nombre;
  document.getElementById('del-tarea-id-val').value = id;
  document.getElementById('del-tarea-err').textContent = '';
  document.getElementById('del-tarea-code').value = '';
  openModal('modal-del-tarea');
  setTimeout(() => document.getElementById('del-tarea-code').focus(), 150);
}

async function confirmarDeleteTarea() {
  const id   = document.getElementById('del-tarea-id-val').value;
  const code = document.getElementById('del-tarea-code').value.trim();
  const errEl = document.getElementById('del-tarea-err');
  if (!code) { errEl.textContent = 'Ingresa el código de acceso.'; return; }
  const ok = await _verificarCodigoAcceso(code);
  if (!ok) { errEl.textContent = 'Código incorrecto.'; document.getElementById('del-tarea-code').value = ''; return; }
  _tareaSpinner(true);
  await _deleteTareaDB(id);
  closeModal('modal-del-tarea');
  await renderTareas();
  _tareaSpinner(false);
  showToast('Tarea eliminada', 'success', 2000);
}