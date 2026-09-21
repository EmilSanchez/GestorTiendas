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
        <div onclick="_toggleTiendaRow('${tid}')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:default;-webkit-tap-highlight-color:transparent;">
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

  // Cargar la billetera predeterminada para envíos externos
  if (typeof cargarBilleteraDefaultEnConfig === 'function') await cargarBilleteraDefaultEnConfig();
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
// GESTIÓN DE USUARIOS (solo admin) — pestaña "Usuarios"
// ══════════════════════════════════════════════════════════

// Cambia entre la pestaña "General" y "Usuarios" dentro de Configuración
function _cfgTab(tab) {
  const sesion = _getSession();
  if (tab === 'usuarios' && (!sesion || sesion.rol !== 'admin')) tab = 'general';

  const bodyGeneral  = document.getElementById('cfg-tab-general');
  const bodyUsuarios = document.getElementById('cfg-tab-usuarios');
  const btnGeneral   = document.getElementById('cfg-tab-btn-general');
  const btnUsuarios  = document.getElementById('cfg-tab-btn-usuarios');
  if (!bodyGeneral || !bodyUsuarios) return;

  const isGeneral = tab === 'general';
  bodyGeneral.style.display  = isGeneral ? '' : 'none';
  bodyUsuarios.style.display = isGeneral ? 'none' : '';
  if (btnGeneral) {
    btnGeneral.style.borderBottomColor = isGeneral ? 'var(--teal)' : 'transparent';
    btnGeneral.style.color = isGeneral ? 'var(--teal)' : 'var(--text2)';
  }
  if (btnUsuarios) {
    btnUsuarios.style.borderBottomColor = !isGeneral ? 'var(--teal)' : 'transparent';
    btnUsuarios.style.color = !isGeneral ? 'var(--teal)' : 'var(--text2)';
  }
  if (!isGeneral) renderUsuarios();
}

