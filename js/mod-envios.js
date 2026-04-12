/* Módulo Envíos + Pago múltiple */

// MÓDULO ENVÍOS — basado en ventas registradas
// ══════════════════════════════════════════════════════════

// filtrarEnvios: atajo desde las tarjetas resumen (clic en pendiente/pagado)
function filtrarEnvios(empresa, pago) {
  sv('ef-empresa', empresa);
  sv('ef-pago', pago);
  sv('ef-search',''); sv('ef-tienda',''); sv('ef-mes','');
  renderEnvios();
}

function clearEnvioFilters() {
  ['ef-search','ef-mes'].forEach(i=>sv(i,''));
  ['ef-empresa','ef-tienda','ef-pago'].forEach(i=>sv(i,''));
  const btnL = document.getElementById('btn-limpiar-envios');
  if(btnL) btnL.style.display = 'none';
  renderEnvios();
}

// ── Obtener el valor del envío de una venta (en COP) ──
function _envioValorCOP(v) {
  if(v.envio_validado && v.envio_real_cop > 0) return v.envio_real_cop;
  const trm = parseFloat(v.trm) || TRM_ACTUAL;
  const rawVal = parseFloat(v.envio_int_usd) || 0;
  // Si se guardó como COP (flag envio_int_es_cop), no multiplicar por TRM
  if(v.envio_int_es_cop) return rawVal;
  // Datos legacy: servientrega antiguo puede estar en USD, convertir
  if(v.envio_tipo === 'servientrega') return rawVal * trm;
  return rawVal;
}

