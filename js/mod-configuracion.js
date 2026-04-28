/* Módulo Configuración */

// ── CONFIGURACIÓN ──
let _sessionTimerInterval = null;

async function renderConfiguracion() {
  // Renderizar tiendas en el nuevo grid de configuración
  await renderUsuarios();
  const tiendas   = await DB.tiendas();
  const ventas    = await DB.ventas();
  const saldos    = await DB.saldos();
  const problemas = await DB.problemas();
  const gridEl    = document.getElementById('cfg-tiendas-grid');

  if(!tiendas.length) {
    gridEl.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-title" style="margin-bottom:6px;">Sin tiendas registradas</div>
      <div class="c-dim" style="font-size:12px;">Crea tu primera tienda desde el botón superior</div></div>`;
  } else {
    gridEl.innerHTML = tiendas.map(t=>{
      const tv      = ventas.filter(v=>v.tienda_id===t.id);
      const gan     = tv.reduce((s,v)=>s+calcVenta(v).ganancia,0);
      const isActive= t.estado !== 'inactiva';
      const mpKey   = 'mercadopago_' + t.id;
      const mpSaldo = parseFloat(saldos[mpKey]) || 0;
      const reclamos   = problemas.filter(p=>p.tienda_id===t.id && p.tipo==='reclamo').length;
      const canceladas = tv.filter(v=>v.estado==='cancelado').length;
      const fotoEl = t.foto
        ? `<img src="${t.foto}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;flex-shrink:0;">`
        : `<div style="width:48px;height:48px;border-radius:8px;background:${t.color};
             display:flex;align-items:center;justify-content:center;flex-shrink:0;">
             <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
             </svg>
           </div>`;
      return `
      <div style="background:#fff;border:1px solid var(--border);border-radius:14px;overflow:hidden;
                  box-shadow:var(--shadow);opacity:${isActive?1:.55};transition:box-shadow .15s;border-top:3px solid ${t.color};"
           onmouseover="this.style.boxShadow='0 4px 18px rgba(0,0,0,.1)'" onmouseout="this.style.boxShadow='var(--shadow)'">

        <div style="padding:18px 20px 16px;">

          <!-- Avatar + nombre + estado -->
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
            ${fotoEl}
            <div style="flex:1;min-width:0;">
              <div style="font-size:16px;font-weight:700;color:var(--text);letter-spacing:-.2px;
                          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.nombre}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:3px;">${t.responsable||'Sin responsable'}</div>
            </div>
            <span style="font-size:9px;font-weight:700;padding:4px 10px;border-radius:20px;flex-shrink:0;letter-spacing:.5px;
              background:${isActive?'#dcfce7':'#fee2e2'};color:${isActive?'#15803d':'#b91c1c'};">
              ${isActive?'ACTIVA':'INACTIVA'}
            </span>
          </div>

          <!-- Métricas: solo ventas y ganancia, sin saldo MP -->
          <div style="display:flex;gap:10px;margin-bottom:${(reclamos>0||canceladas>0)?14:18}px;">
            <div style="flex:1;padding:10px 14px;background:#f8fafc;border-radius:8px;border:1px solid var(--border);">
              <div style="font-size:9px;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);font-weight:600;margin-bottom:5px;">Ventas</div>
              <div style="font-size:22px;font-weight:700;color:var(--text);line-height:1;">${tv.length}</div>
            </div>
            <div style="flex:2;padding:10px 14px;background:#f8fafc;border-radius:8px;border:1px solid var(--border);">
              <div style="font-size:9px;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);font-weight:600;margin-bottom:5px;">Ganancia del período</div>
              <div style="font-size:16px;font-weight:700;color:${gan>=0?'var(--green)':'var(--red)'};line-height:1;">${fmt(gan)}</div>
            </div>
          </div>

          <!-- Alertas -->
          ${(reclamos>0||canceladas>0)?`
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">
            ${reclamos>0?`<span style="font-size:10px;font-weight:600;padding:3px 9px;border-radius:20px;background:#fee2e2;color:#b91c1c;">${reclamos} reclamo${reclamos>1?'s':''}</span>`:''}
            ${canceladas>0?`<span style="font-size:10px;font-weight:600;padding:3px 9px;border-radius:20px;background:#fef9c3;color:#92400e;">${canceladas} cancelación${canceladas>1?'es':''}</span>`:''}
          </div>`:''}

          <!-- Acciones -->
          <div style="display:flex;gap:8px;">
            <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="openModalTienda('${t.id}')">Editar</button>
            <button class="btn btn-ghost btn-sm" style="color:${isActive?'var(--red)':'var(--green)'};"
              onclick="_pedirCodigoToggleTienda('${t.id}')">
              ${isActive?'Desactivar':'Activar'}
            </button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // Actualizar info de sesión y arrancar timer
  _updateSessionInfo();
  if(_sessionTimerInterval) clearInterval(_sessionTimerInterval);
  _sessionTimerInterval = setInterval(_updateSessionInfo, 1000);

  // Cargar el dólar fijo desde BD y mostrarlo en el campo
  await cargarDolarComprasEnConfig();
}

