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
  // Mientras un problema "vuela" hacia el menú, el número espera a que llegue
  if (!_probBadgeHold) ['nav-prob-count', 'nav-prob-count-sub'].forEach(id => {
    const b = document.getElementById(id);
    if (b) { b.textContent = total; b.style.display = total ? '' : 'none'; }
  });
  _fillTipoSelects();
}
var _probBadgeHold = false;

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
  _mpTab(!probId && previos.some(x => x.estado === 'abierto') ? 'prev' : 'form', true);
  openModal('modal-problema');
}

// Cambia de pestaña con la misma transición suave de alto + fundido que el
// modal de ventas (Venta ↔ Envío externo). skipAnim: al abrir el modal.
function _mpTab(tab, skipAnim) {
  const prev = tab === 'prev';
  const formEl = document.getElementById('mp-pane-form');
  const prevEl = document.getElementById('mp-pane-prev');
  document.getElementById('mp-tab-form').classList.toggle('active', !prev);
  document.getElementById('mp-tab-prev').classList.toggle('active', prev);
  // El pie no desaparece (así el modal no salta): en "anteriores" ofrece registrar uno nuevo
  document.getElementById('mp-btn-guardar').style.display = prev ? 'none' : '';
  document.getElementById('mp-btn-nuevo').style.display   = prev ? '' : 'none';
  const showEl = prev ? prevEl : formEl, hideEl = prev ? formEl : prevEl;
  if (skipAnim || typeof _mvAnimarCambioTab !== 'function') {
    showEl.style.display = ''; hideEl.style.display = 'none';
    return;
  }
  _mvAnimarCambioTab(showEl, hideEl, document.getElementById('mp-body-wrap'));
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
    // Fecha/hora de resolución: se conserva; si se marca resuelto desde aquí, se fija ahora
    ...(gv('p-estado') !== 'abierto'
      ? (existingProb && existingProb.estado !== 'abierto' && existingProb.fecha_resolucion
          ? { fecha_resolucion: existingProb.fecha_resolucion, fecha_resolucion_ts: existingProb.fecha_resolucion_ts || null }
          : { fecha_resolucion: hoy(), fecha_resolucion_ts: new Date().toISOString() })
      : {}),
    // Fecha/hora de la última edición — nunca toca fecha_registro (la fecha original de creación)
    fecha_actualizacion: new Date().toISOString(),
  };
  nuevo.historial = _probHistorialCon(existingProb, nuevo);

  // 1) Guardar primero. Si falla, el modal sigue abierto con el error.
  const btn = document.getElementById('mp-btn-guardar');
  if (btn?.disabled) return;                  // evita doble guardado (y doble conteo)
  const btnTxt = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
  Sonido.preparar();
  const esNuevo = !existingProb;
  const conteoAntes = _probAbiertosTotal;
  _probBadgeHold = esNuevo;
  try {
    await DB.upsertProblema(nuevo);
  } catch (e) {
    _probBadgeHold = false;
    if (btn) { btn.disabled = false; btn.textContent = btnTxt; }
    console.error('No se pudo guardar el problema:', e);
    const msg = 'No se pudo guardar el problema. Revisa tu conexión e intenta de nuevo.';
    if (typeof showToast === 'function') showToast(msg, 'error', 3500); else alert(msg);
    return;
  }

  // 2) Guardado: el modal "viaja" al módulo Pendientes del menú (solo al registrar uno nuevo)
  if (!esNuevo) Sonido.play('editar');
  const viaje = esNuevo ? _probAnimarHaciaModulo() : (closeModal('modal-problema'), Promise.resolve(false));

  // Refrescos en paralelo con la animación (el contador del menú espera a que llegue)
  const refrescos = (async () => {
    try { await renderProblemas(); } catch(e) {}
    try { await updateAlertaBadge(); } catch(e) {}
    try { await _actualizarBotonesProblema(); } catch(e) {}
    // Actualizar gestor de ventas siempre
    if (typeof renderVentasGanancias === 'function') await renderVentasGanancias();
    else if (typeof renderVentas === 'function') await renderVentas();
  })();

  // Valor real del sistema, listo antes de la llegada para que el número cambie justo al entrar
  try { await updatePendientesCount(); } catch(e) {}
  const llego = await viaje;
  _probBadgeHold = false;
  _probContadorAnimar(conteoAntes, _probAbiertosTotal, llego);
  if (btn) { btn.disabled = false; btn.textContent = btnTxt; }
  await refrescos;
}