// Formatea un timestamp (ms) como "Hace un momento / Hace X min / Hace X h / Hace X día(s)"
function _tiempoRelativo(ts) {
  if (!ts) return 'Nunca';
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return 'Hace un momento';
  const min = Math.floor(diffMs / 60000);
  if (min < 1)  return 'Hace un momento';
  if (min < 60) return `Hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `Hace ${dias} día${dias!==1?'s':''}`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `Hace ${meses} mes${meses!==1?'es':''}`;
  const anios = Math.floor(meses / 12);
  return `Hace ${anios} año${anios!==1?'s':''}`;
}

// Formatea un timestamp (ms) como "19 de septiembre de 2026 · 10:44 a. m."
function _fmtFechaHora(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const fecha = d.toLocaleDateString('es-CO', {day:'numeric', month:'long', year:'numeric'});
  const hora  = d.toLocaleTimeString('es-CO', {hour:'numeric', minute:'2-digit', hour12:true});
  return `${fecha} · ${hora}`;
}

// Formatea una duración en ms como HH:MM:SS
function _fmtDuracion(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

// Determina si un usuario está actualmente conectado, a partir de su último
// evento en `accesos` (ingreso/salida). Usa el mismo TTL de 8h que las
// sesiones, para que una sesión nunca cerrada explícitamente pero ya vencida
// se muestre como desconectada.
function _usrEstadoConexion(uid) {
  const eventos = (typeof _cache !== 'undefined' && _cache.accesos) || [];
  const ultimo = eventos.find(e => e.uid === uid);
  if (!ultimo || ultimo.tipo === 'salida') return { conectado:false, desde:null };
  const TTL = 8*60*60*1000;
  if (Date.now() - ultimo.ts >= TTL) return { conectado:false, desde:null };
  return { conectado:true, desde:ultimo.ts };
}

var _usrTablaData = [];

async function renderUsuarios() {
  const sesion = _getSession();
  const tabBtn = document.getElementById('cfg-tab-btn-usuarios');
  const esAdmin = !!sesion && sesion.rol === 'admin';
  if (tabBtn) tabBtn.style.display = esAdmin ? '' : 'none';
  if (!esAdmin) return;

  // Cuenta principal (admin)
  let adminPerfil = {};
  try {
    const snap = await _db.collection('config').doc('perfil').get();
    if (snap.exists) adminPerfil = snap.data() || {};
  } catch(e) {}

  const usuarios = await DB.getUsuarios();

  // Cargar fotos de perfil de cada usuario
  const fotos = {};
  await Promise.all(usuarios.map(async u => {
    try {
      const snap = await _db.collection(`usuarios/${u.uid}/config`).doc('perfil').get();
      if (snap.exists && snap.data().foto) fotos[u.uid] = snap.data().foto;
    } catch(e) {}
  }));

  const filaAdmin = {
    uid: 'admin', esAdmin: true,
    nombre: adminPerfil.nombre || sesion.nombre || 'Administrador',
    usuario: 'admin', rol: 'admin', activo: true,
    ultimo_ingreso: adminPerfil.ultimo_ingreso || sesion.ts || null,
    foto: adminPerfil.foto || null,
  };

  const filasUsuarios = usuarios.map(u => ({
    uid: u.uid, esAdmin: false,
    nombre: u.nombre || u.usuario || '—',
    usuario: u.usuario || u.uid,
    rol: u.rol || 'usuario',
    activo: u.activo !== false,
    ultimo_ingreso: u.ultimo_ingreso || null,
    foto: fotos[u.uid] || null,
  }));

  _usrTablaData = [filaAdmin, ...filasUsuarios];
  _renderTablaUsuarios();
}

const _USR_AVATAR_COLORS = ['#1a4fa8','#00897b','#7c3aed','#dc2626','#d97706','#0891b2','#be185d','#4d7c0f'];
function _usrAvatarColor(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return _USR_AVATAR_COLORS[h % _USR_AVATAR_COLORS.length];
}

function _renderTablaUsuarios() {
  const bodyEl  = document.getElementById('usr-tabla-body');
  const vacioEl = document.getElementById('usr-tabla-vacio');
  const countEl = document.getElementById('usr-tabla-count');
  if (!bodyEl) return;

  const q = (document.getElementById('usr-buscar')?.value || '').trim().toLowerCase();
  const filtroEstado = document.getElementById('usr-filtro-estado')?.value || '';

  let filas = _usrTablaData.filter(u => {
    if (q && !(`${u.nombre} ${u.usuario}`.toLowerCase().includes(q))) return false;
    if (filtroEstado === 'activo'   && !u.activo) return false;
    if (filtroEstado === 'inactivo' && u.activo)  return false;
    return true;
  });

  // Orden: cuenta principal primero, luego activos por último ingreso (más reciente primero),
  // luego desactivados al final.
  filas = filas.slice().sort((a, b) => {
    if (a.esAdmin !== b.esAdmin) return a.esAdmin ? -1 : 1;
    if (a.activo !== b.activo)   return a.activo ? -1 : 1;
    return (b.ultimo_ingreso || 0) - (a.ultimo_ingreso || 0);
  });

  if (!filas.length) {
    bodyEl.innerHTML = '';
    if (vacioEl) vacioEl.style.display = '';
  } else {
    if (vacioEl) vacioEl.style.display = 'none';
    bodyEl.innerHTML = filas.map(u => {
      const avatarInner = u.foto
        ? `<img src="${u.foto}" style="width:100%;height:100%;object-fit:cover;">`
        : `<span style="font-size:13px;color:#fff;">${(u.nombre||'?').charAt(0).toUpperCase()}</span>`;
      const rolLabel = u.esAdmin ? 'Administrador' : (u.rol === 'colaborador' ? 'Colaborador' : 'Usuario');
      const rolBg    = u.esAdmin ? '#dbeafe' : (u.rol === 'colaborador' ? '#fef3c7' : '#f3f4f6');
      const rolColor = u.esAdmin ? '#1e40af' : (u.rol === 'colaborador' ? '#92400e' : '#374151');
      const dotColor = u.ultimo_ingreso && (Date.now() - u.ultimo_ingreso) < 5*60000 ? '#16a34a' : '#9ca3af';
      const estadoBg    = u.activo ? '#d1fae5' : '#fee2e2';
      const estadoColor = u.activo ? '#065f46' : '#991b1b';
      const conexion = _usrEstadoConexion(u.uid);
      const conexionHtml = conexion.conectado
        ? `<span id="usr-conn-${u.uid}" data-since="${conexion.desde}" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#16a34a;">
             <span style="width:6px;height:6px;border-radius:50%;background:#16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.15);flex-shrink:0;"></span>
             <span class="usr-conn-txt">${_fmtDuracion(Date.now()-conexion.desde)}</span>
           </span>`
        : `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text3);">
             <span style="width:6px;height:6px;border-radius:50%;background:#9ca3af;flex-shrink:0;"></span>
             Desconectado
           </span>`;
      const acciones = u.esAdmin
        ? `<span style="font-size:11px;color:var(--text3);">Cuenta principal</span>`
        : `<button class="btn btn-ghost btn-sm" onclick="openModalCrearUsuario('${u.uid}')" style="font-size:11px;padding:5px 12px;margin-right:6px;">Editar</button>
           <button class="btn btn-ghost btn-sm" onclick="_toggleUsuario('${u.uid}',${!u.activo})"
             style="font-size:11px;padding:5px 12px;color:${u.activo?'var(--red)':'var(--green)'};border-color:${u.activo?'#fca5a5':'#86efac'};">
             ${u.activo?'Desactivar':'Activar'}
           </button>`;
      return `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:11px 16px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;border-radius:50%;background:${_usrAvatarColor(u.uid)};display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">${avatarInner}</div>
            <span style="font-size:13px;color:var(--text);">${u.nombre}</span>
          </div>
        </td>
        <td style="padding:11px 16px;">
          <span style="font-size:10.5px;padding:2px 9px;border-radius:20px;background:${rolBg};color:${rolColor};">${rolLabel}</span>
        </td>
        <td style="padding:11px 16px;">
          <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text2);">
            <span style="width:6px;height:6px;border-radius:50%;background:${dotColor};flex-shrink:0;"></span>
            ${_tiempoRelativo(u.ultimo_ingreso)}
          </span>
        </td>
        <td style="padding:11px 16px;font-size:12px;color:var(--text3);">${_fmtFechaHora(u.ultimo_ingreso)}</td>
        <td style="padding:11px 16px;">${conexionHtml}</td>
        <td style="padding:11px 16px;">
          <span style="font-size:10.5px;padding:2px 9px;border-radius:20px;background:${estadoBg};color:${estadoColor};">${u.activo?'Activo':'Desactivado'}</span>
        </td>
        <td style="padding:11px 16px;text-align:right;white-space:nowrap;">${acciones}</td>
      </tr>`;
    }).join('');
  }

  if (countEl) countEl.textContent = `Mostrando ${filas.length} de ${_usrTablaData.length} usuarios`;
  _iniciarUsrUptimeTicker();
}

// Actualiza cada segundo el contador "tiempo activo" de los usuarios
// conectados, sin tener que re-renderizar toda la tabla.
function _iniciarUsrUptimeTicker() {
  if (window._usrUptimeInterval) clearInterval(window._usrUptimeInterval);
  window._usrUptimeInterval = setInterval(() => {
    const body = document.getElementById('usr-tabla-body');
    if (!body) { clearInterval(window._usrUptimeInterval); return; }
    if ((location.hash.replace('#','')||'ventas') !== 'configuracion') return;
    body.querySelectorAll('[data-since]').forEach(el => {
      const since = parseInt(el.dataset.since, 10);
      if (!since) return;
      const txt = el.querySelector('.usr-conn-txt');
      if (txt) txt.textContent = _fmtDuracion(Date.now() - since);
    });
  }, 1000);
}

// ══════════════════════════════════════════════════════════
// HISTORIAL DE INGRESOS AL SISTEMA
// ══════════════════════════════════════════════════════════
function openModalHistorialIngresos() {
  _poblarFiltroUsuarioHistorial();
  _renderHistorialIngresos();
  openModal('modal-historial-ingresos');
}

// Llena el selector de usuario del historial con los usuarios registrados
function _poblarFiltroUsuarioHistorial() {
  const sel = document.getElementById('hist-filtro-usuario');
  if (!sel) return;
  const cur = sel.value;
  const opts = [`<option value="">Todos los usuarios</option>`]
    .concat((_usrTablaData||[]).map(u => `<option value="${u.uid}">${u.nombre}</option>`));
  sel.innerHTML = opts.join('');
  if (cur && Array.from(sel.options).some(o => o.value === cur)) sel.value = cur;
}

// Limpia los filtros del historial y vuelve a mostrarlo completo
function _limpiarFiltroHistorial() {
  const sel   = document.getElementById('hist-filtro-usuario');
  const desde = document.getElementById('hist-filtro-desde');
  const hasta = document.getElementById('hist-filtro-hasta');
  if (sel)   sel.value   = '';
  if (desde) desde.value = '';
  if (hasta) hasta.value = '';
  _renderHistorialIngresos();
}

function _renderHistorialIngresos() {
  const listEl  = document.getElementById('historial-ingresos-list');
  const vacioEl = document.getElementById('historial-ingresos-vacio');
  if (!listEl) return;

  const filtroUsuario = document.getElementById('hist-filtro-usuario')?.value || '';
  const filtroDesde   = document.getElementById('hist-filtro-desde')?.value   || '';
  const filtroHasta   = document.getElementById('hist-filtro-hasta')?.value   || '';

  let eventos = _cache.accesos || [];
  if (filtroUsuario) eventos = eventos.filter(ev => ev.uid === filtroUsuario);
  if (filtroDesde) {
    const desdeTs = new Date(filtroDesde + 'T00:00:00').getTime();
    eventos = eventos.filter(ev => ev.ts >= desdeTs);
  }
  if (filtroHasta) {
    const hastaTs = new Date(filtroHasta + 'T23:59:59').getTime();
    eventos = eventos.filter(ev => ev.ts <= hastaTs);
  }

  if (!eventos.length) {
    listEl.innerHTML = '';
    if (vacioEl) { vacioEl.style.display = ''; vacioEl.textContent = (filtroUsuario||filtroDesde||filtroHasta) ? 'No hay eventos que coincidan con el filtro.' : 'Aún no hay eventos de ingreso registrados.'; }
    return;
  }
  if (vacioEl) vacioEl.style.display = 'none';

  listEl.innerHTML = eventos.map(ev => {
    const esIngreso = ev.tipo !== 'salida';
    const nombre    = ev.nombre || ev.usuario || 'Usuario';
    const color     = esIngreso ? '#16a34a' : '#dc2626';
    const bg        = esIngreso ? '#dcfce7' : '#fee2e2';
    const icono     = esIngreso
      ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>'
      : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid var(--border);">
      <div style="width:28px;height:28px;border-radius:50%;background:${bg};color:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${icono}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12.5px;color:var(--text);">${nombre} <span style="color:var(--text3);">${esIngreso?'entró al sistema':'salió del sistema'}</span></div>
        <div style="font-size:11px;color:var(--text3);margin-top:1px;">${_fmtFechaHora(ev.ts)}</div>
      </div>
      <div style="font-size:11px;color:var(--text3);white-space:nowrap;flex-shrink:0;">${_tiempoRelativo(ev.ts)}</div>
    </div>`;
  }).join('');
}