function _updateSessionInfo() {
  const tsStart = _getSessionStart();
  const timeEl  = document.getElementById('cfg-session-time');
  const expEl   = document.getElementById('cfg-session-expiry');
  if(!timeEl) return;
  if(!tsStart) { timeEl.textContent = '—'; if(expEl) expEl.textContent = 'Sin sesión activa'; return; }

  const elapsed = Date.now() - tsStart;
  const _TTL = 8 * 60 * 60 * 1000;
  const remaining = _TTL - elapsed;
  const toHMS = ms => {
    const s = Math.floor(ms/1000);
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    const sec = s%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };
  timeEl.textContent = toHMS(elapsed);
  if(expEl) {
    if(remaining > 0) {
      expEl.textContent = `Sesión válida por ${toHMS(remaining)} más`;
    } else {
      expEl.textContent = 'Sesión expirada — por favor vuelve a ingresar';
      expEl.style.color = 'var(--red)';
    }
  }
}

function openModalCambiarCodigo() {
  sv('cc-actual',''); sv('cc-nuevo',''); sv('cc-confirmar','');
  document.getElementById('cc-error').textContent = '';
  openModal('modal-cambiar-codigo');
}

async function guardarNuevoCodigo() {
  const actual    = document.getElementById('cc-actual').value;
  const nuevo     = document.getElementById('cc-nuevo').value;
  const confirmar = document.getElementById('cc-confirmar').value;
  const errEl     = document.getElementById('cc-error');
  errEl.textContent = '';

  if(!actual || !nuevo || !confirmar) { errEl.textContent = 'Completa todos los campos.'; return; }
  if(nuevo.length < 4) { errEl.textContent = 'El nuevo código debe tener al menos 4 caracteres.'; return; }
  if(nuevo !== confirmar) { errEl.textContent = 'El nuevo código y la confirmación no coinciden.'; return; }

  try {
    const snap = await _getAuthDoc();
    if(!snap.exists) { errEl.textContent = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> No hay código configurado en la BD.'; return; }
    const hashGuardado = snap.data().hash;
    const hashActual   = await _hashCode(actual);
    if(hashActual !== hashGuardado) { errEl.textContent = 'El código actual es incorrecto.'; return; }
    const hashNuevo = await _hashCode(nuevo);
    await _setAuthHash(hashNuevo);
    closeModal('modal-cambiar-codigo');
    alert('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Código actualizado correctamente.');
  } catch(e) {
    errEl.textContent = 'Error al conectar con Firebase.';
    console.error(e);
  }
}


// ══════════════════════════════════════════════════════════
// GESTIÓN DE USUARIOS (solo admin)
// ══════════════════════════════════════════════════════════
async function renderUsuarios() {
  const card = document.getElementById('cfg-usuarios-card');
  if (!card) return;

  // Solo mostrar si es admin
  const sesion = _getSession();
  if (!sesion || sesion.rol !== 'admin') { card.style.display = 'none'; return; }
  card.style.display = 'block';

  const usuarios = await DB.getUsuarios();
  const el = document.getElementById('cfg-usuarios-grid');
  if (!el) return;

  if (!usuarios.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">Aún no hay usuarios creados.</div>';
    return;
  }

  el.innerHTML = usuarios.map(u => {
    const activo = u.activo !== false;
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:var(--white);">
      <div style="width:34px;height:34px;border-radius:50%;background:${activo?'#1a4fa8':'#6b7280'};display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;font-size:13px;font-weight:700;">
        ${(u.nombre||u.usuario||'?').charAt(0).toUpperCase()}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:var(--text);">${u.nombre||'—'}</div>
        <div style="font-size:11px;color:var(--text3);">@${u.usuario||u.uid} · ${activo?'<span style="color:#065f46;font-weight:600;">Activo</span>':'<span style="color:#7f1d1d;font-weight:600;">Inactivo</span>'}</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="_toggleUsuario('${u.uid}',${!activo})"
        style="color:${activo?'var(--red)':'var(--green)'};">
        ${activo?'Desactivar':'Activar'}
      </button>
    </div>`;
  }).join('');
}

function openModalCrearUsuario() {
  document.getElementById('nu-nombre').value = '';
  document.getElementById('nu-usuario').value = '';
  document.getElementById('nu-pass').value = '';
  document.getElementById('nu-error').textContent = '';
  document.getElementById('nu-btn').textContent = 'Crear usuario';
  document.getElementById('nu-btn').disabled = false;
  openModal('modal-crear-usuario');
}

async function crearUsuario() {
  const nombre  = document.getElementById('nu-nombre').value.trim();
  const usuario = document.getElementById('nu-usuario').value.trim().toLowerCase();
  const pass    = document.getElementById('nu-pass').value;
  const errEl   = document.getElementById('nu-error');
  const btn     = document.getElementById('nu-btn');
  errEl.textContent = '';

  if (!nombre)         { errEl.textContent = 'El nombre es requerido.'; return; }
  if (!usuario)        { errEl.textContent = 'El usuario es requerido.'; return; }
  if (usuario === 'admin') { errEl.textContent = 'El nombre "admin" está reservado.'; return; }
  if (pass.length < 6) { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }

  btn.textContent = 'Creando...'; btn.disabled = true;

  try {
    // Verificar que no exista ese usuario
    const existing = await _db.collection('usuarios').where('usuario','==',usuario).limit(1).get();
    if (!existing.empty) { errEl.textContent = 'Ese nombre de usuario ya existe.'; btn.textContent='Crear usuario'; btn.disabled=false; return; }

    const uid  = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
    const hash = await _hashCode(pass);

    await DB.crearUsuario({ uid, usuario, nombre, rol:'usuario', activo:true, hash });

    closeModal('modal-crear-usuario');
    await renderUsuarios();
    showToast(`Usuario "@${usuario}" creado correctamente`, 'success');
  } catch(e) {
    errEl.textContent = 'Error al crear el usuario.';
    console.error(e);
    btn.textContent = 'Crear usuario'; btn.disabled = false;
  }
}

let _pendingToggleUid = null;
let _pendingToggleActivo = null;

function _toggleUsuario(uid, activo) {
  // Activar no requiere código, solo desactivar
  if (!activo) {
    // Desactivando — pedir código
    _pendingToggleUid    = uid;
    _pendingToggleActivo = activo;
    const inp = document.getElementById('toggle-user-code-input');
    const err = document.getElementById('toggle-user-code-error');
    if (inp) inp.value = '';
    if (err) err.textContent = '';
    openModal('modal-toggle-usuario');
    setTimeout(() => inp && inp.focus(), 150);
  } else {
    // Activando — directo
    DB.toggleUsuario(uid, activo).then(() => {
      renderUsuarios();
      showToast('Usuario activado', 'success');
    });
  }
}

async function _confirmToggleUsuario() {
  const inp  = document.getElementById('toggle-user-code-input');
  const err  = document.getElementById('toggle-user-code-error');
  const btn  = document.getElementById('toggle-user-confirm-btn');
  const code = inp?.value.trim() || '';
  if (!code) { if (err) err.textContent = 'Ingresa el código.'; return; }
  if (btn) { btn.textContent = 'Verificando...'; btn.disabled = true; }
  try {
    const ok = await _verificarCodigoAcceso(code);
    if (!ok) {
      if (err) err.textContent = 'Código incorrecto.';
      if (inp) { inp.value = ''; inp.focus(); }
      return;
    }
    closeModal('modal-toggle-usuario');
    await DB.toggleUsuario(_pendingToggleUid, _pendingToggleActivo);
    _pendingToggleUid = null; _pendingToggleActivo = null;
    await renderUsuarios();
    showToast('Usuario desactivado', 'success');
  } catch(e) {
    if (err) err.textContent = 'Error al verificar.';
    console.error(e);
  } finally {
    if (btn) { btn.textContent = 'Desactivar'; btn.disabled = false; }
  }
}