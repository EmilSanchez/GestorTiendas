// ══════════════════════════════════════════════════════════════
// MÓDULO: REPORTE DE VENTAS
// Genera un reporte HTML imprimible / descargable como PDF
// ══════════════════════════════════════════════════════════════

var _repTipo   = 'actual';   // 'actual' | 'todos' | 'seleccionar'
var _repMeses  = [];         // meses seleccionados en modo 'seleccionar' (YYYY-MM)

// ── Cambio de modo de período ──
function _repSelPeriodo(btn) {
  document.querySelectorAll('.rep-periodo-btn').forEach(b => {
    b.style.background  = 'var(--white)';
    b.style.color       = 'var(--text2)';
    b.style.borderColor = 'var(--border)';
  });
  btn.style.background  = 'var(--teal)';
  btn.style.color       = '#fff';
  btn.style.borderColor = 'var(--teal)';

  _repTipo = btn.dataset.tipo;
  const gridEl = document.getElementById('rep-meses-grid');
  if (_repTipo === 'seleccionar') {
    gridEl.style.display = '';
    _repCargarMesesDisponibles();
  } else {
    gridEl.style.display = 'none';
  }
  _repActualizarInfo();
}

// ── Carga los meses que tienen ventas registradas ──
async function _repCargarMesesDisponibles() {
  const ventas = await DB.ventas();
  const mesesSet = new Set(ventas.map(v => (v.fecha_venta || '').slice(0, 7)).filter(Boolean));
  const meses = [...mesesSet].sort().reverse();

  const listaEl = document.getElementById('rep-meses-lista');
  if (!listaEl) return;

  if (!meses.length) {
    listaEl.innerHTML = '<span style="font-size:12px;color:var(--text3);">No hay ventas registradas.</span>';
    return;
  }

  listaEl.innerHTML = meses.map(m => {
    const sel = _repMeses.includes(m);
    return `<button class="rep-mes-btn ${sel ? 'sel' : ''}" data-mes="${m}"
      onclick="_repToggleMes(this)"
      style="padding:5px 12px;border-radius:20px;border:1.5px solid ${sel ? 'var(--teal)' : 'var(--border)'};
             background:${sel ? 'var(--teal-bg)' : 'var(--white)'};color:${sel ? 'var(--teal)' : 'var(--text2)'};
             font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;">
      ${_repFmtMes(m)}
    </button>`;
  }).join('');
}

function _repToggleMes(btn) {
  const mes = btn.dataset.mes;
  const idx = _repMeses.indexOf(mes);
  if (idx >= 0) {
    _repMeses.splice(idx, 1);
    btn.style.background  = 'var(--white)';
    btn.style.color       = 'var(--text2)';
    btn.style.borderColor = 'var(--border)';
    btn.classList.remove('sel');
  } else {
    _repMeses.push(mes);
    btn.style.background  = 'var(--teal-bg)';
    btn.style.color       = 'var(--teal)';
    btn.style.borderColor = 'var(--teal)';
    btn.classList.add('sel');
  }
  _repActualizarInfo();
}

async function _repActualizarInfo() {
  const infoEl = document.getElementById('rep-preview-info');
  if (!infoEl) return;
  const meses = await _repGetMesesFiltrados();
  if (!meses.length) {
    infoEl.textContent = 'Sin meses seleccionados.';
    return;
  }
  const ventas = await DB.ventas();
  const total  = ventas.filter(v => meses.includes((v.fecha_venta||'').slice(0,7))).length;
  infoEl.textContent = `${meses.length} mes(es) seleccionado(s) · ${total} venta(s) en el reporte.`;
}

