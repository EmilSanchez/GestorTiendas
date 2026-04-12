/* Módulo Problemas */

// ── PROBLEMAS ──
let _editProbId = null;
let _ventaSelProblema = null;

// ══════════════════════════════════════════════════════════
// CATEGORÍAS DE PROBLEMA — editables, guardadas en localStorage
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
    return raw ? JSON.parse(raw) : [..._CATS_DEFAULT];
  } catch { return [..._CATS_DEFAULT]; }
}

function _saveCats(cats) {
  localStorage.setItem(_CATS_KEY, JSON.stringify(cats));
}

// Sincroniza el objeto TIPO_LABELS con las categorías actuales
function _buildTipoLabels() {
  const obj = {};
  _getCats().forEach(c => { obj[c.id] = c.label; });
  return obj;
}
let TIPO_LABELS = _buildTipoLabels();

// Llena cualquier <select> de tipos con las categorías actuales
function _fillTipoSelects() {
  TIPO_LABELS = _buildTipoLabels();
  const cats = _getCats();
  const optsFilter = '<option value="">Todas</option>' +
    cats.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
  const optsForm = cats.map(c => `<option value="${c.id}">${c.label}</option>`).join('');

  const pf = document.getElementById('pf-tipo');
  const pt = document.getElementById('p-tipo');
  if (pf) pf.innerHTML = optsFilter;
  if (pt) pt.innerHTML = optsForm;
}

// ── MODAL GESTIONAR CATEGORÍAS ──
function openModalCategorias() {
  _renderCatList();
  document.getElementById('modal-categorias').classList.add('open');
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
        width:28px;height:28px;border:none;border-radius:6px;cursor:pointer;
        background:var(--teal-bg);color:var(--teal);font-size:14px;
        display:flex;align-items:center;justify-content:center;transition:all .15s;"
        onmouseover="this.style.background='var(--teal)';this.style.color='#fff'"
        onmouseout="this.style.background='var(--teal-bg)';this.style.color='var(--teal)'">✓</button>
      ${cats.length > 1 ? `<button onclick="_eliminarCat(${i})" title="Eliminar" style="
        width:28px;height:28px;border:none;border-radius:6px;cursor:pointer;
        background:transparent;color:var(--text3);font-size:14px;
        display:flex;align-items:center;justify-content:center;transition:all .15s;"
        onmouseover="this.style.background='var(--red-bg)';this.style.color='var(--red)'"
        onmouseout="this.style.background='transparent';this.style.color='var(--text3)'">✕</button>` : ''}
    </div>
  `).join('');
}

function guardarCat(i) {
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
  cats[i].label = newLabel;
  _saveCats(cats);
  _fillTipoSelects();
  // Flash verde en la fila
  const row = document.getElementById(`cat-row-${i}`);
  if (row) {
    row.style.background = 'var(--green-bg)';
    row.style.borderColor = '#6cc490';
    setTimeout(() => { row.style.background = ''; row.style.borderColor = 'var(--border)'; }, 800);
  }
  showToast('✅ Categoría actualizada', 'success', 1800);
}

function _eliminarCat(i) {
  const cats = _getCats();
  if (cats.length <= 1) return;
  cats.splice(i, 1);
  _saveCats(cats);
  _fillTipoSelects();
  _renderCatList();
  showToast('Categoría eliminada', 'info', 1800);
}

function agregarCat() {
  const input = document.getElementById('cat-nueva-label');
  if (!input) return;
  const label = input.value.trim();
  if (!label) {
    input.style.borderColor = 'var(--red)';
    input.classList.add('shake');
    setTimeout(() => { input.style.borderColor = 'var(--border)'; input.classList.remove('shake'); }, 500);
    return;
  }
  const id = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const cats = _getCats();
  if (cats.find(c => c.id === id)) { showToast('Ya existe una categoría con ese nombre', 'error', 2000); return; }
  cats.push({ id, label });
  _saveCats(cats);
  _fillTipoSelects();
  input.value = '';
  _renderCatList();
  showToast('✅ Categoría agregada', 'success', 1800);
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
  document.getElementById('mp-title').textContent = probId ? 'Editar Problema' : 'Registrar Problema';
  document.getElementById('p-buscar').value = '';
  document.getElementById('p-buscar-resultado').innerHTML = '';
  document.getElementById('p-num-venta-manual').value = '';
  sv('p-fecha', hoy()); sv('p-tipo','producto_danado');
  sv('p-descripcion',''); sv('p-solucion',''); sv('p-estado','abierto'); sv('p-perdida','');

  _fillTipoSelects();

  if (ventaId) {
    const v = (await DB.ventas()).find(x => x.id === ventaId);
    if (v) { document.getElementById('p-buscar').value = v.id_ml || v.id; seleccionarVentaProblema(v); }
  }
  if (probId) {
    const p = (await DB.problemas()).find(x => x.id === probId);
    if (p) {
      sv('p-fecha', p.fecha); sv('p-tipo', p.tipo);
      sv('p-descripcion', p.descripcion); sv('p-solucion', p.solucion || '');
      sv('p-estado', p.estado); sv('p-perdida', p.valor_perdida || '');
      sv('p-num-venta-manual', p.id_ml_venta || '');
    }
  }
  openModal('modal-problema');
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
             margin-top:3px;cursor:pointer;font-size:12px;"
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
    <div style="padding:8px 10px;background:var(--teal-bg);border:1px solid #b8d8d8;
         border-radius:var(--radius);font-size:12px;margin-top:4px;">
      ✅ <strong>${_ventaSelProblema.id_ml||_ventaSelProblema.id}</strong> — ${_ventaSelProblema.producto}
      <span class="c-dim" style="margin-left:6px;">${t?.nombre||'?'} · ${_ventaSelProblema.fecha_venta||''}</span>
    </div>`;
}

