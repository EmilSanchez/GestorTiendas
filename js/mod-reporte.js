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