function _repFmtMes(yyyymm) {
  if (!yyyymm) return yyyymm;
  const [y, m] = yyyymm.split('-');
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${meses[parseInt(m)-1]} ${y}`;
}

async function _repGetMesesFiltrados() {
  const ventas = await DB.ventas();
  const mesesSet = new Set(ventas.map(v => (v.fecha_venta||'').slice(0,7)).filter(Boolean));
  const todos = [...mesesSet].sort().reverse();
  const mesAct = new Date().toISOString().slice(0,7);

  if (_repTipo === 'actual')       return [mesAct].filter(m => mesesSet.has(m));
  if (_repTipo === 'todos')        return todos;
  if (_repTipo === 'seleccionar')  return _repMeses.filter(m => mesesSet.has(m)).sort().reverse();
  return [];
}

// ── Generar el reporte ──
async function generarReporteVentas() {
  const meses = await _repGetMesesFiltrados();
  if (!meses.length) {
    showToast('Selecciona al menos un mes.', 'error', 2500);
    return;
  }

  const [ventas, tiendas] = await Promise.all([DB.ventas(), DB.tiendas()]);
  const tiendaMap = {};
  tiendas.forEach(t => tiendaMap[t.id] = t.nombre);

  const ESTADOS = {
    pendiente: 'Pendiente', en_camino: 'En camino', entregado: 'Entregado',
    cancelado: 'Cancelado', devuelto: 'Devuelto', problema: 'Problema', error: 'Error'
  };
  const ESTADO_COLOR = {
    pendiente: '#f59e0b', en_camino: '#3b82f6', entregado: '#16a34a',
    cancelado: '#6b7280', devuelto: '#8b5cf6', problema: '#dc2626', error: '#dc2626'
  };

  const fmtCOP = n => `$${Number(n||0).toLocaleString('es-CO')}`;
  const fmtFech = f => {
    if (!f) return '—';
    const [y,m,d] = f.split('-');
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${parseInt(d)} ${meses[parseInt(m)-1]} ${y}`;
  };

  // Construir secciones por mes
  let seccionesMes = '';
  let resumenFilas = '';
  let totalGlobalVentas = 0, totalGlobalGanancia = 0, totalGlobalCostos = 0;

  for (const mes of meses) {
    const ventasMes = ventas
      .filter(v => (v.fecha_venta||'').startsWith(mes))
      .sort((a,b) => (b.fecha_venta||'').localeCompare(a.fecha_venta||''));

    if (!ventasMes.length) continue;

    let mesIngresos = 0, mesGanancia = 0, mesCostos = 0;
    let filas = '';

    ventasMes.forEach((v, i) => {
      const c = calcVenta(v);
      mesIngresos += c.totalVenta;
      mesGanancia += c.ganancia;
      mesCostos   += c.costoTotal;
      totalGlobalVentas   += c.totalVenta;
      totalGlobalGanancia += c.ganancia;
      totalGlobalCostos   += c.costoTotal;

      const estadoLabel = ESTADOS[v.estado] || v.estado || 'Pendiente';
      const estadoColor = ESTADO_COLOR[v.estado] || '#6b7280';
      const tiendaNombre = tiendaMap[v.tienda_id] || v.tienda_id || '—';
      const ganColor = c.ganancia >= 0 ? '#16a34a' : '#dc2626';

      filas += `
        <tr style="background:${i%2===0?'#fff':'#f8fafb'};">
          <td style="padding:7px 10px;font-size:11px;color:#374151;white-space:nowrap;">${fmtFech(v.fecha_venta)}</td>
          <td style="padding:7px 10px;font-size:11px;color:#374151;max-width:120px;overflow:hidden;text-overflow:ellipsis;">${tiendaNombre}</td>
          <td style="padding:7px 10px;font-size:11px;color:#374151;font-family:monospace;">${v.id_ml||'—'}</td>
          <td style="padding:7px 10px;font-size:11px;text-align:right;color:#374151;">${fmtCOP(c.totalVenta)}</td>
          <td style="padding:7px 10px;font-size:11px;text-align:right;font-weight:700;color:${ganColor};">${fmtCOP(c.ganancia)}</td>
          <td style="padding:7px 10px;font-size:11px;text-align:center;">
            <span style="background:${estadoColor}18;color:${estadoColor};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;border:1px solid ${estadoColor}44;white-space:nowrap;">${estadoLabel}</span>
          </td>
        </tr>`;
    });

    const margen = mesIngresos > 0 ? ((mesGanancia / mesIngresos) * 100).toFixed(1) : '0.0';
    const ganMesColor = mesGanancia >= 0 ? '#16a34a' : '#dc2626';

    seccionesMes += `
      <div style="margin-bottom:28px;page-break-inside:avoid;">
        <!-- Encabezado del mes -->
        <div style="background:linear-gradient(135deg,#00897b,#00695c);color:#fff;padding:10px 16px;border-radius:10px 10px 0 0;display:flex;align-items:center;justify-content:space-between;">
          <div style="font-size:14px;font-weight:800;letter-spacing:-.3px;">${_repFmtMes(mes)}</div>
          <div style="display:flex;gap:20px;font-size:11px;">
            <span><span style="opacity:.7;">Ventas: </span><strong>${fmtCOP(mesIngresos)}</strong></span>
            <span><span style="opacity:.7;">Ganancia: </span><strong style="color:${mesGanancia>=0?'#a7f3d0':'#fca5a5'};">${fmtCOP(mesGanancia)}</strong></span>
            <span><span style="opacity:.7;">Margen: </span><strong>${margen}%</strong></span>
          </div>
        </div>
        <!-- Tabla -->
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;overflow:hidden;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:8px 10px;font-size:10px;font-weight:700;text-align:left;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Fecha</th>
              <th style="padding:8px 10px;font-size:10px;font-weight:700;text-align:left;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Tienda</th>
              <th style="padding:8px 10px;font-size:10px;font-weight:700;text-align:left;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">ID Venta ML</th>
              <th style="padding:8px 10px;font-size:10px;font-weight:700;text-align:right;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Ingresos</th>
              <th style="padding:8px 10px;font-size:10px;font-weight:700;text-align:right;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Ganancia</th>
              <th style="padding:8px 10px;font-size:10px;font-weight:700;text-align:center;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Estado</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
          <tfoot>
            <tr style="background:#f0fdf4;border-top:2px solid #86efac;">
              <td colspan="3" style="padding:9px 10px;font-size:11px;font-weight:700;color:#374151;">${ventasMes.length} venta(s)</td>
              <td style="padding:9px 10px;font-size:11px;font-weight:700;text-align:right;color:#374151;">${fmtCOP(mesIngresos)}</td>
              <td style="padding:9px 10px;font-size:12px;font-weight:800;text-align:right;color:${ganMesColor};">${fmtCOP(mesGanancia)}</td>
              <td style="padding:9px 10px;font-size:11px;font-weight:700;text-align:center;color:#6b7280;">Margen ${margen}%</td>
            </tr>
          </tfoot>
        </table>
      </div>`;

    const margenGlobal = totalGlobalVentas > 0 ? ((mesGanancia / mesIngresos) * 100).toFixed(1) : '0.0';
    resumenFilas += `
      <tr>
        <td style="padding:7px 10px;font-size:12px;font-weight:600;color:#374151;">${_repFmtMes(mes)}</td>
        <td style="padding:7px 10px;font-size:12px;text-align:center;color:#374151;">${ventasMes.length}</td>
        <td style="padding:7px 10px;font-size:12px;text-align:right;color:#374151;">${fmtCOP(mesIngresos)}</td>
        <td style="padding:7px 10px;font-size:12px;text-align:right;font-weight:700;color:${mesGanancia>=0?'#16a34a':'#dc2626'};">${fmtCOP(mesGanancia)}</td>
        <td style="padding:7px 10px;font-size:12px;text-align:center;color:#6b7280;">${margenGlobal}%</td>
      </tr>`;
  }

  const fechaGen = new Date().toLocaleDateString('es-CO', {day:'2-digit',month:'long',year:'numeric'});
  const margenGlobal = totalGlobalVentas > 0 ? ((totalGlobalGanancia / totalGlobalVentas) * 100).toFixed(1) : '0.0';

  // HTML del reporte completo
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte de Ventas — ShopManager</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color:#1f2937; background:#fff; padding:32px; font-size:13px; }
    @media print {
      body { padding:16px; }
      .no-print { display:none !important; }
      @page { margin:1.5cm; size:A4 landscape; }
    }
    h1 { font-size:22px; font-weight:800; color:#00695c; }
    h2 { font-size:15px; font-weight:700; color:#374151; margin-bottom:14px; }
  </style>
</head>
<body>
  <!-- Botón de imprimir (solo en pantalla) -->
  <div class="no-print" style="text-align:right;margin-bottom:20px;">
    <button onclick="window.print()" style="padding:10px 22px;background:#00897b;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">
      🖨️ Imprimir / Guardar como PDF
    </button>
  </div>

  <!-- Encabezado principal -->
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #e5e7eb;">
    <div>
      <h1>Reporte de Ventas</h1>
      <div style="font-size:12px;color:#6b7280;margin-top:4px;">Generado el ${fechaGen} · ${meses.length} mes(es) · ShopManager</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Ganancia total</div>
      <div style="font-size:26px;font-weight:800;color:${totalGlobalGanancia>=0?'#16a34a':'#dc2626'};">${fmtCOP(totalGlobalGanancia)}</div>
      <div style="font-size:11px;color:#6b7280;">de ${fmtCOP(totalGlobalVentas)} en ventas · margen ${margenGlobal}%</div>
    </div>
  </div>

  <!-- Tabla resumen por mes -->
  <div style="margin-bottom:28px;">
    <h2>Resumen por mes</h2>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:9px 10px;font-size:10px;font-weight:700;text-align:left;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Mes</th>
          <th style="padding:9px 10px;font-size:10px;font-weight:700;text-align:center;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Ventas</th>
          <th style="padding:9px 10px;font-size:10px;font-weight:700;text-align:right;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Ingresos</th>
          <th style="padding:9px 10px;font-size:10px;font-weight:700;text-align:right;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Ganancia</th>
          <th style="padding:9px 10px;font-size:10px;font-weight:700;text-align:center;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Margen</th>
        </tr>
      </thead>
      <tbody>${resumenFilas}</tbody>
      <tfoot>
        <tr style="background:#ecfdf5;border-top:2px solid #6ee7b7;">
          <td style="padding:10px;font-size:12px;font-weight:800;color:#065f46;">TOTAL</td>
          <td style="padding:10px;font-size:12px;font-weight:800;text-align:center;color:#065f46;">${ventas.filter(v => meses.includes((v.fecha_venta||'').slice(0,7))).length}</td>
          <td style="padding:10px;font-size:12px;font-weight:800;text-align:right;color:#065f46;">${fmtCOP(totalGlobalVentas)}</td>
          <td style="padding:10px;font-size:13px;font-weight:800;text-align:right;color:${totalGlobalGanancia>=0?'#16a34a':'#dc2626'};">${fmtCOP(totalGlobalGanancia)}</td>
          <td style="padding:10px;font-size:12px;font-weight:800;text-align:center;color:#065f46;">${margenGlobal}%</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- Detalle por mes -->
  <h2>Detalle de ventas por mes</h2>
  ${seccionesMes}

  <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center;">
    Reporte generado por ShopManager · ${fechaGen}
  </div>
</body>
</html>`;

  // Abrir en nueva ventana
  const ventana = window.open('', '_blank');
  if (!ventana) {
    showToast('Permite los pop-ups para ver el reporte.', 'error', 3000);
    return;
  }
  ventana.document.write(html);
  ventana.document.close();
  showToast('Reporte generado — usa Ctrl+P para guardar como PDF', 'success', 3500);
}


// ══════════════════════════════════════════════════════════════
// CIERRE DE MES
// ══════════════════════════════════════════════════════════════

var _cmMesActual    = '';   // mes que se está editando/viendo
var _cmGastos       = [];   // array de {id, concepto, valor}
var _cmGanBruta     = 0;    // ganancia bruta del mes
var _cmIngresos     = 0;
var _cmNumVentas    = 0;
var _cmModoEdicion  = false; // true = ya cerrado, editando

const _fmtCOP = n => '$' + Number(n||0).toLocaleString('es-CO');

// ── helpers Firestore ──
async function _getCierres() {
  try {
    const snap = await _cfg('cierres_mes').get();
    return snap.exists ? (snap.data().meses || []) : [];
  } catch(e) { return []; }
}
async function _saveCierres(arr) {
  await _cfg('cierres_mes').set({ meses: arr });
}

// ── Render lista de meses cerrados en Configuración ──
async function renderCierresMes() {
  await renderCierresMes_Fin();
}

async function renderCierresMes_Fin() {
  const cardEl = document.getElementById('fin-cierres-card');
  const listaEl = document.getElementById('fin-cierres-lista');
  if (!listaEl) return;
  const cierres = await _getCierres();
  if (!cierres.length) {
    if (cardEl) cardEl.style.display = 'none';
    return;
  }
  if (cardEl) cardEl.style.display = '';
  listaEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;">
    ${cierres.sort((a,b)=>b.mes.localeCompare(a.mes)).map(cl=>`
    <div style="display:flex;align-items:center;gap:12px;padding:11px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;">
      <div style="flex:1;">
        <span style="font-size:13px;font-weight:700;color:var(--text);">${_repFmtMes(cl.mes)}</span>
        <span style="font-size:11px;color:var(--text3);margin-left:8px;">${cl.num_ventas} ventas</span>
      </div>
      <span style="font-size:12px;color:var(--text2);">Ingresos <strong>${cl.ingresos_fmt}</strong></span>
      <span style="font-size:13px;font-weight:700;color:${parseFloat(cl.utilidad_raw||cl.ganancia_raw)>=0?'var(--green)':'var(--red)'};">
        Utilidad ${cl.utilidad_fmt||cl.ganancia_fmt}
      </span>
      <span style="font-size:9px;background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:20px;font-weight:700;border:1px solid #93c5fd;white-space:nowrap;">CERRADO</span>
      <button class="btn btn-ghost btn-sm" onclick="abrirCierreExistente('${cl.mes}')" style="font-size:11px;padding:4px 10px;">Ver / Editar</button>
      <button class="btn btn-ghost btn-sm" onclick="_reabrirMes('${cl.mes}')" style="font-size:11px;color:var(--red);padding:4px 10px;">Reabrir</button>
    </div>`).join('')}
  </div>`;
}

// ── Abrir modal para NUEVO cierre ──
async function abrirModalCierreMes() {
  const [ventas, enviosSky, cierres] = await Promise.all([DB.ventas(), DB.envios_sky(), _getCierres()]);
  const cerrados = new Set(cierres.map(c=>c.mes));
  const mesesSet = new Set(ventas.map(v=>(v.fecha_venta||'').slice(0,7)).filter(Boolean));
  const meses = [...mesesSet].sort().reverse().filter(m=>!cerrados.has(m));

  if (!meses.length) { showToast('No hay meses disponibles para cerrar.','info',2500); return; }

  // Calcular datos del mes seleccionado por defecto
  const mes = meses[0];
  const ventasMes = ventas.filter(v=>(v.fecha_venta||'').startsWith(mes));
  const idsMl = new Set(ventas.map(v=>v.id_ml).filter(Boolean));
  const egSky = enviosSky
    .filter(e=>(e.fecha||'').startsWith(mes) && !idsMl.has(e.num_venta))
    .reduce((s,e)=>s+(parseFloat(e.valor)||0), 0);

  _cmMesActual  = mes;
  _cmIngresos   = ventasMes.reduce((s,v)=>s+calcVenta(v).totalVenta, 0);
  _cmGanBruta   = ventasMes.reduce((s,v)=>s+calcVenta(v).ganancia, 0) - egSky;
  _cmNumVentas  = ventasMes.length;
  _cmModoEdicion = false;
  _cmGastos = [];

  // Ir directo al panel — el mes se cierra al guardar
  document.getElementById('cm-paso1').style.display = 'none';
  document.getElementById('cm-panel').style.cssText = 'display:flex;flex-direction:column;gap:18px;padding:20px 24px;overflow-y:auto;max-height:72vh;';

  const tituloEl = document.getElementById('cm-titulo');
  const subEl    = document.getElementById('cm-subtitulo');
  if (tituloEl) tituloEl.textContent = _repFmtMes(mes);
  if (subEl)    subEl.textContent    = 'Agrega gastos y divide la utilidad antes de cerrar';

  document.getElementById('cm-p-ventas').textContent   = _cmNumVentas;
  document.getElementById('cm-p-ingresos').textContent = _fmtCOP(_cmIngresos);
  const ganEl = document.getElementById('cm-p-ganancia-bruta');
  ganEl.textContent = _fmtCOP(_cmGanBruta);
  ganEl.style.color = 'var(--text)';
  document.getElementById('cm-trabajadores').value = 1;

  // Selector de mes en el panel
  const sel = document.getElementById('cm-mes-panel');
  if (sel) {
    sel.innerHTML = meses.map(m=>`<option value="${m}">${_repFmtMes(m)}</option>`).join('');
    sel.onchange = async () => {
      const m2 = sel.value;
      _cmMesActual = m2;
      const vm2 = ventas.filter(v=>(v.fecha_venta||'').startsWith(m2));
      const eg2 = enviosSky.filter(e=>(e.fecha||'').startsWith(m2)&&!idsMl.has(e.num_venta)).reduce((s,e)=>s+(parseFloat(e.valor)||0),0);
      _cmIngresos  = vm2.reduce((s,v)=>s+calcVenta(v).totalVenta,0);
      _cmGanBruta  = vm2.reduce((s,v)=>s+calcVenta(v).ganancia,0) - eg2;
      _cmNumVentas = vm2.length;
      _cmGastos = [];
      document.getElementById('cm-p-ventas').textContent   = _cmNumVentas;
      document.getElementById('cm-p-ingresos').textContent = _fmtCOP(_cmIngresos);
      ganEl.textContent = _fmtCOP(_cmGanBruta);
      ganEl.style.color = _cmGanBruta >= 0 ? 'var(--teal)' : 'var(--red)';
      if (tituloEl) tituloEl.textContent = _repFmtMes(m2);
      document.getElementById('cm-trabajadores').value = 1;
      _cmRenderGastos();
      _cmActualizarTotales();
    };
  }

  _cmRenderGastos();
  _cmActualizarTotales();
  const btnGuardar = document.getElementById('cm-btn-guardar');
  if (btnGuardar) btnGuardar.textContent = 'Cerrar mes';
  openModal('modal-cierre-mes');
}

// ── Abrir modal para VER / EDITAR cierre existente ──
async function abrirCierreExistente(mes) {
  const cierres = await _getCierres();
  const cl = cierres.find(c=>c.mes===mes);
  if (!cl) return;

  _cmModoEdicion = true;
  _cmMesActual   = mes;
  _cmGanBruta    = parseFloat(cl.ganancia_raw) || 0;
  _cmIngresos    = parseFloat(cl.ingresos_raw) || 0;
  _cmNumVentas   = cl.num_ventas || 0;
  _cmGastos      = (cl.gastos || []).map(g=>({...g}));

  document.getElementById('cm-paso1').style.display = 'none';
  document.getElementById('cm-panel').style.cssText = 'display:flex;flex-direction:column;gap:18px;padding:20px 24px;overflow-y:auto;max-height:72vh;';
  document.getElementById('cm-titulo').textContent = _repFmtMes(mes);
  document.getElementById('cm-subtitulo').textContent = 'Resumen cerrado — ver y editar';
  // Ocultar selector de mes en modo edición
  const mw = document.getElementById('cm-mes-panel-wrap');
  if (mw) mw.style.display = 'none';

  document.getElementById('cm-p-ventas').textContent    = _cmNumVentas;
  document.getElementById('cm-p-ingresos').textContent  = _fmtCOP(_cmIngresos);
  document.getElementById('cm-p-ganancia-bruta').textContent = _fmtCOP(_cmGanBruta);
  document.getElementById('cm-p-ganancia-bruta').style.color = _cmGanBruta >= 0 ? 'var(--teal)' : 'var(--red)';
  document.getElementById('cm-trabajadores').value = cl.trabajadores || 1;

  _cmRenderGastos();
  _cmActualizarTotales();
  const btnG = document.getElementById('cm-btn-guardar');
  if (btnG) btnG.textContent = 'Guardar cambios';
  openModal('modal-cierre-mes');
}

// ── Preview al cambiar mes en modo nuevo ──
async function _cmActualizarPreview() {
  const mes = document.getElementById('cm-mes')?.value;
  if (!mes) return;
  const [ventas, enviosSky] = await Promise.all([DB.ventas(), DB.envios_sky()]);

  const ventasMes = ventas.filter(v=>(v.fecha_venta||'').startsWith(mes));
  const idsMl = new Set(ventas.map(v=>v.id_ml).filter(Boolean));
  const egSky = enviosSky
    .filter(e=>(e.fecha||'').startsWith(mes) && !idsMl.has(e.num_venta))
    .reduce((s,e)=>s+(parseFloat(e.valor)||0), 0);

  _cmIngresos  = ventasMes.reduce((s,v)=>s+calcVenta(v).totalVenta, 0);
  _cmGanBruta  = ventasMes.reduce((s,v)=>s+calcVenta(v).ganancia, 0) - egSky;
  _cmNumVentas = ventasMes.length;

  const el = document.getElementById('cm-resumen-fin');
  if (el) {
    el.style.display = '';
    document.getElementById('cm-num-ventas').textContent  = _cmNumVentas;
    document.getElementById('cm-ingresos').textContent    = _fmtCOP(_cmIngresos);
    const ganEl = document.getElementById('cm-ganancia-bruta');
    ganEl.textContent  = _fmtCOP(_cmGanBruta);
    ganEl.style.color  = _cmGanBruta >= 0 ? 'var(--teal)' : 'var(--red)';
  }
}

// ── Confirmar cierre nuevo con código ──
async function confirmarCierreMes() {
  const errEl  = document.getElementById('cm-err');
  const codigo = document.getElementById('cm-codigo')?.value.trim();
  const mes    = document.getElementById('cm-mes')?.value;
  errEl.textContent = '';
  if (!codigo) { errEl.textContent = 'Ingresa tu código de acceso.'; return; }
  if (!mes)    { errEl.textContent = 'Selecciona un mes.'; return; }

  const ok = await _verificarCodigoAcceso(codigo);
  if (!ok) { errEl.textContent = 'Código incorrecto.'; document.getElementById('cm-codigo').value=''; return; }

  // Guardar el cierre
  const cierres = await _getCierres();
  _cmMesActual = mes;
  _cmGastos    = [];
  const nuevo = {
    mes,
    num_ventas:   _cmNumVentas,
    ingresos_fmt: _fmtCOP(_cmIngresos),
    ingresos_raw: _cmIngresos,
    ganancia_fmt: _fmtCOP(_cmGanBruta),
    ganancia_raw: _cmGanBruta,
    utilidad_fmt: _fmtCOP(_cmGanBruta),
    utilidad_raw: _cmGanBruta,
    gastos:       [],
    trabajadores: 1,
    fecha_cierre: new Date().toISOString(),
  };
  cierres.push(nuevo);
  await _saveCierres(cierres);
  await renderCierresMes();

  // Cambiar a panel principal
  _cmModoEdicion = true;
  document.getElementById('cm-paso1').style.display    = 'none';
  document.getElementById('cm-panel').style.cssText    = 'display:flex;flex-direction:column;gap:18px;padding:20px 24px;overflow-y:auto;max-height:72vh;';
  document.getElementById('cm-titulo').textContent    = _repFmtMes(mes);
  document.getElementById('cm-subtitulo').textContent = 'Mes cerrado — agrega gastos y divide la utilidad';
  document.getElementById('cm-p-ventas').textContent   = _cmNumVentas;
  document.getElementById('cm-p-ingresos').textContent = _fmtCOP(_cmIngresos);
  const ganEl = document.getElementById('cm-p-ganancia-bruta');
  ganEl.textContent = _fmtCOP(_cmGanBruta);
  ganEl.style.color = 'var(--text)';
  document.getElementById('cm-trabajadores').value = 1;
  _cmRenderGastos();
  _cmActualizarTotales();
}

// ── Gastos ──
function _cmAgregarGasto() {
  const id = 'g_' + Date.now();
  _cmGastos.push({ id, concepto: '', valor: 0 });
  _cmRenderGastos();
  setTimeout(() => {
    const inputs = document.querySelectorAll('.cm-gasto-concepto');
    const last = inputs[inputs.length-1];
    if (last) {
      last.focus();
      // Animación entrada
      const row = last.closest('.cm-gasto-row');
      if (row) { row.style.opacity='0'; row.style.transform='translateY(8px)'; requestAnimationFrame(()=>{ row.style.transition='opacity .2s,transform .2s'; row.style.opacity='1'; row.style.transform='translateY(0)'; }); }
    }
  }, 30);
}

function _cmRenderGastos() {
  const listaEl = document.getElementById('cm-gastos-lista');
  const emptyEl = document.getElementById('cm-gastos-empty');
  if (!listaEl) return;

  // If empty, show centered add button
  if (!_cmGastos.length) {
    listaEl.innerHTML = `<div style="display:flex;justify-content:flex-end;padding:4px 0;">
      <button onclick="_cmAgregarGasto()" title="Agregar gasto"
        style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border:1.5px dashed var(--border);border-radius:8px;background:none;cursor:pointer;color:var(--text2);transition:all .15s;"
        onmouseover="this.style.borderColor='var(--teal)';this.style.color='var(--teal)'"
        onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>`;
    if (emptyEl) emptyEl.style.display = 'none';
    return;
  }

  // Render gastos + botón + en la parte inferior
  const rows = _cmGastos.map((g) => {
    const valFmt = g.valor ? Number(g.valor).toLocaleString('es-CO') : '';
    return `<div class="cm-gasto-row" data-gid="${g.id}" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--white);border:1px solid var(--border);border-radius:10px;margin-bottom:6px;transition:box-shadow .15s;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
      <input type="text" class="cm-gasto-concepto"
        value="${g.concepto||''}"
        placeholder="Concepto del gasto"
        oninput="_cmUpdateGasto('${g.id}','concepto',this.value)"
        style="flex:1;font-size:13px;font-family:Poppins,sans-serif;border:none;outline:none;background:transparent;color:var(--text);">
      <span style="width:1px;height:18px;background:var(--border);flex-shrink:0;"></span>
      <input type="text" inputmode="numeric" class="cm-gasto-valor"
        value="${valFmt}"
        placeholder="0"
        oninput="_cmLiveFormatValor(this,'${g.id}')"
        style="width:130px;font-size:13px;font-weight:600;text-align:right;font-family:Poppins,sans-serif;border:none;outline:none;background:transparent;color:var(--text);">
      <button onclick="_cmEliminarGasto('${g.id}')" title="Eliminar"
        style="width:24px;height:24px;border:none;background:none;cursor:pointer;color:var(--text3);flex-shrink:0;border-radius:6px;display:flex;align-items:center;justify-content:center;padding:0;transition:all .15s;"
        onmouseover="this.style.color='var(--red)';this.style.background='var(--red-bg)'"
        onmouseout="this.style.color='var(--text3)';this.style.background='none'">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>`;
  }).join('');

  // Botón + al final (solo icono)
  const addBtn = `<div style="display:flex;justify-content:flex-end;margin-top:4px;">
    <button onclick="_cmAgregarGasto()" title="Agregar gasto"
      style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border:1.5px dashed var(--border);border-radius:8px;background:none;cursor:pointer;color:var(--text2);transition:all .15s;"
      onmouseover="this.style.borderColor='var(--teal)';this.style.color='var(--teal)'"
      onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </button>
  </div>`;

  listaEl.innerHTML = rows + addBtn;
  if (emptyEl) emptyEl.style.display = 'none';
}

// Formato en vivo con separador de miles mientras escribe
function _cmLiveFormatValor(input, id) {
  const pos = input.selectionStart;
  const raw = input.value.replace(/\./g, '').replace(/[^0-9]/g, '');
  const num = parseInt(raw) || 0;
  const fmt = num > 0 ? num.toLocaleString('es-CO') : '';
  input.value = fmt;
  // Restaurar posición del cursor aproximada
  const diff = fmt.length - (input.value.length || 0);
  try { input.setSelectionRange(fmt.length, fmt.length); } catch(e) {}
  const g = _cmGastos.find(x=>x.id===id);
  if (g) g.valor = num;
  _cmActualizarTotales();
}

function _cmUpdateGasto(id, campo, val) {
  const g = _cmGastos.find(x=>x.id===id);
  if (!g) return;
  if (campo === 'valor') g.valor = _parseNum(val);
  else g.concepto = val;
  _cmActualizarTotales();
}

function _cmEliminarGasto(id) {
  // Animación de salida
  const row = document.querySelector(`.cm-gasto-row[data-gid="${id}"]`);
  if (row) {
    row.style.transition = 'opacity .15s,transform .15s';
    row.style.opacity = '0'; row.style.transform = 'translateX(-8px)';
    setTimeout(() => {
      _cmGastos = _cmGastos.filter(g=>g.id!==id);
      _cmRenderGastos(); _cmActualizarTotales();
    }, 150);
  } else {
    _cmGastos = _cmGastos.filter(g=>g.id!==id);
    _cmRenderGastos(); _cmActualizarTotales();
  }
}

// ── Totales y división ──
function _cmActualizarTotales() {
  const totalGastos = _cmGastos.reduce((s,g)=>s+(parseFloat(g.valor)||0), 0);
  const utilidad    = _cmGanBruta - totalGastos;
  document.getElementById('cm-r-bruta').textContent   = _fmtCOP(_cmGanBruta);
  document.getElementById('cm-r-gastos').textContent  = '− ' + _fmtCOP(totalGastos);
  const netaEl = document.getElementById('cm-r-neta');
  netaEl.textContent = _fmtCOP(utilidad);

  netaEl.style.color = utilidad >= 0 ? 'var(--teal)' : 'var(--red)';
  _cmActualizarDivision(utilidad);
}

function _cmActualizarDivision(utilidad) {
  if (utilidad === undefined) {
    const totalGastos = _cmGastos.reduce((s,g)=>s+(parseFloat(g.valor)||0), 0);
    utilidad = _cmGanBruta - totalGastos;
  }
  const n = Math.max(1, parseInt(document.getElementById('cm-trabajadores')?.value) || 1);
  const porPersona = Math.floor(utilidad / n);
  const resEl = document.getElementById('cm-division-resultado');
  if (!resEl) return;

  if (n === 1) {
    resEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--teal-bg);border:1px solid rgba(0,137,123,.2);border-radius:8px;">
        <span style="font-size:12px;font-weight:500;color:var(--teal);font-family:Poppins,sans-serif;">Utilidad total</span>
        <span style="font-size:15px;font-weight:500;color:${utilidad>=0?'var(--teal)':'var(--red)'};font-family:Poppins,sans-serif;">${_fmtCOP(utilidad)}</span>
      </div>`;
  } else {
    const cols = Math.min(n, 4);
    const userIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    resEl.innerHTML = `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px;">
      ${Array.from({length:n},(_,i)=>`
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:10px;">
          <span style="color:var(--text3);display:flex;align-items:center;flex-shrink:0;">${userIcon}</span>
          <span style="font-size:14px;font-weight:500;color:${porPersona>=0?'var(--teal)':'var(--red)'};font-family:Poppins,sans-serif;">${_fmtCOP(porPersona)}</span>
        </div>`).join('')}
    </div>`;
  }
}

// ── Guardar cambios (edición de cierre existente) ──
function _cmGuardarCambios() {
  // Si es nuevo cierre, mostrar modal de confirmación primero
  if (!_cmModoEdicion) {
    const totalGastos = _cmGastos.reduce((s,g)=>s+(parseFloat(g.valor)||0), 0);
    const utilidad = _cmGanBruta - totalGastos;
    const n = Math.max(1, parseInt(document.getElementById('cm-trabajadores')?.value)||1);
    const porPersona = n > 1 ? ` (${_fmtCOP(utilidad/n)} por persona)` : '';
    document.getElementById('cm-confirm-mes-label').textContent = _repFmtMes(_cmMesActual);
    document.getElementById('cm-confirm-utilidad').textContent = _fmtCOP(utilidad) + porPersona;
    openModal('modal-confirmar-cierre');
    return;
  }
  _cmGuardarCambiosConfirmado();
}
async function _cmGuardarCambiosConfirmado() {
  closeModal('modal-confirmar-cierre');
  const cierres = await _getCierres();
  const idx = cierres.findIndex(c=>c.mes===_cmMesActual);

  const totalGastos = _cmGastos.reduce((s,g)=>s+(parseFloat(g.valor)||0), 0);
  const utilidad    = _cmGanBruta - totalGastos;
  const trabNum     = Math.max(1, parseInt(document.getElementById('cm-trabajadores')?.value)||1);

  if (idx < 0) {
    // Nuevo cierre — guardar directamente
    const nuevo = {
      mes: _cmMesActual,
      num_ventas:   _cmNumVentas,
      ingresos_fmt: _fmtCOP(_cmIngresos),
      ingresos_raw: _cmIngresos,
      ganancia_fmt: _fmtCOP(_cmGanBruta),
      ganancia_raw: _cmGanBruta,
      utilidad_fmt: _fmtCOP(utilidad),
      utilidad_raw: utilidad,
      gastos:       _cmGastos.map(g=>({id:g.id, concepto:g.concepto, valor:parseFloat(g.valor)||0})),
      trabajadores: trabNum,
      fecha_cierre: new Date().toISOString(),
    };
    cierres.push(nuevo);
    await _saveCierres(cierres);
    await renderCierresMes();
    closeModal('modal-cierre-mes');
    showToast(`${_repFmtMes(_cmMesActual)} cerrado`, 'success', 2500);
    return;
  }

  const ganAnt     = parseFloat(cierres[idx].utilidad_raw ?? cierres[idx].ganancia_raw) || 0;
  const diferencia = utilidad - ganAnt;

  // Si hay diferencia de utilidad, registrar un movimiento de ajuste en el mes actual
  if (Math.abs(diferencia) > 0) {
    const tipo  = diferencia > 0 ? 'ingreso' : 'egreso';
    const valor = Math.abs(diferencia);
    const fecha = hoy();
    const id    = 'ajuste_cierre_' + _cmMesActual + '_' + Date.now();
    await DB.upsertMovimiento({
      id, fecha, tipo,
      fuente: 'skydropx', // por defecto; el usuario puede ajustar desde finanzas
      valor,
      concepto: `Ajuste cierre ${_repFmtMes(_cmMesActual)}`,
      notas: `Diferencia por edición de cierre de mes (${diferencia>=0?'+':''}${_fmtCOP(diferencia)})`,
      fecha_registro: new Date().toISOString(),
    });
  }

  // Actualizar el cierre
  cierres[idx] = {
    ...cierres[idx],
    gastos:       _cmGastos.map(g=>({id:g.id, concepto:g.concepto, valor:parseFloat(g.valor)||0})),
    utilidad_fmt: _fmtCOP(utilidad),
    utilidad_raw: utilidad,
    trabajadores: trabNum,
    editado:      new Date().toISOString(),
  };
  await _saveCierres(cierres);
  await renderCierresMes();
  closeModal('modal-cierre-mes');
  showToast('Cierre guardado correctamente', 'success', 2500);
}

// ── Reabrir mes ──
var _reabrirMesPendiente = '';
function _reabrirMes(mes) {
  _reabrirMesPendiente = mes;
  const inp = document.getElementById('cm-reabrir-code');
  const err = document.getElementById('cm-reabrir-err');
  if (inp) inp.value = '';
  if (err) err.textContent = '';
  document.getElementById('cm-reabrir-mes-label').textContent = _repFmtMes(mes);
  openModal('modal-reabrir-mes');
}
async function _confirmarReabrirMes() {
  const inp = document.getElementById('cm-reabrir-code');
  const err = document.getElementById('cm-reabrir-err');
  const codigo = inp?.value.trim();
  if (!codigo) { if (err) err.textContent = 'Ingresa el código.'; return; }
  const ok = await _verificarCodigoAcceso(codigo);
  if (!ok) { if (err) err.textContent = 'Código incorrecto.'; inp.value = ''; inp.focus(); return; }
  const cierres = await _getCierres();
  await _saveCierres(cierres.filter(c=>c.mes!==_reabrirMesPendiente));
  await renderCierresMes();
  closeModal('modal-reabrir-mes');
  showToast(`${_repFmtMes(_reabrirMesPendiente)} reabierto`, 'success', 2000);
}