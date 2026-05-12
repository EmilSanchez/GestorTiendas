// ── Overlay spinner para tareas ──
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
// MÓDULO: TAREAS DIARIAS
// ══════════════════════════════════════════════════════════

const _DIAS_SEMANA = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const _DIAS_SHORT  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

var _tareasCache = null;

// ── Helpers ──
function _diaHoy() { return new Date().getDay(); } // 0=Dom … 6=Sáb
function _fechaHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Persistencia en Firebase ──
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

// ══ RENDER PRINCIPAL ══
async function renderTareas() {
  const tareas  = await _getTareas();
  const hoy     = _diaHoy();
  const fecha   = _fechaHoy();
  const nombreDia = _DIAS_SEMANA[hoy];

  // Separar: recurrentes del día + puntuales de hoy
  const recurrentes = tareas.filter(t =>
    t.tipo === 'recurrente' && Array.isArray(t.dias) && t.dias.includes(hoy)
  );
  const puntuales = tareas.filter(t =>
    t.tipo === 'puntual' && t.fecha === fecha
  );
  const hoyTareas = [...recurrentes, ...puntuales];

  const el = document.getElementById('tareas-container');
  if (!el) return;

  // Header del día
  const completadas = hoyTareas.filter(t => (t.completadas || {})[fecha]);
  const total       = hoyTareas.length;

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
      <div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--text3);">
          ${nombreDia} · ${fmtFecha(fecha)}
        </div>
        <div style="font-size:18px;font-weight:700;color:var(--text);margin-top:3px;">
          Tareas de hoy
          ${total > 0 ? `<span class="tarea-counter">${completadas.length}/${total} completadas</span>` : ''}
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openModalTarea()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nueva tarea
      </button>
    </div>

    ${total === 0 ? `
      <div class="card" style="text-align:center;padding:48px 24px;color:var(--text3);">
        <div style="margin-bottom:12px;opacity:.3;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </div>
        <div style="font-size:14px;font-weight:600;margin-bottom:4px;">Sin tareas para hoy</div>
        <div style="font-size:12px;">Registra una nueva tarea o agenda una tarea recurrente para este día.</div>
      </div>
    ` : `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;" id="tareas-hoy-list">
        ${hoyTareas.map(t => _renderTareaItem(t, fecha)).join('')}
      </div>
    `}

    <!-- Próximas recurrentes (otros días) -->
    ${_renderProximas(tareas, hoy, fecha)}
  `;
}

function _renderTareaItem(t, fecha) {
  const done = !!(t.completadas || {})[fecha];
  const esPuntual = t.tipo === 'puntual';
  return `
    <div class="tarea-item-card ${done ? 'tarea-done' : ''}" id="tarea-card-${t.id}">
      <!-- Checkbox animado -->
      <button class="tarea-checkbox ${done ? 'checked' : ''}"
        onclick="_toggleTarea('${t.id}','${fecha}')"
        title="${done ? 'Marcar pendiente' : 'Marcar completada'}">
        <svg class="tarea-check-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
      <!-- Contenido -->
      <div style="flex:1;min-width:0;">
        <div class="tarea-nombre ${done ? 'tarea-nombre-done' : ''}">${t.nombre}</div>
        ${t.descripcion ? `<div style="font-size:11px;color:var(--text3);margin-top:2px;">${t.descripcion}</div>` : ''}
        <div style="display:flex;align-items:center;gap:8px;margin-top:5px;">
          ${esPuntual
            ? `<span style="font-size:10px;background:#e0f2f1;color:var(--teal);padding:1px 8px;border-radius:20px;font-weight:600;border:1px solid #b2dfdb;">Solo hoy</span>`
            : `<span style="font-size:10px;color:var(--text3);">${(t.dias||[]).map(d=>_DIAS_SHORT[d]).join(' · ')}</span>`
          }
        </div>
      </div>
      <!-- Acciones -->
      <div style="display:flex;gap:4px;flex-shrink:0;">
        <button class="btn btn-ghost btn-icon btn-sm" onclick="openModalTarea('${t.id}')" title="Editar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="_confirmarDeleteTarea('${t.id}')" title="Eliminar"
          style="color:var(--red);" onmouseover="this.style.background='var(--red-bg)'" onmouseout="this.style.background=''">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </div>
    </div>`;
}

function _renderProximas(tareas, hoyDia, fechaHoy) {
  const recurrentes = tareas.filter(t => t.tipo === 'recurrente' && Array.isArray(t.dias));
  if (!recurrentes.length) return '';

  // Agrupar por día (excluyendo hoy)
  const porDia = {};
  recurrentes.forEach(t => {
    t.dias.forEach(d => {
      if (d === hoyDia) return;
      if (!porDia[d]) porDia[d] = [];
      porDia[d].push(t);
    });
  });

  const dias = Object.keys(porDia).map(Number).sort((a,b) => {
    const diff = (d) => (d - hoyDia + 7) % 7 || 7;
    return diff(a) - diff(b);
  });

  if (!dias.length) return '';

  return `
    <div style="margin-top:28px;">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:14px;">
        Tareas recurrentes — resto de la semana
      </div>
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
                    <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.nombre}</div>
                    ${t.descripcion ? `<div style="font-size:10px;color:var(--text3);margin-top:1px;">${t.descripcion}</div>` : ''}
                  </div>
                  <button class="btn btn-ghost btn-icon btn-sm" onclick="openModalTarea('${t.id}')" title="Editar" style="flex-shrink:0;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
}