// ══════════════════════════════════════════════════════════
// ANIMACIÓN "EL PROBLEMA ENTRA AL MÓDULO PENDIENTES"
// El modal se minimiza mientras viaja hacia el ítem Pendientes del menú lateral,
// entra en él (el ítem reacciona con un leve pulso de luz) y luego el contador
// sube con una transición numérica. Si no hay movimiento permitido o el ítem no
// está visible, se cierra de forma sencilla. Devuelve true si llegó al menú.
// ══════════════════════════════════════════════════════════
function _probAnimarHaciaModulo() {
  const ov    = document.getElementById('modal-problema');
  const modal = ov?.querySelector('.modal');
  // Vuela hacia donde se ve el contador: el sub-ítem si el submenú está abierto
  const subAbierto = document.getElementById('pend-submenu')?.classList.contains('open') && !document.body.classList.contains('sb-collapsed');
  const nav   = (subAbierto && document.querySelector('.nav-item[data-page="problemas"]')) || document.getElementById('nav-pend-toggle');
  const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const cerrar  = () => { closeModal('modal-problema'); };

  if (!modal || !modal.animate || reducir) { cerrar(); return Promise.resolve(false); }

  const ico = nav?.querySelector('.ni') || nav;
  const ir  = ico?.getBoundingClientRect();
  const navVisible = !!ir && ir.width > 0 && ir.height > 0 &&
    ir.right > 0 && ir.left < innerWidth && ir.bottom > 0 && ir.top < innerHeight &&
    getComputedStyle(nav).visibility !== 'hidden';

  // Sin destino visible (p. ej. menú oculto en móvil): cierre sencillo
  if (!navVisible) {
    return modal.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }],
      { duration: 180, easing: 'ease-in', fill: 'forwards' })
      .finished.then(() => { cerrar(); modal.getAnimations().forEach(a => a.cancel()); return false; }, () => { cerrar(); return false; });
  }

  const mr = modal.getBoundingClientRect();
  const icx = ir.left + ir.width / 2, icy = ir.top + ir.height / 2;
  const dx = icx - (mr.left + mr.width / 2);
  const dy = icy - (mr.top + mr.height / 2);
  const sFin = Math.max(0.02, Math.min(ir.width / mr.width, ir.height / mr.height));
  // Línea de tiempo (~1,4 s en total):
  //  0 → 30%  el modal se minimiza en su sitio
  //  30 → 85% viaja hacia el ícono de Pendientes (acelera y frena)
  //  85% (≈900 ms) entra al ícono → el módulo lo "absorbe": impacto, brillo y contador
  //  85 → 100% el modal termina de desaparecer dentro; la reacción dura ~560 ms más
  const DUR = 1060, ENTRADA = 0.85;

  ov.style.pointerEvents = 'none';
  modal.style.transformOrigin = 'center center';
  // Soplido que acompaña el viaje (empieza al despegar y crece al acercarse)
  setTimeout(() => Sonido.play('viaje'), DUR * 0.22);
  modal.style.willChange = 'transform, opacity';

  // El fondo oscuro se aclara mientras el modal se va
  const fondo = ov.animate([{ backgroundColor: getComputedStyle(ov).backgroundColor }, { backgroundColor: 'rgba(0,0,0,0)' }],
    { duration: DUR * 0.75, easing: 'ease-out', fill: 'forwards' });

  const viaje = modal.animate([
    // Cada tramo con su propia curva, así el 85% del tiempo es exactamente el instante de entrada
    { offset: 0,       easing: 'cubic-bezier(.4,0,.2,1)',
      transform: 'translate(0,0) scale(1)', opacity: 1, borderRadius: '14px', boxShadow: '0 8px 30px rgba(0,0,0,.15)' },
    { offset: 0.30,    easing: 'cubic-bezier(.55,0,.3,1)',
      transform: `translate(${dx * 0.05}px,${dy * 0.05}px) scale(.55)`, opacity: 1, borderRadius: '18px', boxShadow: '0 12px 34px rgba(26,79,168,.25)' },
    { offset: ENTRADA, easing: 'cubic-bezier(.5,0,.75,0)',
      transform: `translate(${dx}px,${dy}px) scale(${sFin * 1.7})`, opacity: .9, borderRadius: '40px', boxShadow: '0 0 22px rgba(96,165,250,.55)' },
    { offset: 1,
      transform: `translate(${dx}px,${dy}px) scale(${sFin * 0.3})`, opacity: 0, borderRadius: '50%', boxShadow: '0 0 0 rgba(96,165,250,0)' },
  ], { duration: DUR, easing: 'linear', fill: 'forwards' });

  // Recepción: el módulo absorbe el problema (impacto + leve empuje + brillo de acento)
  const recibir = () => {
    Sonido.play('entrada');
    nav.animate([
      { transform: 'translateX(0) scale(1)' },
      { transform: 'translateX(-2px) scale(.96)', offset: .14 },   // impacto
      { transform: 'translateX(3px) scale(1.06)', offset: .42 },   // absorbe y se expande
      { transform: 'translateX(0) scale(1)' },
    ], { duration: 560, easing: 'cubic-bezier(.3,.7,.3,1)' });
    nav.animate([
      { boxShadow: '0 0 0 0 rgba(96,165,250,0)',            backgroundColor: 'rgba(96,165,250,0)' },
      { boxShadow: '0 0 22px 4px rgba(96,165,250,.55)',      backgroundColor: 'rgba(96,165,250,.18)', offset: .25 },
      { boxShadow: '0 0 0 0 rgba(96,165,250,0)',            backgroundColor: 'rgba(96,165,250,0)' },
    ], { duration: 900, easing: 'ease-out' });
    ico.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)', offset: .35 }, { transform: 'scale(1)' }],
      { duration: 520, easing: 'cubic-bezier(.3,.7,.3,1)' });
    // Onda suave que sale del ícono
    const onda = document.createElement('div');
    onda.style.cssText = `position:fixed;left:${icx - 14}px;top:${icy - 14}px;width:28px;height:28px;border-radius:50%;` +
      'border:2px solid rgba(96,165,250,.7);pointer-events:none;z-index:9999;';
    document.body.appendChild(onda);
    onda.animate([{ transform: 'scale(.4)', opacity: .9 }, { transform: 'scale(2.4)', opacity: 0 }],
      { duration: 700, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'forwards' }).finished.then(() => onda.remove(), () => onda.remove());
  };

  const limpiar = () => {
    cerrar();
    viaje.cancel(); fondo.cancel();
    ov.style.pointerEvents = ''; modal.style.transformOrigin = ''; modal.style.willChange = '';
  };
  viaje.finished.then(limpiar, limpiar);

  // Se resuelve en el instante en que el modal entra al módulo (ahí sube el contador)
  return new Promise(res => setTimeout(() => {
    if (viaje.playState === 'idle') { res(false); return; }
    recibir();
    res(true);
  }, DUR * ENTRADA));
}

