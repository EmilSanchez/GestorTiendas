/* Módulo Ventas & Alertas & Tiendas */

// ── HELPER: obtener el período activo desde los filtros ──
function _getPeriodoActivo() {
  const fm     = (document.getElementById('vf-mes')?.value    || '').trim();
  const fDesde = (document.getElementById('vf-desde')?.value  || '').trim();
  const fHasta = (document.getElementById('vf-hasta')?.value  || '').trim();

  if (fDesde || fHasta) {
    return { tipo: 'rango', desde: fDesde, hasta: fHasta };
  }
  if (fm) {
    return { tipo: 'mes', mes: fm };
  }
  return { tipo: 'mes', mes: mes() }; // mes actual por defecto
}

function _filtrarPorPeriodo(ventas, periodo) {
  if (periodo.tipo === 'rango') {
    return ventas.filter(v => {
      const f = v.fecha_venta || '';
      if (periodo.desde && f < periodo.desde) return false;
      if (periodo.hasta && f > periodo.hasta) return false;
      return true;
    });
  }
  // mes YYYY-MM
  return ventas.filter(v => v.fecha_venta?.startsWith(periodo.mes));
}

function _labelPeriodo(periodo) {
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  if (periodo.tipo === 'rango') {
    const d = periodo.desde || '…';
    const h = periodo.hasta || '…';
    return `${d} → ${h}`;
  }
  const [y, m] = (periodo.mes || '').split('-');
  const nombreMes = MESES[parseInt(m, 10) - 1] || periodo.mes;
  return `${nombreMes} ${y}`;
}

// ── VENTAS & GANANCIAS (FUSIONADO) ──
async function renderVentasGanancias() {
  const ventas  = await DB.ventas();
  const tiendas = await DB.tiendas();

  const periodo     = _getPeriodoActivo();
  const ventasPer   = _filtrarPorPeriodo(ventas, periodo);
  const labelPer    = _labelPeriodo(periodo);

  const totalGan    = ventasPer.reduce((s,v) => s + calcVenta(v).ganancia,    0);
  const totalVenta  = ventasPer.reduce((s,v) => s + calcVenta(v).totalVenta,  0);
  const totalCostos = ventasPer.reduce((s,v) => s + calcVenta(v).totalCostos, 0);
  const marGen      = totalVenta > 0 ? (totalGan / totalVenta) * 100 : 0;

  const elGan = document.getElementById('vg-total-gan');
  const elIng = document.getElementById('vg-total-ing');
  const elCos = document.getElementById('vg-total-cos');
  const elMar = document.getElementById('vg-total-mar');
  const elCnt = document.getElementById('vg-total-cnt');
  const elSub = document.getElementById('vg-total-sub');
  if (elGan) elGan.textContent = fmt(totalGan);
  if (elIng) elIng.textContent = fmt(totalVenta);
  if (elCos) elCos.textContent = fmt(totalCostos);
  if (elMar) elMar.textContent = fmtP(marGen);
  if (elCnt) elCnt.textContent = ventasPer.length;
  if (elSub) elSub.textContent = labelPer;

  // ── Chips por tienda con el período activo ──
  const chipEl = document.getElementById('vg-por-tienda');
  if (chipEl) chipEl.innerHTML = tiendas.map(t => {
    const tvPer  = ventasPer.filter(v => v.tienda_id === t.id);
    const tvTodo = ventas.filter(v => v.tienda_id === t.id);
    const g   = tvPer.reduce((s,v) => s + calcVenta(v).ganancia,   0);
    const ing = tvPer.reduce((s,v) => s + calcVenta(v).totalVenta, 0);
    const isActive = t.estado !== 'inactiva';
    const fotoEl = t.foto
      ? `<img src="${t.foto}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid ${t.color};">`
      : `<span class="tienda-dot" style="background:${t.color};width:10px;height:10px;"></span>`;
    return `<div style="
      background:var(--white);border:1px solid var(--border);border-radius:var(--radius-lg);
      padding:12px 16px;flex:1;min-width:160px;box-shadow:var(--shadow);
      border-left:4px solid ${t.color};opacity:${isActive ? 1 : .6};
    ">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;">
        ${fotoEl}
        <span style="font-size:15px;font-weight:700;flex:1;">${t.nombre}</span>
        ${!isActive ? '<span style="font-size:9px;background:#fde8ea;color:#b0202e;padding:1px 6px;border-radius:10px;font-weight:700;">INACTIVA</span>' : ''}
      </div>
      <div style="font-size:20px;font-weight:700;color:${g >= 0 ? 'var(--green)' : 'var(--red)'};">${fmt(g)}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:2px;">
        <b>${tvPer.length}</b> ventas · <span style="opacity:.7;">total: ${tvTodo.length}</span>
      </div>
    </div>`;
  }).join('');

  // Renderizar tabla de ventas
  renderVentas();
}

// ── ALERTAS ──
async function getAlertas() {
  const ventas   = await DB.ventas();
  const problemas= await DB.problemas();
  const alerts   = [];

  const probAbiertos = problemas.filter(p=>p.estado==='abierto');
  if(probAbiertos.length) alerts.push({
    color:'red', title:`${probAbiertos.length} problema(s) sin resolver`,
    sub:'Revisar módulo Problemas', page:'problemas'
  });

  const perdidas = problemas.filter(p=>p.estado==='perdida');
  if(perdidas.length) {
    const total = perdidas.reduce((s,p)=>s+(parseFloat(p.valor_perdida)||0),0);
    alerts.push({ color:'red', title:`${perdidas.length} caso(s) con pérdida registrada`, sub:`Total: ${fmt(total)}`, page:'problemas' });
  }

  const vConProblema = ventas.filter(v=>v.estado==='problema');
  if(vConProblema.length) alerts.push({
    color:'yellow', title:`${vConProblema.length} venta(s) marcada(s) como "problema"`,
    sub:`IDs: ${vConProblema.map(v=>v.id_ml||v.id).join(', ')}`, page:'ventas'
  });

  const hoyDate = new Date();
  const enCamino = ventas.filter(v=>{
    if(v.estado!=='en_camino') return false;
    const d = new Date(v.fecha_venta||'');
    return (hoyDate-d)/86400000 > 5;
  });
  if(enCamino.length) alerts.push({
    color:'yellow', title:`${enCamino.length} venta(s) en camino sin actualizar (+5 días)`,
    sub:'Verificar estado en transportadora', page:'ventas'
  });

  const canceladas = ventas.filter(v=>v.estado==='cancelado');
  const cancelSinProb = canceladas.filter(v=>!problemas.some(p=>p.venta_id===v.id));
  if(cancelSinProb.length) alerts.push({
    color:'teal', title:`${cancelSinProb.length} cancelación(es) sin análisis de costo`,
    sub:'Registrar si hubo pérdida', page:'problemas'
  });

  return alerts;
}

async function renderAlertas() {
  const alerts = await getAlertas();
  document.getElementById('alertas-count').textContent = alerts.length;
  document.getElementById('alertas-container').innerHTML = alerts.length
    ? alerts.map(a=>`
      <div class="alert-item" style="cursor:pointer" onclick="navigate('${a.page||'alertas'}')">
        <div class="adot ${a.color}"></div>
        <div class="a-body">
          <div class="a-title">${a.title}</div>
          <div class="a-sub">${a.sub}</div>
        </div>
        <span style="font-size:11px;color:var(--teal);">Ir →</span>
      </div>`).join('')
    : '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">Sin alertas activas</div><div class="c-dim" style="font-size:12px;">Tu operación está al día</div></div>';
}

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