// Modal para registrar pago de envío
let _pagoEnvioVentaId = null;
async function openPagoEnvio(ventaId) {
  _pagoEnvioVentaId = ventaId;
  const v = (await DB.ventas()).find(x=>x.id===ventaId);
  if(!v) return;
  const tiendas = await DB.tiendas();
  const t = tiendas.find(x=>x.id===v.tienda_id);
  const estimadoCOP = _envioValorCOP(v);
  const esServientrega = v.envio_tipo === 'servientrega';
  const empresa = esServientrega ? 'Servientrega' : 'Aguachica';
  const trm = parseFloat(v.trm) || getDolarComprasConfigurado() || TRM_ACTUAL;

  // Para Servientrega: mostrar estimado en USD (igual que Gestor de Ventas)
  let estimadoMostrar, estimadoLabel;
  if(esServientrega) {
    const estimadoUSD = estimadoCOP / trm;
    estimadoMostrar = `$ ${estimadoUSD.toFixed(2)} USD`;
    estimadoLabel = `$ ${estimadoUSD.toFixed(2)} USD <span style="color:var(--text3);font-size:10px;">(≈ ${fmt(estimadoCOP)} COP)</span>`;
  } else {
    estimadoMostrar = fmt(estimadoCOP);
    estimadoLabel = fmt(estimadoCOP);
  }

  document.getElementById('mpe-info').innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;">
      <div><span style="font-size:10px;color:var(--text3);">Venta</span><br><b>${v.id_ml||v.id}</b></div>
      <div><span style="font-size:10px;color:var(--text3);">Tienda</span><br><b>${t?.nombre||'?'}</b></div>
      <div><span style="font-size:10px;color:var(--text3);">Transportadora</span><br><b>${empresa}</b></div>
      <div><span style="font-size:10px;color:var(--text3);">Valor estimado</span><br><b style="color:var(--teal);">${estimadoLabel}</b></div>
      ${esServientrega ? `<div><span style="font-size:10px;color:var(--text3);">TRM usado</span><br><b>${fmt(trm)}</b></div>` : ''}
    </div>
    ${esServientrega ? `<div style="margin-top:8px;font-size:11px;background:var(--yellow-bg);color:var(--yellow);padding:6px 10px;border-radius:6px;border:1px solid #ffe08a;">
      ⚠️ Servientrega: ingresa el valor en <strong>USD</strong> tal como aparece en Centris (Gestor de Ventas). Se convertirá automáticamente a COP.
    </div>` : ''}`;

  // Ajustar el label e input del valor según transportadora
  const labelEl = document.getElementById('mpe-valor-label');
  const inputEl = document.getElementById('mpe-valor');
  const hintEl  = document.getElementById('mpe-valor-hint');
  const diffEl  = document.getElementById('mpe-diff-box');
  if(labelEl) labelEl.textContent = esServientrega
    ? 'Valor real del envío pagado (USD$) *'
    : 'Valor real del envío pagado (COP$) *';
  if(inputEl) {
    inputEl.placeholder = esServientrega ? 'Ej: 4.50' : 'Ej: 19000';
    inputEl.step        = esServientrega ? '0.01' : '1';
    // Pre-rellenar con estimado en la unidad correcta
    inputEl.value       = esServientrega ? (estimadoCOP / trm).toFixed(2) : (estimadoCOP || '');
    // Guardar contexto en el input para la conversión
    inputEl.dataset.esServientrega = esServientrega ? '1' : '0';
    inputEl.dataset.trm = trm;
    inputEl.dataset.estimadoCOP = estimadoCOP;
    // Listener para mostrar conversión en tiempo real
    inputEl.oninput = () => _calcDiffPagoEnvio();
  }
  if(hintEl) hintEl.textContent = esServientrega
    ? 'Valor en USD tal como aparece en Centris. Se convierte a COP automáticamente.'
    : 'Deja en blanco para usar el valor estimado';
  if(diffEl) diffEl.style.display = 'none';

  sv('mpe-nota', v.nota_envio_pago || '');
  _calcDiffPagoEnvio();
  openModal('modal-pago-envio');
}

function _calcDiffPagoEnvio() {
  const inputEl = document.getElementById('mpe-valor');
  const diffEl  = document.getElementById('mpe-diff-box');
  const diffTxt = document.getElementById('mpe-diff-text');
  if(!inputEl || !diffEl) return;
  const raw = parseFloat(inputEl.value);
  if(isNaN(raw)) { diffEl.style.display = 'none'; return; }
  const esServientrega = inputEl.dataset.esServientrega === '1';
  const trm = parseFloat(inputEl.dataset.trm) || TRM_ACTUAL;
  const estimadoCOP = parseFloat(inputEl.dataset.estimadoCOP) || 0;
  const realCOP = esServientrega ? Math.round(raw * trm) : raw;
  const diff = realCOP - estimadoCOP;
  diffEl.style.display = 'block';
  if(esServientrega) {
    diffEl.style.background = '#f0f9ff';
    diffTxt.style.color = 'var(--teal-dark)';
    diffTxt.textContent = `= ${fmt(realCOP)} COP`;
  }
  if(Math.abs(diff) < 1) {
    diffEl.style.background = '#e0f2f1';
    diffTxt.style.color = '#00695c';
    diffTxt.textContent = esServientrega ? `= ${fmt(realCOP)} COP ✔ Igual al estimado` : '✔ Igual al estimado';
  } else if(diff > 0) {
    diffEl.style.background = '#fde8ea';
    diffTxt.style.color = '#b0202e';
    diffTxt.textContent = (esServientrega ? `= ${fmt(realCOP)} COP — ` : '') + `▲ +${fmt(diff)} más caro que el estimado`;
  } else {
    diffEl.style.background = '#d1f0e0';
    diffTxt.style.color = '#1b7e4a';
    diffTxt.textContent = (esServientrega ? `= ${fmt(realCOP)} COP — ` : '') + `▼ ${fmt(Math.abs(diff))} más barato que el estimado`;
  }
}

async function guardarPagoEnvio() {
  if(!_pagoEnvioVentaId) return;
  const ventas = await DB.ventas();
  const v = ventas.find(x=>x.id===_pagoEnvioVentaId);
  if(!v) return;
  const inputEl = document.getElementById('mpe-valor');
  const rawVal  = parseFloat(gv('mpe-valor'));
  const esServientrega = v.envio_tipo === 'servientrega';
  const trm = parseFloat(v.trm) || getDolarComprasConfigurado() || TRM_ACTUAL;
  let valorReal;
  if(isNaN(rawVal)) {
    valorReal = _envioValorCOP(v);
  } else if(esServientrega) {
    // El usuario ingresó en USD → convertir a COP
    valorReal = Math.round(rawVal * trm);
  } else {
    valorReal = rawVal;
  }
  v.envio_pagado      = true;
  v.envio_real_cop    = valorReal;
  v.envio_validado    = true;
  v.nota_envio_pago   = gv('mpe-nota').trim();
  await DB.saveVentas(ventas);
  closeModal('modal-pago-envio');
  showConfirmAnim('pago', false);
  await renderEnvios();
}

async function desmarcarPagoEnvio(ventaId) {
  if(!confirm('¿Desmarcar este envío como pagado?')) return;
  const ventas = await DB.ventas();
  const v = ventas.find(x=>x.id===ventaId);
  if(v) {
    v.envio_pagado   = false;
    v.envio_validado = false;
    await DB.saveVentas(ventas);
    await renderEnvios();
  }
}

async function renderEnvios() {
  const tiendas = await DB.tiendas();
  let ventas    = await DB.ventas();

  // Resetear selección al re-renderizar
  const btnMulti = document.getElementById('btn-pago-multiple');
  if(btnMulti) btnMulti.style.display = 'none';
  const countEl = document.getElementById('selected-count');
  if(countEl) countEl.textContent = '0';
  const chkAll = document.getElementById('chk-all-envios');
  if(chkAll) chkAll.checked = false;

  // Solo ventas con transportadora Aguachica o Servientrega y que tengan valor de envío
  ventas = ventas.filter(v =>
    (v.envio_tipo === 'aguachica' || v.envio_tipo === 'servientrega')
  );

  // ── Calcular resúmenes por transportadora ──
  const ag  = ventas.filter(v=>v.envio_tipo==='aguachica');
  const sv_ = ventas.filter(v=>v.envio_tipo==='servientrega');

  const agPend  = ag.filter(v=>!v.envio_pagado);
  const agPag   = ag.filter(v=>v.envio_pagado);
  const svPend  = sv_.filter(v=>!v.envio_pagado);
  const svPag   = sv_.filter(v=>v.envio_pagado);

  const _sum = arr => arr.reduce((s,v)=>s+_envioValorCOP(v),0);

  document.getElementById('env-ag-total-count').textContent = `${ag.length} envío${ag.length!==1?'s':''}`;
  document.getElementById('env-ag-pend-count').textContent  = agPend.length;
  document.getElementById('env-ag-pend-total').textContent  = fmt(_sum(agPend));
  document.getElementById('env-ag-pag-count').textContent   = agPag.length;
  document.getElementById('env-ag-pag-total').textContent   = fmt(_sum(agPag));

  document.getElementById('env-sv-total-count').textContent = `${sv_.length} envío${sv_.length!==1?'s':''}`;
  document.getElementById('env-sv-pend-count').textContent  = svPend.length;
  document.getElementById('env-sv-pend-total').textContent  = fmt(_sum(svPend));
  document.getElementById('env-sv-pag-count').textContent   = svPag.length;
  document.getElementById('env-sv-pag-total').textContent   = fmt(_sum(svPag));

  // ── Aplicar filtros ──
  const s   = gv('ef-search').toLowerCase();
  const fe  = gv('ef-empresa');
  const fp  = gv('ef-pago');
  const ft  = gv('ef-tienda');
  const fm  = gv('ef-mes');

  // Mostrar/ocultar botón Limpiar envíos
  const btnLimpiarEnv = document.getElementById('btn-limpiar-envios');
  if(btnLimpiarEnv) btnLimpiarEnv.style.display = (s||fe||fp||ft||fm) ? 'inline-flex' : 'none';

  if(s)   ventas = ventas.filter(v=>(v.id_ml+v.telefono+(v.nota||'')).toLowerCase().includes(s));
  if(fe)  ventas = ventas.filter(v=>v.envio_tipo===fe);
  if(fp === 'pendiente') ventas = ventas.filter(v=>!v.envio_pagado);
  if(fp === 'pagado')    ventas = ventas.filter(v=>v.envio_pagado);
  if(ft)  ventas = ventas.filter(v=>v.tienda_id===ft);
  if(fm)  ventas = ventas.filter(v=>v.fecha_venta?.startsWith(fm));

  ventas.sort((a,b)=>(b.fecha_venta||'').localeCompare(a.fecha_venta||''));

  document.getElementById('envios-count').textContent = `${ventas.length} envío(s) mostrado(s)`;

  document.getElementById('envios-tbody').innerHTML = ventas.map((v,i)=>{
    const t = tiendas.find(x=>x.id===v.tienda_id);
    const fotoEl = t?.foto
      ? `<img src="${t.foto}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
      : `<span class="tienda-dot" style="background:${t?.color||'#aaa'}"></span>`;
    const esAg  = v.envio_tipo==='aguachica';
    const label = esAg ? 'Aguachica' : 'Servientrega';
    const bgCol = esAg ? '#1d4ed8' : '#16a34a';
    const txtCol= '#fff';
    const borCol= esAg ? '#1e40af' : '#15803d';
    const valorEnvio = _envioValorCOP(v);
    const pagado = v.envio_pagado;

    return `<tr>
      <td style="text-align:center;">
        ${!pagado ? `<input type="checkbox" class="chk-envio" data-id="${v.id}" data-valor="${valorEnvio}" onchange="actualizarSeleccionEnvios()" style="cursor:pointer;">` : ''}
      </td>
      <td class="td-mono c-dim" style="text-align:center;">${i+1}</td>
      <td>
        <span style="display:flex;align-items:center;gap:5px;">
          ${fotoEl}
          <span style="font-size:13px;font-weight:600;">${t?.nombre||'?'}</span>
        </span>
      </td>
      <td><span class="venta-id" onclick="copiarIdVenta('${v.id_ml||v.id}',this)" title="Clic para copiar ID">${v.id_ml||v.id}</span></td>
      <td class="td-dim">${v.fecha_venta||'—'}</td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:4px;background:${bgCol};color:${txtCol};
          border:1px solid ${borCol};border-radius:20px;padding:3px 9px;font-size:12px;font-weight:700;">
          ${label}
        </span>
      </td>
      <td class="td-mono">
        ${valorEnvio > 0 ? fmt(valorEnvio) : '<span class="c-dim">—</span>'}
        ${v.envio_extra>0 ? `<div style="font-size:11px;color:var(--text3);">+extra ${fmt(v.envio_extra)}</div>` : ''}
      </td>
      <td>
        <span class="badge badge-${v.estado||'pendiente'}">${v.estado||'pendiente'}</span>
      </td>
      <td>
        ${pagado
          ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#dcfce7;color:#16a34a;
               border:1px solid #bbf7d0;border-radius:20px;padding:4px 11px;font-size:14px;font-weight:700;">
               Pagado
             </span>
             ${v.nota_envio_pago ? `<div style="font-size:13px;color:var(--text3);margin-top:2px;">${v.nota_envio_pago}</div>` : ''}`
          : `<span style="display:inline-flex;align-items:center;gap:4px;background:#fef9c3;color:#854d0e;
               border:1px solid #fde68a;border-radius:20px;padding:4px 11px;font-size:14px;font-weight:700;">
               Pendiente
             </span>`
        }
      </td>
      <td>
        <div class="actions-cell">
          ${pagado
            ? `<button class="btn btn-ghost btn-sm" style="font-size:13px;" onclick="desmarcarPagoEnvio('${v.id}')">Desmarcar</button>`
            : `<button class="btn btn-primary btn-sm" style="font-size:13px;" onclick="openPagoEnvio('${v.id}')">Pagar</button>`
          }
        </div>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="10" class="text-center c-dim" style="padding:40px;">Sin envíos registrados. Las ventas con Aguachica o Servientrega aparecerán aquí.</td></tr>';
}