// Exporta la tabla de usuarios visible (filtrada) como CSV
function _exportarUsuariosCSV() {
  const q = (document.getElementById('usr-buscar')?.value || '').trim().toLowerCase();
  const filtroEstado = document.getElementById('usr-filtro-estado')?.value || '';
  const filas = _usrTablaData.filter(u => {
    if (q && !(`${u.nombre} ${u.usuario}`.toLowerCase().includes(q))) return false;
    if (filtroEstado === 'activo'   && !u.activo) return false;
    if (filtroEstado === 'inactivo' && u.activo)  return false;
    return true;
  });
  const encabezados = ['Usuario','Usuario (login)','Rol','Último ingreso','Estado'];
  const csvEsc = (v) => `"${String(v).replace(/"/g,'""')}"`;
  const filasCsv = filas.map(u => [
    u.nombre,
    u.usuario,
    u.esAdmin ? 'Administrador' : (u.rol==='colaborador'?'Colaborador':'Usuario'),
    _fmtFechaHora(u.ultimo_ingreso),
    u.activo ? 'Activo' : 'Desactivado',
  ].map(csvEsc).join(','));
  const csv = [encabezados.map(csvEsc).join(','), ...filasCsv].join('\r\n');
  const blob = new Blob(['﻿' + csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `usuarios_${hoy()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
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