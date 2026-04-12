/* Módulo Tiendas */

// ── TIENDAS ──
let _editTiendaId = null;
async function openModalTienda(id) {
  _editTiendaId = id||null;
  const prevEl = document.getElementById('t-foto-preview');
  document.getElementById('t-foto-data').value = '';
  document.getElementById('t-foto-input').value = '';
  document.getElementById('mt-title').textContent = id ? 'Editar Tienda' : 'Nueva Tienda';

  if(id) {
    const t = (await DB.tiendas()).find(x=>x.id===id);
    if(t) {
      sv('t-nombre',t.nombre); sv('t-resp',t.responsable||'');
      sv('t-color',t.color||'#00897b'); sv('t-obs',t.observaciones||'');
      sv('t-estado',t.estado||'activa');
      sv('t-mp-cuenta',t.mp_cuenta||'');
      if(t.foto) {
        document.getElementById('t-foto-data').value = t.foto;
        prevEl.innerHTML = `<img src="${t.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      } else {
        prevEl.innerHTML = '<span style="font-size:28px;opacity:.4;">📷</span>';
      }
    }
  } else {
    sv('t-nombre',''); sv('t-resp',''); sv('t-color','#00897b'); sv('t-obs','');
    sv('t-estado','activa'); sv('t-mp-cuenta','');
    prevEl.innerHTML = '<span style="font-size:28px;opacity:.4;">📷</span>';
  }
  openModal('modal-tienda');
}
function previewFotoTienda(input) {
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const data = e.target.result;
    document.getElementById('t-foto-data').value = data;
    const prev = document.getElementById('t-foto-preview');
    prev.innerHTML = `<img src="${data}" style="width:100%;height:100%;object-fit:cover;">`;
  };
  reader.readAsDataURL(file);
}

async function saveTienda() {
  const nombre = gv('t-nombre').trim();
  if(!nombre){ alert('El nombre es requerido.'); return; }
  const foto = document.getElementById('t-foto-data').value || null;
  await DB.upsertTienda({ id:_editTiendaId||uid(), nombre, responsable:gv('t-resp'),
    color:gv('t-color'), observaciones:gv('t-obs'), estado:gv('t-estado')||'activa',
    mp_cuenta:gv('t-mp-cuenta'), foto, fecha:hoy() });
  closeModal('modal-tienda');
  await populateSelects();
  await renderTiendas();
}

async function toggleEstadoTienda(id) {
  const tiendas = await DB.tiendas();
  const t = tiendas.find(x=>x.id===id);
  if(t) {
    t.estado = (t.estado === 'inactiva') ? 'activa' : 'inactiva';
    await DB.saveTiendas(tiendas);
    await renderTiendas();
  }
}

async function deleteTienda(id) {
  const t = (await DB.tiendas()).find(x=>x.id===id);
  if(!t) return;
  const ventasAsociadas = (await DB.ventas()).filter(v=>v.tienda_id===id).length;
  const msg = ventasAsociadas > 0
    ? `⚠️ La tienda "${t.nombre}" tiene ${ventasAsociadas} venta(s) asociada(s).\n¿Seguro que deseas eliminarla? Las ventas no se borrarán.`
    : `¿Eliminar la tienda "${t.nombre}"?`;
  if(!confirm(msg)) return;
  await DB.saveTiendas((await DB.tiendas()).filter(x=>x.id!==id));
  await populateSelects();
  await renderTiendas();
}

async function editarMPSaldo(tiendaId) {
  const saldos = await DB.saldos();
  const mpKey  = 'mercadopago_' + tiendaId;
  const actual = parseFloat(saldos[mpKey]) || 0;
  const t      = (await DB.tiendas()).find(x=>x.id===tiendaId);
  const nuevo  = prompt(`💳 Saldo Mercado Pago — ${t?.nombre||tiendaId}\nSaldo actual: ${fmt(actual)}\n\nIngresa el nuevo saldo (COP$):`, actual||'');
  if(nuevo===null) return;
  const val = parseFloat(nuevo);
  if(isNaN(val)) { alert('Valor inválido'); return; }
  saldos[mpKey] = val;
  await DB.saveSaldos(saldos);
  await renderTiendas();
}
async function renderTiendas() {
  const tiendas = await DB.tiendas();
  const ventas  = await DB.ventas();
  const saldos  = await DB.saldos();
  const problemas = await DB.problemas();
  const gridEl = document.getElementById('cfg-tiendas-grid') || document.getElementById('tiendas-grid');
  if(!gridEl) return;
  if(!tiendas.length) {
    gridEl.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
<div class="empty-title" style="margin-bottom:6px;">Sin tiendas registradas</div>
      <div class="c-dim" style="font-size:12px;">Crea tu primera tienda desde configuración</div></div>`; return;
  }
  gridEl.innerHTML = tiendas.map(t=>{
    const tv       = ventas.filter(v=>v.tienda_id===t.id);
    const gan      = tv.reduce((s,v)=>s+calcVenta(v).ganancia,0);
    const isActive = t.estado !== 'inactiva';
    const mpKey    = 'mercadopago_' + t.id;
    const mpSaldo  = parseFloat(saldos[mpKey]) || 0;

    // Métricas de reputación
    const canceladas  = tv.filter(v=>v.estado==='cancelado').length;
    const reclamos    = problemas.filter(p=>p.tienda_id===t.id && p.tipo==='reclamo').length;
    const demoras     = tv.filter(v=>{
      if(v.estado!=='en_camino') return false;
      return (new Date()-new Date(v.fecha_venta||''))/86400000 > 5;
    }).length;

    // Barra de reputación (3 indicadores: reclamos, cancelaciones, demoras)
    const _bar = (val) => {
      const color = val===0 ? '#22c55e' : val<=2 ? '#f59e0b' : '#ef4444';
      return `<div style="width:28px;height:6px;border-radius:3px;background:${color};"></div>`;
    };

    // Foto de perfil
    const fotoEl = t.foto
      ? `<img src="${t.foto}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid ${t.color};">`
      : `<div style="width:64px;height:64px;border-radius:50%;background:${t.color}22;border:2px solid ${t.color};
           display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;">🏪</div>`;

    return `
    <div style="background:#fff;border:1px solid var(--border);border-radius:14px;
                padding:20px;box-shadow:var(--shadow);opacity:${isActive?1:.65};
                transition:box-shadow .15s;position:relative;"
         onmouseover="this.style.boxShadow='var(--shadow-md)'"
         onmouseout="this.style.boxShadow='var(--shadow)'">

      <!-- Cabecera: foto + nombre + estado -->
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
        ${fotoEl}
        <div style="flex:1;min-width:0;">
          <div style="font-size:15px;font-weight:800;letter-spacing:-.3px;color:var(--text);
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.nombre}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">${isActive?'Activa':'Inactiva'}</div>
        </div>
        <span style="font-size:9px;font-weight:700;padding:3px 10px;border-radius:20px;flex-shrink:0;
          background:${isActive?'var(--green-bg)':'var(--red-bg)'};
          color:${isActive?'var(--green)':'var(--red)'};">
          ${isActive?'● ACTIVA':'● INACTIVA'}
        </span>
      </div>

      <!-- Reputación + Ventas en fila -->
      <div style="display:flex;gap:0;border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:14px;">
        <!-- Reputación -->
        <div style="flex:1;padding:12px 14px;border-right:1px solid var(--border);">
          <div style="font-size:10px;font-weight:700;color:var(--text2);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;">Reputación</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:11px;color:var(--text2);">Reclamos</span>
              ${_bar(reclamos)}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:11px;color:var(--text2);">Cancelaciones</span>
              ${_bar(canceladas)}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:11px;color:var(--text2);">Demoras</span>
              ${_bar(demoras)}
            </div>
          </div>
        </div>
        <!-- Ventas -->
        <div style="flex:1;padding:12px 14px;display:flex;flex-direction:column;justify-content:space-between;">
          <div style="font-size:10px;font-weight:700;color:var(--text2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;">Ventas</div>
          <div style="font-size:28px;font-weight:800;color:var(--text);line-height:1;">${tv.length}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:4px;">
            Ganancia: <span style="font-weight:700;color:${gan>=0?'var(--green)':'var(--red)'};">${fmt(gan)}</span>
          </div>
            <button class="btn btn-sm" style="margin-top:10px;background:var(--teal);color:#fff;border:none;
            border-radius:8px;font-size:11px;font-weight:700;width:100%;padding:7px 0;margin-left:0;text-align:center;"
            onclick="navigate('ventas')">Ver ventas</button>
        </div>
      </div>

      <!-- Saldo MP -->
      <div onclick="editarMPSaldo('${t.id}')" style="display:flex;align-items:center;justify-content:space-between;
           padding:8px 12px;border-radius:8px;background:var(--teal-bg);cursor:pointer;margin-bottom:12px;"
           onmouseover="this.style.background='#c8e8e6'" onmouseout="this.style.background='var(--teal-bg)'">
        <span style="font-size:10px;font-weight:600;color:var(--teal-dark);">💳 Saldo Mercado Pago</span>
        <span style="font-size:13px;font-weight:800;color:var(--teal-dark);font-family:var(--font-mono);">${fmt(mpSaldo)}</span>
      </div>

      <!-- Acciones -->
      <div style="display:flex;gap:6px;">
        <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="openModalTienda('${t.id}')">✏️ Editar</button>
        <button class="btn btn-ghost btn-sm" onclick="toggleEstadoTienda('${t.id}')"
          style="color:${isActive?'var(--red)':'var(--green)'};">
          ${isActive?'⏸':'▶️'}
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteTienda('${t.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

