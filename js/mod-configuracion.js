/* Módulo Configuración */

// ── CONFIGURACIÓN ──
let _sessionTimerInterval = null;

async function renderConfiguracion() {
  // Renderizar tiendas en el nuevo grid de configuración
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
      <div style="background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden;
                  box-shadow:var(--shadow);opacity:${isActive?1:.6};transition:box-shadow .15s;"
           onmouseover="this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.boxShadow='var(--shadow)'">

        <!-- Header con acento de color -->
        <div style="height:4px;background:${t.color};"></div>

        <!-- Cuerpo principal -->
        <div style="padding:16px 18px;">

          <!-- Fila: avatar + nombre + estado -->
          <div style="display:flex;align-items:center;gap:13px;margin-bottom:14px;">
            ${fotoEl}
            <div style="flex:1;min-width:0;">
              <div style="font-size:15px;font-weight:700;color:var(--text);letter-spacing:-.2px;
                          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.nombre}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px;">${t.responsable||'Sin responsable asignado'}</div>
            </div>
            <span style="font-size:9px;font-weight:700;padding:3px 10px;border-radius:4px;flex-shrink:0;letter-spacing:.5px;
              background:${isActive?'#dcfce7':'#fee2e2'};color:${isActive?'#15803d':'#b91c1c'};">
              ${isActive?'ACTIVA':'INACTIVA'}
            </span>
          </div>

          <!-- Métricas en grid -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:14px;">
            <div style="padding:10px 12px;border-right:1px solid var(--border);">
              <div style="font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:var(--text3);font-weight:600;margin-bottom:4px;">Ventas</div>
              <div style="font-size:20px;font-weight:800;color:var(--text);line-height:1;">${tv.length}</div>
            </div>
            <div style="padding:10px 12px;border-right:1px solid var(--border);">
              <div style="font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:var(--text3);font-weight:600;margin-bottom:4px;">Ganancia</div>
              <div style="font-size:13px;font-weight:700;color:${gan>=0?'var(--green)':'var(--red)'};line-height:1.3;">${fmt(gan)}</div>
            </div>
            <div style="padding:10px 12px;cursor:pointer;" onclick="editarMPSaldo('${t.id}')" title="Clic para editar saldo"
                 onmouseover="this.style.background='#f7fafa'" onmouseout="this.style.background='transparent'">
              <div style="font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:var(--text3);font-weight:600;margin-bottom:4px;">Saldo MP</div>
              <div style="font-size:13px;font-weight:700;color:var(--teal);line-height:1.3;">${fmt(mpSaldo)}</div>
            </div>
          </div>

          <!-- Alertas de reputación (solo si hay) -->
          ${(reclamos>0||canceladas>0)?`
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">
            ${reclamos>0?`<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:4px;background:#fee2e2;color:#b91c1c;">${reclamos} reclamo${reclamos>1?'s':''}</span>`:''}
            ${canceladas>0?`<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:4px;background:#fef9c3;color:#92400e;">${canceladas} cancelación${canceladas>1?'es':''}</span>`:''}
          </div>`:''}

          <!-- Acciones -->
          <div style="display:flex;gap:6px;padding-top:2px;">
            <button class="btn btn-ghost btn-sm" style="flex:1;font-size:12px;" onclick="openModalTienda('${t.id}')">Editar</button>
            <button class="btn btn-ghost btn-sm" style="font-size:12px;color:${isActive?'var(--red)':'var(--green)'};"
              onclick="toggleEstadoTienda('${t.id}')" title="${isActive?'Desactivar tienda':'Activar tienda'}">
              ${isActive?'Desactivar':'Activar'}
            </button>
            <button class="btn btn-danger btn-sm" style="font-size:12px;" onclick="deleteTienda('${t.id}')">Eliminar</button>
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
  const remaining = _SESSION_TTL - elapsed;
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
    const snap = await _db.collection('config').doc('auth').get();
    if(!snap.exists) { errEl.textContent = '⚠️ No hay código configurado en la BD.'; return; }
    const hashGuardado = snap.data().hash;
    const hashActual   = await _hashCode(actual);
    if(hashActual !== hashGuardado) { errEl.textContent = 'El código actual es incorrecto.'; return; }
    const hashNuevo = await _hashCode(nuevo);
    await _db.collection('config').doc('auth').set({ hash: hashNuevo });
    closeModal('modal-cambiar-codigo');
    alert('✅ Código actualizado correctamente.');
  } catch(e) {
    errEl.textContent = 'Error al conectar con Firebase.';
    console.error(e);
  }
}

