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
  const [ventas, tiendas, enviosSky] = await Promise.all([
    DB.ventas(), DB.tiendas(), DB.envios_sky()
  ]);

  const periodo     = _getPeriodoActivo();
  const ventasPer   = _filtrarPorPeriodo(ventas, periodo);
  const labelPer    = _labelPeriodo(periodo);

  // Ganancia base de ventas
  const ganVentas   = ventasPer.reduce((s,v) => s + calcVenta(v).ganancia,    0);
  const totalVenta  = ventasPer.reduce((s,v) => s + calcVenta(v).totalVenta,  0);
  const totalCostos = ventasPer.reduce((s,v) => s + calcVenta(v).totalCostos, 0);

  // Descontar envíos Skydropx del período
  const mesPer = periodo.mes || new Date().toISOString().slice(0,7);
  const egresosSky = enviosSky
    .filter(e => (e.fecha||'').startsWith(mesPer))
    .reduce((s,e) => s + (parseFloat(e.valor)||0), 0);

  const totalGan = ganVentas - egresosSky;
  const marGen   = totalVenta > 0 ? (totalGan / totalVenta) * 100 : 0;

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

  // ── Tarjetas por tienda ──
  const chipEl = document.getElementById('vg-por-tienda');
  if (chipEl) chipEl.innerHTML = tiendas.map(t => {
    const tvPer  = ventasPer.filter(v => v.tienda_id === t.id);
    const g      = tvPer.reduce((s,v) => s + calcVenta(v).ganancia,   0);
    const ing    = tvPer.reduce((s,v) => s + calcVenta(v).totalVenta, 0);
    const cos    = tvPer.reduce((s,v) => s + calcVenta(v).totalCostos,0);
    const isActive = t.estado !== 'inactiva';
    const fotoEl = t.foto
      ? `<img src="${t.foto}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2.5px solid ${t.color};">`
      : `<span style="width:36px;height:36px;border-radius:50%;background:${t.color};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;font-size:15px;font-weight:700;">${t.nombre.charAt(0)}</span>`;
    const gColor = g >= 0 ? '#065f46' : '#7f1d1d';
    const gBg    = g >= 0 ? '#f0fdf4' : '#fef2f2';
    return `<div style="
      display:flex;align-items:center;gap:12px;
      padding:6px 16px;
      margin-left:10px;
      border-left:3px solid ${t.color};
      border-radius:8px;
      background:var(--bg);
      border:1px solid var(--border);
      border-left:3px solid ${t.color};
      opacity:${isActive ? 1 : .5};flex-shrink:0;
    ">
      ${fotoEl}
      <div style="min-width:85px;">
        <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin-bottom:2px;">Tienda</div>
        <div style="font-size:12px;font-weight:700;white-space:nowrap;color:var(--text);">${t.nombre}</div>
        ${!isActive ? '<span style="font-size:8px;background:#fde8ea;color:#b0202e;padding:1px 5px;border-radius:8px;font-weight:700;">INACTIVA</span>' : ''}
      </div>
      <div style="width:1px;height:28px;background:var(--border);flex-shrink:0;"></div>
      <div style="min-width:78px;">
        <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin-bottom:2px;">Ganancia</div>
        <div style="font-size:14px;font-weight:700;color:${gColor};line-height:1;">${fmt(g)}</div>
      </div>
      <div style="width:1px;height:28px;background:var(--border);flex-shrink:0;"></div>
      <div style="min-width:44px;">
        <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin-bottom:2px;">Ventas</div>
        <div style="font-size:14px;font-weight:700;color:var(--text);line-height:1;">${tvPer.length}</div>
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
    : '<div class="empty-state"><div class="empty-icon"></div><div class="empty-title">Sin alertas activas</div><div class="c-dim" style="font-size:12px;">Tu operación está al día</div></div>';
}