// ══════════════════════════════════════════════════════════
// PAGO MÚLTIPLE DE ENVÍOS
// ══════════════════════════════════════════════════════════

function actualizarSeleccionEnvios() {
  const checks = document.querySelectorAll('.chk-envio:checked');
  const count  = checks.length;
  const btnMulti = document.getElementById('btn-pago-multiple');
  const countEl  = document.getElementById('selected-count');
  if(btnMulti) btnMulti.style.display = count > 0 ? 'inline-flex' : 'none';
  if(countEl)  countEl.textContent = count;
}

function toggleAllEnvios(checked) {
  document.querySelectorAll('.chk-envio').forEach(c => c.checked = checked);
  actualizarSeleccionEnvios();
}

async function openPagoMultiple() {
  const checks = document.querySelectorAll('.chk-envio:checked');
  if(!checks.length) return;

  const ids = Array.from(checks).map(c => c.dataset.id);
  const ventas = await DB.ventas();
  const tiendas = await DB.tiendas();
  const seleccionadas = ventas.filter(v => ids.includes(v.id));

  let total = 0;
  const filas = seleccionadas.map(v => {
    const t = tiendas.find(x=>x.id===v.tienda_id);
    const val = _envioValorCOP(v);
    total += val;
    const empresa = v.envio_tipo === 'servientrega' ? '📦 Servientrega' : '🏍 Aguachica';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-bottom:1px solid var(--border);font-size:12px;">
      <div>
        <span class="venta-id" onclick="copiarIdVenta('${v.id_ml||v.id}',this)" title="Clic para copiar ID">${v.id_ml||v.id}</span>
        <span class="c-dim" style="margin:0 6px;">·</span>
        <span style="font-size:11px;">${t?.nombre||'?'}</span>
        <span class="c-dim" style="margin:0 6px;">·</span>
        <span style="font-size:11px;">${empresa}</span>
      </div>
      <span style="font-weight:600;color:var(--teal-dark);">${fmt(val)}</span>
    </div>`;
  }).join('');

  document.getElementById('mpm-lista').innerHTML = filas || '<div class="c-dim" style="padding:16px;text-align:center;font-size:12px;">Sin envíos seleccionados.</div>';
  document.getElementById('mpm-total').textContent = fmt(total);
  document.getElementById('mpm-nota').value = '';
  document.getElementById('modal-pago-multiple')._ids = ids;
  openModal('modal-pago-multiple');
}

async function confirmarPagoMultiple() {
  const ids  = document.getElementById('modal-pago-multiple')._ids || [];
  const nota = document.getElementById('mpm-nota').value.trim();
  if(!ids.length) return;

  const ventas = await DB.ventas();
  ids.forEach(id => {
    const v = ventas.find(x=>x.id===id);
    if(v) {
      v.envio_pagado    = true;
      v.envio_validado  = true;
      v.envio_real_cop  = v.envio_real_cop || _envioValorCOP(v);
      if(nota) v.nota_envio_pago = nota;
    }
  });
  await DB.saveVentas(ventas);

  // Desmarcar checkboxes y ocultar botón
  document.querySelectorAll('.chk-envio').forEach(c => c.checked = false);
  const chkAll = document.getElementById('chk-all-envios');
  if(chkAll) chkAll.checked = false;
  actualizarSeleccionEnvios();

  closeModal('modal-pago-multiple');
  await renderEnvios();
}

// ══════════════════════════════════════════════════════════
