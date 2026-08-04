/* Módulo Configuración */

// ── CONFIGURACIÓN ──
window._sessionTimerInterval = window._sessionTimerInterval || null;

async function renderConfiguracion() {
  // Renderizar tiendas en el nuevo grid de configuración
  await renderUsuarios();
  if (typeof _loadCfgAvatar === 'function') _loadCfgAvatar();
  const tiendas   = await DB.tiendas();
  const ventas    = await DB.ventas();
  const saldos    = await DB.saldos();
  const problemas = await DB.problemas();
  const gridEl    = document.getElementById('cfg-tiendas-grid');

  if(!tiendas.length) {
    gridEl.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px;">
      Sin tiendas registradas. Crea tu primera tienda.</div>`;
  } else {
    gridEl.innerHTML = tiendas.map(t=>{
      const tv      = ventas.filter(v=>v.tienda_id===t.id);
      const gan     = tv.reduce((s,v)=>s+calcVenta(v).ganancia,0);
      const isActive= t.estado !== 'inactiva';
      const reclamos   = problemas.filter(p=>p.tienda_id===t.id && p.tipo==='reclamo').length;
      const canceladas = tv.filter(v=>v.estado==='cancelado').length;
      const tid = 'trow_' + t.id;
      const logo = t.foto
        ? `<img src="${t.foto}" style="width:36px;height:36px;border-radius:8px;object-fit:cover;flex-shrink:0;">`
        : `<div style="width:36px;height:36px;border-radius:8px;background:${t.color||'var(--teal)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
           </div>`;
      return `
      <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;border-left:3px solid ${t.color||'var(--teal)'};background:var(--white);opacity:${isActive?1:.65};">
        <!-- Row header — always visible -->
        <div onclick="_toggleTiendaRow('${tid}')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;-webkit-tap-highlight-color:transparent;">
          ${logo}
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.nombre}</div>
            <div style="font-size:11px;color:var(--text3);">${t.responsable||'—'}</div>
          </div>
          <span style="font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;flex-shrink:0;letter-spacing:.4px;background:${isActive?'#dcfce7':'#fee2e2'};color:${isActive?'#15803d':'#b91c1c'};">
            ${isActive?'ACTIVA':'INACTIVA'}
          </span>
          <svg id="${tid}_chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;transition:transform .2s;"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <!-- Expandable detail -->
        <div id="${tid}" style="display:none;padding:0 14px 14px;border-top:1px solid var(--border);">
          <div style="display:flex;gap:8px;margin-top:12px;margin-bottom:10px;">
            <div style="flex:1;padding:9px 12px;background:var(--bg);border-radius:8px;text-align:center;">
              <div style="font-size:9px;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);font-weight:600;margin-bottom:4px;">Ventas</div>
              <div style="font-size:18px;font-weight:700;color:var(--text);">${tv.length}</div>
            </div>
            <div style="flex:2;padding:9px 12px;background:var(--bg);border-radius:8px;text-align:center;">
              <div style="font-size:9px;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);font-weight:600;margin-bottom:4px;">Ganancia</div>
              <div style="font-size:15px;font-weight:700;color:${gan>=0?'var(--green)':'var(--red)'};">${fmt(gan)}</div>
            </div>
          </div>
          ${(reclamos>0||canceladas>0)?`
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
            ${reclamos>0?`<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:#fee2e2;color:#b91c1c;">${reclamos} reclamo${reclamos>1?'s':''}</span>`:''}
            ${canceladas>0?`<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:#fef9c3;color:#92400e;">${canceladas} cancelada${canceladas>1?'s':''}</span>`:''}
          </div>`:''}
          <div style="display:flex;gap:8px;">
            <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="openModalTienda('${t.id}')">Editar</button>
            <button class="btn btn-ghost btn-sm" style="color:${isActive?'var(--red)':'var(--green)'};" onclick="_pedirCodigoToggleTienda('${t.id}')">
              ${isActive?'Desactivar':'Activar'}
            </button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // Actualizar info de sesión y arrancar timer
  _updateSessionInfo();
  if(window._sessionTimerInterval) clearInterval(_sessionTimerInterval);
  window._sessionTimerInterval = setInterval(_updateSessionInfo, 1000);

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
      expEl.textContent = 'Sesión expirada — cerrando sesión...';
      expEl.style.color = 'var(--red)';
      clearInterval(window._sessionTimerInterval);
      window._sessionTimerInterval = null;
      setTimeout(() => {
        localStorage.removeItem('mm_session');
        if (typeof _detenerListeners === 'function') _detenerListeners();
        window.location.href = 'index.html';
      }, 2000);
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

  const MODULOS_LABEL = {ventas:'Ventas',envios:'Envíos',problemas:'Pendientes',ayudas:'Ayudas',finanzas:'Finanzas',tareas:'Tareas'};

  // Cargar fotos de perfil de cada usuario
  const fotos = {};
  await Promise.all(usuarios.map(async u => {
    try {
      const snap = await _db.collection(`usuarios/${u.uid}/config`).doc('perfil').get();
      if (snap.exists && snap.data().foto) fotos[u.uid] = snap.data().foto;
    } catch(e) {}
  }));

  el.innerHTML = usuarios.map(u => {
    const activo = u.activo !== false;
    const permisos = u.permisos || {ventas:true,envios:true,problemas:true,ayudas:true,tareas:true};
    const permPills = Object.entries(MODULOS_LABEL).map(([key,label]) => {
      const tiene = permisos[key] !== false;
      return `<span style="font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;background:${tiene?'#dbeafe':'#f3f4f6'};color:${tiene?'#1e40af':'#9ca3af'};border:1px solid ${tiene?'#93c5fd':'#e5e7eb'};">${label}</span>`;
    }).join('');
    const avatarInner = fotos[u.uid]
      ? `<img src="${fotos[u.uid]}" style="width:100%;height:100%;object-fit:cover;">`
      : `<span style="font-size:14px;font-weight:700;">${(u.nombre||u.usuario||'?').charAt(0).toUpperCase()}</span>`;
    return `
    <div style="border:1px solid var(--border);border-radius:10px;background:var(--white);overflow:hidden;margin-bottom:6px;">
      <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;">
        <div style="width:38px;height:38px;border-radius:50%;background:${activo?'#1a4fa8':'#6b7280'};display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;overflow:hidden;border:2px solid var(--border);">
          ${avatarInner}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;color:var(--text);">${u.nombre||'—'}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:1px;">
            @${u.usuario||u.uid} ·
            <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:8px;background:${u.rol==='colaborador'?'#fef3c7':'#dbeafe'};color:${u.rol==='colaborador'?'#92400e':'#1e40af'};">${u.rol==='colaborador'?'Colaborador':'Usuario'}</span> ·
            ${activo?'<span style="color:#065f46;font-weight:600;">Activo</span>':'<span style="color:#7f1d1d;font-weight:600;">Inactivo</span>'}
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="openModalCrearUsuario('${u.uid}')" style="font-size:11px;padding:4px 9px;">Editar</button>
        <button class="btn btn-ghost btn-sm" onclick="_toggleUsuario('${u.uid}',${!activo})"
          style="color:${activo?'var(--red)':'var(--green)'};font-size:11px;padding:4px 9px;">
          ${activo?'Desactivar':'Activar'}
        </button>
      </div>
      ${u.rol==='colaborador'?`<div style="padding:6px 14px 10px;border-top:1px solid var(--border);display:flex;gap:5px;flex-wrap:wrap;">${permPills}</div>`:''}
    </div>`;
  }).join('');
}

function openModalCrearUsuario(uid = null) {
  const isEdit = !!uid;
  document.getElementById('nu-modal-title').textContent = isEdit ? 'Editar usuario' : 'Nuevo usuario';
  document.getElementById('nu-nombre').value = '';
  document.getElementById('nu-usuario').value = '';
  document.getElementById('nu-pass').value = '';
  document.getElementById('nu-error').textContent = '';
  document.getElementById('nu-btn').textContent = isEdit ? 'Guardar cambios' : 'Crear usuario';
  document.getElementById('nu-btn').onclick = isEdit ? () => editarUsuario(uid) : crearUsuario;
  document.getElementById('nu-btn').disabled = false;
  // Reset role selector
  const rolEl = document.getElementById('nu-rol');
  if (rolEl) rolEl.value = 'usuario';
  const permsWrap = document.getElementById('nu-permisos-wrap');
  if (permsWrap) permsWrap.style.display = 'block';
  // Reset checkboxes to default (all on except finanzas)
  ['ventas','envios','problemas','ayudas','tareas'].forEach(m => {
    const el = document.getElementById('nu-p-' + m);
    if (el) el.checked = true;
  });
  const finEl = document.getElementById('nu-p-finanzas');
  if (finEl) finEl.checked = false;
  // Hide pass field when editing
  const passWrap = document.getElementById('nu-pass-wrap');
  if (passWrap) passWrap.style.display = isEdit ? 'none' : '';

  if (isEdit) {
    // Load existing user data
    DB.getUsuarios().then(usuarios => {
      const u = usuarios.find(x => x.uid === uid);
      if (!u) return;
      document.getElementById('nu-nombre').value = u.nombre || '';
      document.getElementById('nu-usuario').value = u.usuario || '';
      if (rolEl) { rolEl.value = u.rol === 'colaborador' ? 'colaborador' : 'usuario'; _toggleColaboradorPerms(); }
      const perms = u.permisos || {};
      ['ventas','envios','problemas','ayudas','tareas','finanzas'].forEach(m => {
        const el = document.getElementById('nu-p-' + m);
        if (el) el.checked = perms[m] !== false;
      });
    });
  }
  window._editUsuarioUid = isEdit ? uid : null;
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

    // Leer permisos seleccionados
    const permisos = {};
    ['ventas','envios','problemas','ayudas','tareas','finanzas'].forEach(m => {
      const el = document.getElementById('nu-p-' + m);
      permisos[m] = el ? el.checked : true;
    });

    const rolSeleccionado = document.getElementById('nu-rol')?.value || 'usuario';
    const datosUsuario = { uid, usuario, nombre, rol: rolSeleccionado, activo:true, hash, permisos };
    await DB.crearUsuario(datosUsuario);

    closeModal('modal-crear-usuario');
    await renderUsuarios();
    showToast(`Usuario "@${usuario}" creado correctamente`, 'success');
  } catch(e) {
    errEl.textContent = 'Error al crear el usuario.';
    console.error(e);
    btn.textContent = 'Crear usuario'; btn.disabled = false;
  }
}

var _pendingToggleUid = null;
var _pendingToggleActivo = null;

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

function _toggleTiendaRow(id) {
  const el = document.getElementById(id);
  const chev = document.getElementById(id + '_chev');
  if (!el) return;
  const open = el.style.display === 'none' || el.style.display === '';
  el.style.display = open ? 'block' : 'none';
  if (chev) chev.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
}

async function editarUsuario(uid) {
  const nombre  = document.getElementById('nu-nombre').value.trim();
  const errEl   = document.getElementById('nu-error');
  const btn     = document.getElementById('nu-btn');
  errEl.textContent = '';
  if (!nombre) { errEl.textContent = 'El nombre es requerido.'; return; }
  btn.textContent = 'Guardando...'; btn.disabled = true;
  try {
    const permisos = {};
    ['ventas','envios','problemas','ayudas','tareas','finanzas'].forEach(m => {
      const el = document.getElementById('nu-p-' + m);
      permisos[m] = el ? el.checked : true;
    });
    await _db.collection('usuarios').doc(uid).update({ nombre, permisos });
    closeModal('modal-crear-usuario');
    await renderUsuarios();
    showToast('Usuario actualizado', 'success');
  } catch(e) {
    errEl.textContent = 'Error al actualizar.';
    btn.textContent = 'Guardar cambios'; btn.disabled = false;
  }
}

function _toggleColaboradorPerms() {
  // Los permisos de módulos aplican a cualquier rol (colaborador o independiente),
  // así que el panel se mantiene siempre visible.
  const wrap = document.getElementById('nu-permisos-wrap');
  if (wrap) wrap.style.display = 'block';
}