// ══ TOGGLE COMPLETADA ══
async function _toggleTarea(id, fecha) {
  _tareaSpinner(true);
  const tareas = await _getTareas();
  const t = tareas.find(x => x.id === id);
  if (!t) return;
  if (!t.completadas) t.completadas = {};
  const nowDone = !t.completadas[fecha];
  t.completadas[fecha] = nowDone;

  // Animate immediately without full re-render
  const card     = document.getElementById('tarea-card-' + id);
  const checkbox = card?.querySelector('.tarea-checkbox');
  const nombre   = card?.querySelector('.tarea-nombre');
  if (card && checkbox && nombre) {
    checkbox.classList.toggle('checked', nowDone);
    nombre.classList.toggle('tarea-nombre-done', nowDone);
    card.classList.toggle('tarea-done', nowDone);
  }

  await _saveTarea(t);
  _tareaSpinner(false);
  // Update counter only
  const hoyTareas = tareas.filter(tt =>
    (tt.tipo==='recurrente' && (tt.dias||[]).includes(new Date().getDay())) ||
    (tt.tipo==='puntual' && tt.fecha === fecha)
  );
  const completadas = hoyTareas.filter(tt => !!(tt.completadas||{})[fecha]).length;
  const counterEl = document.querySelector('#tareas-container .tarea-counter');
  if (counterEl) counterEl.textContent = completadas + '/' + hoyTareas.length + ' completadas';
}

// ══ MODAL NUEVA/EDITAR TAREA ══
var _editTareaId = null;

function openModalTarea(id) {
  _editTareaId = id || null;
  document.getElementById('tarea-nombre').value = '';
  document.getElementById('tarea-descripcion').value = '';
  document.getElementById('tarea-tipo-recurrente').checked = true;
  document.getElementById('tarea-fecha-wrap').style.display = 'none';
  document.getElementById('tarea-dias-wrap').style.display = 'block';
  document.getElementById('tarea-fecha').value = _fechaHoy();
  document.getElementById('tarea-err').textContent = '';
  document.getElementById('modal-tarea-title').textContent = id ? 'Editar tarea' : 'Nueva tarea';

  // Deselect all dias
  document.querySelectorAll('.tarea-dia-btn').forEach(b => b.classList.remove('active'));

  if (id) {
    _getTareas().then(tareas => {
      const t = tareas.find(x => x.id === id);
      if (!t) return;
      document.getElementById('tarea-nombre').value = t.nombre || '';
      document.getElementById('tarea-descripcion').value = t.descripcion || '';
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
    // Pre-seleccionar día de hoy
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

function _toggleDiaBtn(btn) {
  btn.classList.toggle('active');
}

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
    tipo:        esPuntual ? 'puntual' : 'recurrente',
    dias:        esPuntual ? [] : dias,
    fecha:       esPuntual ? document.getElementById('tarea-fecha').value : '',
    completadas: {},
    creado:      new Date().toISOString(),
  };

  // Conservar completadas si es edición
  if (_editTareaId) {
    const tareas = await _getTareas();
    const old = tareas.find(x => x.id === _editTareaId);
    if (old?.completadas) t.completadas = old.completadas;
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