// Contador del menú: cambia con un pequeño "giro" del número y un destello sutil.
// Siempre termina mostrando el valor real (hasta).
// Hay dos contadores (en "Pendientes" y en el sub-ítem "Problemas"); el CSS muestra
// solo el que corresponde según el submenú esté abierto o cerrado.
function _probContadorAnimar(desde, hasta, destacar) {
  ['nav-prob-count', 'nav-prob-count-sub'].forEach(id => {
    const b = document.getElementById(id);
    if (b) _probContadorAnimarEn(b, desde, hasta, destacar);
  });
}
function _probContadorAnimarEn(b, desde, hasta, destacar) {
  const fin = () => { b.textContent = hasta; b.style.display = hasta ? '' : 'none'; };
  const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!destacar || desde === hasta || reducir || !b.animate) { fin(); return; }

  const aparece = !desde || b.style.display === 'none';
  b.style.display = '';
  b.style.overflow = 'hidden';
  b.innerHTML = `<span style="display:inline-block;">${aparece ? hasta : desde}</span>`;
  const num = b.firstChild;
  const sube = hasta > desde ? -1 : 1;

  if (aparece) {
    b.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.18)', opacity: 1, offset: .65 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 460, easing: 'cubic-bezier(.2,.8,.3,1)' }).finished.then(() => { b.style.overflow = ''; fin(); }, fin);
    return;
  }
  // Pulso + halo del badge
  b.animate([
    { transform: 'scale(1)',    boxShadow: '0 0 0 0 rgba(239,68,68,.55)' },
    { transform: 'scale(1.22)', boxShadow: '0 0 0 5px rgba(239,68,68,.25)', offset: .45 },
    { transform: 'scale(1)',    boxShadow: '0 0 0 8px rgba(239,68,68,0)' },
  ], { duration: 620, easing: 'cubic-bezier(.4,0,.2,1)' });
  // El número viejo sale y entra el nuevo
  num.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${sube * 9}px)`, opacity: 0 }],
    { duration: 180, easing: 'ease-in', fill: 'forwards' }).finished.then(() => {
      num.textContent = hasta;
      return num.animate([{ transform: `translateY(${-sube * 9}px)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
        { duration: 280, easing: 'cubic-bezier(.2,.8,.3,1)' }).finished;
    }).then(() => { b.style.overflow = ''; fin(); }, () => { b.style.overflow = ''; fin(); });
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
    const c0 = document.getElementById('problemas-container');
    const antes0 = _probCapturar(c0);
    _probFijarAlto(c0, antes0);
    c0._probCards = null;
    c0.innerHTML = `
      <div class="empty-state"><div class="empty-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
      <div class="empty-title">Sin problemas registrados</div>
      <div class="c-dim" style="font-size:12px;">Puedes registrar novedades desde aquí o desde el detalle de cada venta</div></div>`;
    _probAnimar(c0, antes0);
    if (antes0.size && Element.prototype.animate)
      c0.querySelector('.empty-state')?.animate([{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }],
        { duration: 320, delay: 160, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' });
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
  const antes = _probCapturar(cont);  // antes de mover las tarjetas
  _probFijarAlto(cont, antes);         // evita que el scroll salte al cambiar el contenido
  const wrap = document.createElement('div');
  wrap.className = 'pc-cols';
  const cols = Array.from({ length: n }, () => {
    const c = document.createElement('div');
    c.className = 'pc-col';
    wrap.appendChild(c);
    return c;
  });
  cards.forEach((card, i) => cols[i % n].appendChild(card));
  // Reemplazar el contenido sin quitar las tarjetas que aún se están desvaneciendo
  [...cont.children].forEach(c => { if (!c.classList.contains('pc-ghost')) c.remove(); });
  cont.prepend(wrap);
  _probAnimar(cont, antes);
  if (!cont._probRO && typeof ResizeObserver !== 'undefined') {
    cont._probRO = new ResizeObserver(() => _probLayout());
    cont._probRO.observe(cont);
  }
}

// ── Animación al filtrar / reacomodar (técnica FLIP) ──
// Antes de cambiar el contenido se guarda dónde está cada tarjeta y cómo se ve;
// después de pintar lo nuevo:
//  · las que salen se encogen y desvanecen en su mismo sitio,
//  · las que siguen se deslizan en línea recta a su nueva posición (sin rebote),
//    justo después de que las demás empiezan a irse,
//  · las que entran crecen de pequeñas a su tamaño normal en su sitio, en orden
//    de lectura, cuando las que salen ya casi desaparecieron.
// Si se cambia de filtro a mitad de una animación, cada tarjeta continúa desde
// donde va (posición, tamaño y opacidad actuales), sin saltos.
const _PA = {
  salir:  { dur: 220, ease: 'cubic-bezier(.2,0,.2,1)' },
  mover:  { delay: 90, ease: 'cubic-bezier(.4,0,.2,1)', min: 360, max: 600, porPx: 0.15 },
  entrar: { dur: 360, ease: 'cubic-bezier(.2,.75,.25,1)', delay: 40, delayTrasSalida: 180, paso: 30, maxPasos: 10 },
  alto:   { dur: 380, ease: 'cubic-bezier(.4,0,.2,1)' },
  escala: 0.6,
};

function _probCapturar(cont) {
  const m = new Map();
  if (!cont || !cont.clientWidth) return m;
  cont.querySelectorAll('.pc[data-prob-id]').forEach(el => {
    const id = el.dataset.probId;
    const ghost = el.classList.contains('pc-ghost');
    if (m.has(id) && !m.get(id).ghost) return;  // si hay tarjeta viva y fantasma, manda la viva
    const r = el.getBoundingClientRect();
    const lw = el.offsetWidth || r.width, lh = el.offsetHeight || r.height;  // tamaño sin transformar
    m.set(id, { el, ghost, r, lw, lh, sc: lw ? r.width / lw : 1,
                cx: r.left + r.width / 2, cy: r.top + r.height / 2,
                op: parseFloat(getComputedStyle(el).opacity) || 0 });
  });
  m.vacio = !!cont.querySelector('.empty-state');
  m.alto  = cont.getBoundingClientRect().height;
  return m;
}

// Mantiene el alto actual del contenedor mientras se cambia el contenido, para
// que el navegador no recorte el scroll de golpe; luego se anima al alto nuevo.
function _probFijarAlto(cont, antes) {
  if (!antes || (!antes.size && !antes.vacio)) return;
  cont._probAltoAnim?.cancel();
  cont.style.height = antes.alto + 'px';
}

function _probAnimar(cont, antes) {
  if (!antes || (!antes.size && !antes.vacio)) return;
  const liberarAlto = () => { cont.style.height = ''; };
  const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reducir || !cont.clientWidth || !Element.prototype.animate) {
    antes.forEach(a => { if (a.ghost) a.el.remove(); });
    liberarAlto();
    return;
  }
  if (getComputedStyle(cont).position === 'static') cont.style.position = 'relative';
  const cr = cont.getBoundingClientRect();
  const vivas = [...cont.querySelectorAll('.pc[data-prob-id]:not(.pc-ghost)')];
  const ids = new Set(vivas.map(el => el.dataset.probId));
  const haySalida = antes.vacio || [...antes].some(([id, a]) => !a.ghost && !ids.has(id));
  const delayEntrada = haySalida ? _PA.entrar.delayTrasSalida : _PA.entrar.delay;
  const delayMover   = haySalida ? _PA.mover.delay : 0;
  const orden = new Map((cont._probCards || []).map((c, i) => [c, i]));  // orden de lectura

  // 1) Las que siguen: de donde se veían a su nuevo sitio
  const entrantes = [];
  let durMovMax = 0;
  vivas.forEach(el => {
    const a = antes.get(el.dataset.probId);
    if (!a) { entrantes.push(el); return; }
    const r = el.getBoundingClientRect();
    const dx = a.cx - (r.left + r.width / 2), dy = a.cy - (r.top + r.height / 2);
    const s  = r.width ? Math.min(1, a.r.width / r.width) : 1;
    if (a.ghost) { a.el.getAnimations().forEach(x => x.cancel()); a.el.remove(); }
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(1 - s) < 0.005 && a.op > 0.99) return;
    const dist = Math.hypot(dx, dy);
    const dur = Math.max(_PA.mover.min, Math.min(_PA.mover.max, _PA.mover.min + dist * _PA.mover.porPx));
    if (dist > 4) durMovMax = Math.max(durMovMax, dur);
    el.animate(
      [{ transform: `translate(${dx}px,${dy}px) scale(${s})`, opacity: a.op }, { transform: 'none', opacity: 1 }],
      { duration: dur, delay: delayMover, easing: _PA.mover.ease, fill: 'backwards' });
  });

  // 2) Las que entran: crecen en su sitio, en orden de lectura; no se pueden
  //    pulsar mientras aún son invisibles
  entrantes.sort((x, y) => (orden.get(x) ?? 0) - (orden.get(y) ?? 0)).forEach((el, i) => {
    el.style.pointerEvents = 'none';
    const an = el.animate(
      [{ opacity: 0, transform: `scale(${_PA.escala})` }, { opacity: 1, transform: 'none' }],
      { duration: _PA.entrar.dur, easing: _PA.entrar.ease, fill: 'backwards',
        delay: delayEntrada + Math.min(i, _PA.entrar.maxPasos) * _PA.entrar.paso });
    const listo = () => { el.style.pointerEvents = ''; };
    an.finished.then(listo, listo);
  });

  // 3) Las que salen: se quedan en su sitio (mismo centro y tamaño visual) y se encogen
  antes.forEach((a, id) => {
    if (ids.has(id)) return;
    const el = a.el;
    if (a.ghost) { if (!el.isConnected) cont.appendChild(el); return; }  // ya se estaba yendo
    el.getAnimations().forEach(x => x.cancel());
    el.classList.add('pc-ghost');
    Object.assign(el.style, {
      position: 'absolute', margin: '0', zIndex: '0', pointerEvents: 'none', transformOrigin: 'center',
      width: a.lw + 'px', height: a.lh + 'px',
      left: (a.cx - a.lw / 2 - cr.left) + 'px', top: (a.cy - a.lh / 2 - cr.top) + 'px',
    });
    cont.appendChild(el);
    const an = el.animate(
      [{ opacity: a.op, transform: `scale(${a.sc})` }, { opacity: 0, transform: `scale(${a.sc * _PA.escala})` }],
      { duration: _PA.salir.dur, easing: _PA.salir.ease, fill: 'forwards' });
    an.onfinish = () => el.remove();
  });

  // Sonido acoplado a cada fase, solo cuando el cambio viene de un filtro:
  // encoger (salen) → deslizar (se agrupan, misma duración) → pop por cada nueva
  if ((Date.now() - (window._probFiltroTs || 0)) < 1500) {
    window._probFiltroTs = 0;
    if (haySalida && !antes.vacio) Sonido.play('encoger', { dur: _PA.salir.dur / 1000 });
    if (durMovMax > 0) Sonido.play('deslizar', { retraso: delayMover, dur: durMovMax / 1000 });
    entrantes.slice(0, 8).forEach((el, i) =>
      Sonido.play('aparecer', { i, retraso: delayEntrada + Math.min(i, _PA.entrar.maxPasos) * _PA.entrar.paso + 40 }));
  }

  // 4) Alto del contenedor: del anterior al nuevo, suave (después de la salida)
  const contenido = cont.querySelector(':scope > .pc-cols, :scope > .empty-state');
  const altoNuevo = contenido ? contenido.getBoundingClientRect().height : 0;
  if (Math.abs(antes.alto - altoNuevo) > 1) {
    const an = cont.animate([{ height: antes.alto + 'px' }, { height: altoNuevo + 'px' }],
      { duration: _PA.alto.dur, easing: _PA.alto.ease, fill: 'backwards',
        delay: altoNuevo < antes.alto && haySalida ? _PA.salir.dur : 0 });
    cont._probAltoAnim = an;
    liberarAlto();
    an.finished.then(() => { if (cont._probAltoAnim === an) cont._probAltoAnim = null; }, () => {});
  } else {
    liberarAlto();
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
  <div class="pc${_probAbiertas.has(p.id) ? ' open' : ''}" data-prob-id="${p.id}" data-venta-id="${v ? v.id : ''}">
    <div class="pc-head">
      <div class="pc-estado-wrap">
        <span class="pc-tienda">${t ? esc(t.nombre) : '—'}</span>
        <span class="pc-estado" style="background:${ec.bg};color:${ec.color};">${p.estado === 'abierto' ? _PI.clock : _PI.check}${ec.label}</span>
        <span class="pc-fecha">${_probFechaCorta(p.fecha_registro || p.fecha)}</span>
      </div>
      <div class="pc-sep"></div>
      <div style="min-width:0;">
        <div class="pc-title">${esc(tipoLabel)}</div>
        <hr class="pc-hr">
        <div class="pc-sub pc-venta">${idVenta ? `Venta <span class="venta-id" onclick="copiarIdVenta('${esc(idVenta)}',this)" title="Clic para copiar">${esc(idVenta)}</span>${_btnVerEnML(p.id_ml_venta, true)}` : 'Sin venta vinculada'}</div>
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
        ${p.estado !== 'abierto' && _probResueltoEn(p) ? `<div style="font-size:10.5px;color:var(--text3);margin-top:4px;">Resuelta el ${_probResueltoEn(p)}</div>` : ''}
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
// Cuándo se resolvió: "03 octubre 2026 · 3:40 p. m.". Usa la hora exacta guardada;
// para problemas resueltos antes de guardarla, la toma del historial de cambios y
// si tampoco existe, muestra solo la fecha.
function _probResueltoEn(p) {
  let ts = p.fecha_resolucion_ts;
  if (!ts && Array.isArray(p.historial)) {
    const h = [...p.historial].reverse().find(x => x.accion === 'resuelto' || x.accion === 'perdida');
    ts = h?.fecha;
  }
  if (ts) {
    const d = new Date(ts);
    if (!isNaN(d)) return `${_probFechaCorta(ts)} · ${d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`;
  }
  return p.fecha_resolucion ? _probFechaCorta(p.fecha_resolucion) : '';
}

// Fecha de registro corta: "03 octubre 2026"
function _probFechaCorta(f) {
  if (!f) return '';
  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const d = /^\d{4}-\d{2}-\d{2}$/.test(f) ? new Date(f + 'T12:00:00') : new Date(f);  // fecha sola: sin desfase de zona
  if (isNaN(d)) return '';
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

// Abre la venta del problema en el mismo modal del Gestor de ventas
async function _probAbrirVenta(ventaId) {
  document.querySelectorAll('.pc-menu').forEach(m => m.remove());
  if (ventaId && typeof openModalVenta === 'function') await openModalVenta(ventaId);
}

function _probExtra(ventaId, tipo) {
  document.querySelectorAll('.pc-menu').forEach(m => m.remove());
  if (typeof openModalExtraVenta === 'function') openModalExtraVenta(ventaId, tipo);
}

function _probMenu(btn, id) {
  document.querySelectorAll('.pc-menu').forEach(m => m.remove());
  const m = document.createElement('div');
  m.className = 'pc-menu';
  const vid = btn.closest('.pc')?.dataset.ventaId || '';
  const ic = d => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const opcVenta = vid ? `
    <button onclick="_probExtra('${vid}','ingreso')">${ic('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>')} Registrar ingreso extra</button>
    <button onclick="_probExtra('${vid}','gasto')">${ic('<circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>')} Registrar gasto extra</button>
    <button onclick="_probAbrirVenta('${vid}')">${ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>')} Editar venta</button>
    <div class="pc-menu-sep"></div>` : '';
  m.innerHTML = opcVenta + `
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
  p.fecha_resolucion_ts = new Date().toISOString();
  p.fecha_actualizacion = new Date().toISOString();
  if (estado === 'perdida') p.valor_perdida = perdida;
  p.historial = _probHistorialCon(antes, p, estado);

  await DB.saveProblemas(probs);
  closeModal('modal-resolver-problema');
  showConfirmAnim('resuelto', false);
  Sonido.play('resolver');
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
    Sonido.play('eliminar');
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
  try { if (typeof updateDemoradosCount === 'function') await updateDemoradosCount(); } catch(e) {}
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