async function saveProblema() {
  const desc   = gv('p-descripcion').trim();
  const estado = gv('p-estado');
  const solucion = gv('p-solucion').trim();
  if (!desc) { alert('La descripción es requerida.'); return; }
  if ((estado==='resuelto'||estado==='perdida') && !solucion) {
    alert('⚠️ Para marcar como resuelto o con pérdida, debes registrar la solución.');
    document.getElementById('p-solucion').focus();
    return;
  }

  const tipo = gv('p-tipo');
  const numVentaManual = gv('p-num-venta-manual').trim();
  const existingProb = _editProbId ? (await DB.problemas()).find(x => x.id === _editProbId) : null;

  await DB.upsertProblema({
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
    fecha_registro: new Date().toISOString(),
  });
  closeModal('modal-problema');
  showConfirmAnim('problema', !!_editProbId);
  await renderProblemas();
  await updateAlertaBadge();
}

async function renderProblemas() {
  _fillTipoSelects();
  const tiendas   = await DB.tiendas();
  const ventas    = await DB.ventas();
  let   problemas = await DB.problemas();

  const s   = gv('pf-search').toLowerCase();
  const fe  = gv('pf-estado');
  const ft  = gv('pf-tienda');
  const ftp = gv('pf-tipo');

  if (s)   problemas = problemas.filter(p => (p.id_ml_venta+p.producto+p.descripcion).toLowerCase().includes(s));
  if (fe)  problemas = problemas.filter(p => p.estado === fe);
  if (ft)  problemas = problemas.filter(p => p.tienda_id === ft);
  if (ftp) problemas = problemas.filter(p => p.tipo === ftp);
  problemas.sort((a,b) => (b.fecha||'').localeCompare(a.fecha||''));

  if (!problemas.length) {
    document.getElementById('problemas-container').innerHTML = `
      <div class="empty-state"><div class="empty-icon">✅</div>
      <div class="empty-title">Sin problemas registrados</div>
      <div class="c-dim" style="font-size:12px;">Puedes registrar novedades desde aquí o desde el detalle de cada venta</div></div>`;
    return;
  }

  document.getElementById('problemas-container').innerHTML = problemas.map(p => {
    const t = tiendas.find(x => x.id === p.tienda_id);
    const v = ventas.find(x => x.id === p.venta_id);
    const c = v ? calcVenta(v) : null;
    return `<div class="prob-card">
      <div class="prob-header">
        <div>
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:5px;">
            <span class="badge badge-${p.estado}">${p.estado}</span>
            <span style="font-size:11px;font-weight:600;color:var(--teal);">${p.tipo_label||p.tipo}</span>
            ${p.valor_perdida>0?`<span class="badge badge-perdida">Pérdida: ${fmt(p.valor_perdida)}</span>`:''}
          </div>
          <div style="font-size:12px;color:var(--text2);">
            Venta: <span class="venta-id" onclick="copiarIdVenta('${p.id_ml_venta||p.venta_id||''}',this)"
              title="Clic para copiar ID">${p.id_ml_venta||p.venta_id||'—'}</span>
            ${p.producto ? ` — <strong>${p.producto}</strong>` : ''}
            ${t ? `<span class="c-dim" style="margin-left:6px;">· ${t.nombre}</span>` : ''}
          </div>
        </div>
        <div style="text-align:right;font-size:11px;color:var(--text3);">
          ${p.fecha||'—'}
          ${c ? `<div class="mono" style="font-size:11px;margin-top:2px;">Venta: ${fmt(c.totalVenta)}</div>` : ''}
        </div>
      </div>
      <div class="prob-body">
        <div style="margin-bottom:8px;">
          <strong style="color:var(--text);">Problema:</strong>
          <span style="color:var(--text2);margin-left:4px;">${p.descripcion}</span>
        </div>
        ${p.solucion
          ? `<div style="background:var(--teal-bg);border-left:3px solid var(--teal);border-radius:0 var(--radius) var(--radius) 0;padding:8px 12px;font-size:12px;">
               <strong style="color:var(--teal-dark);">✅ Solución:</strong>
               <span style="color:var(--text2);margin-left:4px;">${p.solucion}</span>
               ${p.fecha_resolucion?`<div style="font-size:10px;color:var(--text3);margin-top:3px;">Resuelta el ${p.fecha_resolucion}</div>`:''}
             </div>`
          : p.estado!=='abierto'
            ? `<div style="background:var(--yellow-bg);border-left:3px solid var(--yellow);border-radius:0 var(--radius) var(--radius) 0;padding:7px 12px;font-size:11px;color:var(--yellow);">Sin solución registrada</div>`
            : ''
        }
      </div>
      <div class="prob-footer">
        <button class="btn btn-ghost btn-sm" onclick="openModalProblema(null,'${p.id}')">Editar</button>
        ${p.estado==='abierto' ? `
          <button class="btn btn-success btn-sm" onclick="openResolverProblema('${p.id}','resuelto')">Resolver</button>
          <button class="btn btn-danger btn-sm" onclick="openResolverProblema('${p.id}','perdida')">Pérdida</button>` : ''}
        <div class="spacer"></div>
        <button class="btn btn-danger btn-icon btn-sm" onclick="deleteProb('${p.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

async function resolverProblema(id, estado) {
  await openResolverProblema(id, estado);
}

async function openResolverProblema(id, estado) {
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

  p.estado   = estado;
  p.solucion = solucion;
  p.fecha_resolucion = new Date().toISOString().slice(0, 10);
  if (estado === 'perdida') p.valor_perdida = perdida;

  await DB.saveProblemas(probs);
  closeModal('modal-resolver-problema');
  showConfirmAnim('resuelto', false);
  await renderProblemas();
  await updateAlertaBadge();
}

async function deleteProb(id) {
  if (!confirm('¿Eliminar este problema?')) return;
  await DB.deleteProblema(id);
  await renderProblemas();
  await updateAlertaBadge();
}

// ── HELPERS DOM ──
const gv = id => { const el = document.getElementById(id); return el ? el.value : ''; };
const sv = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
const st = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { const el = document.getElementById(id); if(el){el.classList.remove('close');el.classList.remove('open');} }

// ── COPIAR ID DE VENTA AL PORTAPAPELES ──
function copiarIdVenta(id, el) {
  const _flash = () => {
    el.style.transition = 'background .12s, color .12s, border-color .12s';
    el.style.background = '#a7d9b7'; el.style.color = '#1b7e4a'; el.style.borderColor = '#6cc490';
    setTimeout(() => { el.style.background = ''; el.style.color = ''; el.style.borderColor = ''; }, 500);
  };
  navigator.clipboard.writeText(id).then(_flash).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = id; ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta); _flash();
  });
}

async function updateAlertaBadge() {
  document.getElementById('alertas-count').textContent = (await getAlertas()).length;
}

async function populateSelects() {
  const tiendas = await DB.tiendas();
  const opts = tiendas.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
  const blank = '<option value="">Todas</option>';
  ['vf-tienda','pf-tienda','ef-tienda'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = blank + opts;
  });
  _fillTipoSelects();
}

// ══════════════════════════════════════════════════════════