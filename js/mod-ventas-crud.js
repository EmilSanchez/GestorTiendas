/* Módulo Ventas CRUD — modal registro */

// ── VENTAS ──
let _editVentaId = null;

async function openModalVenta(id) {
  _editVentaId = id||null;
  document.getElementById('mv-title').textContent = id ? 'Editar Venta' : 'Nueva Venta';
  const tiendas = await DB.tiendas();
  document.getElementById('v-tienda').innerHTML = tiendas.map(t=>`<option value="${t.id}">${t.nombre}</option>`).join('');

  if(id) {
    const v = (await DB.ventas()).find(x=>x.id===id);
    if(v) {
      sv('v-id', v.id_ml||''); sv('v-tienda', v.tienda_id||'');
      sv('v-fecha', v.fecha_venta||hoy());
      sv('v-tel', v.telefono||'');
      sv('v-udes', v.udes||1);
      sv('v-nota', v.nota||'');
      sv('v-envio-tipo', v.envio_tipo||'aguachica'); sv('v-envio-extra', v.envio_extra||0);
      sv('v-envio-validado', v.envio_validado ? '1' : '0');
      const trm = v.trm || getDolarComprasConfigurado();
      const copVenta = v.precio_cop || (v.precio_usd ? v.precio_usd * trm : '');
      sv('v-cop-venta', copVenta || '');
      sv('v-trm', getDolarComprasConfigurado());
      sv('v-costo-usd', v.costo_usd||''); sv('v-envio-int-usd', v.envio_int_usd||'');
      // Financiación
      sv('v-fuente-pago', v.fuente_pago||''); sv('v-monto-pago', v.monto_pago||'');
      sv('v-ref-pago', v.ref_pago||'');
      // Validación envío
      sv('v-envio-estimado', v.envio_estimado_cop||'');
      sv('v-envio-validado', v.envio_validado ? '1' : '0');
    }
  } else {
    ['v-id','v-tel','v-costo-usd','v-envio-int-usd','v-cop-venta','v-nota'].forEach(i=>sv(i,''));
    sv('v-fecha', hoy()); sv('v-udes',1);
    sv('v-envio-tipo','aguachica'); sv('v-envio-extra',0);
    sv('v-envio-validado','0');
    // Prellenar TRM con el dólar fijo configurado en BD
    sv('v-trm', getDolarComprasConfigurado());
    // Actualizar badge del TRM
    const badge = document.getElementById('trm-auto-badge');
    if(badge) {
      const desdeBD = parseFloat((_cache.ajustes||{}).dolar_compras_cop) > 0;
      badge.textContent = desdeBD ? 'FIJO BD' : 'MANUAL';
      badge.style.background = desdeBD ? 'var(--green-bg)' : 'var(--yellow-bg)';
      badge.style.color      = desdeBD ? 'var(--green)'    : 'var(--yellow)';
    }
  }
  recalcVenta();
  openModal('modal-venta');
}

function recalcVenta() {
  const copVenta = parseFloat(gv('v-cop-venta'))    || 0;
  const trm      = parseFloat(gv('v-trm')) || getDolarComprasConfigurado();
  const costoUsd = parseFloat(gv('v-costo-usd'))     || 0;
  const envioVal = parseFloat(gv('v-envio-int-usd')) || 0;
  const envExtra = parseFloat(gv('v-envio-extra'))   || 0;
  const udes     = parseFloat(gv('v-udes'))           || 1;
  const envTipo  = gv('v-envio-tipo');

  // Costo producto: USD × TRM
  const costoCOP = costoUsd * trm;

  // Envío: ahora TODOS los tipos ingresan en COP en el registro
  const envioIntCOP = envioVal; // ya es COP para todos

  // Actualizar label del campo según tipo
  const lblEnvio = document.getElementById('lbl-envio-int');
  if(lblEnvio) {
    lblEnvio.textContent = envTipo === 'servientrega'
      ? 'Envío Servientrega (COP$) — estimado'
      : 'Precio envío internacional (COP$)';
    const envInputEl = document.getElementById('v-envio-int-usd');
    if(envInputEl) {
      envInputEl.step        = '1';
      envInputEl.placeholder = '0';
    }
  }

  const totalV = copVenta;
  const totalC = costoCOP + envioIntCOP + envExtra;
  const gan    = totalV - totalC;
  const mar    = totalV > 0 ? (gan / totalV) * 100 : 0;

  // Resultado compacto
  const ganEl = document.getElementById('c-rv-gan');
  const totEl = document.getElementById('c-rv-total');
  const cosEl = document.getElementById('c-total-costos');
  const marEl = document.getElementById('c-rv-margen');
  if(ganEl) { ganEl.textContent = fmt(gan); ganEl.style.color = gan >= 0 ? 'var(--green)' : 'var(--red)'; }
  if(totEl)  totEl.textContent  = fmt(totalV);
  if(cosEl)  cosEl.textContent  = fmt(totalC);
  if(marEl)  marEl.textContent  = fmtP(mar);

  // Sincronizar campos hidden
  const elEstimado = document.getElementById('v-envio-estimado');
  if(elEstimado) elEstimado.value = Math.round(envioIntCOP) || '';
}

function getDolarComprasConfigurado() {
  // Primero intenta desde el cache de Firebase (ajustes), luego localStorage como fallback
  const ajustes = _cache.ajustes || {};
  const fromDB  = parseFloat(ajustes.dolar_compras_cop);
  if(fromDB > 0) return fromDB;
  const fromLocal = parseFloat(localStorage.getItem('dolar_compras_cop'));
  return fromLocal > 0 ? fromLocal : TRM_ACTUAL || 3800;
}

async function guardarDolarCompras() {
  const val = parseFloat(document.getElementById('cfg-dolar-compras').value) || 0;
  if(val <= 0) {
    alert('Ingresa un valor válido para el dólar.');
    return;
  }
  const btn = document.querySelector('[onclick="guardarDolarCompras()"]');
  if(btn) { btn.textContent = 'Guardando...'; btn.disabled = true; }
  try {
    const ajustes = await DB.ajustes();
    ajustes.dolar_compras_cop = val;
    await DB.saveAjustes(ajustes);
    // También guardar en localStorage como respaldo offline
    localStorage.setItem('dolar_compras_cop', val);
    // Actualizar badge en modal de venta
    const badge = document.getElementById('trm-auto-badge');
    if(badge) { badge.textContent = 'FIJO BD'; badge.style.background = 'var(--green-bg)'; badge.style.color = 'var(--green)'; }
    showToast('✅ Dólar actualizado: $ ' + Number(val).toLocaleString('es-CO'), 'success');
    await cargarDolarComprasEnConfig();
  } catch(e) {
    console.error(e);
    showToast('❌ Error al guardar. Verifica Firebase.', 'error');
  } finally {
    if(btn) { btn.textContent = 'Guardar'; btn.disabled = false; }
  }
}

async function cargarDolarComprasEnConfig() {
  // Cargar desde BD (cache) con fallback a localStorage
  const el = document.getElementById('cfg-dolar-compras');
  if(!el) return;
  const ajustes = await DB.ajustes();
  const val = parseFloat(ajustes.dolar_compras_cop) || parseFloat(localStorage.getItem('dolar_compras_cop')) || '';
  el.value = val || '';
  // Mostrar origen del valor
  const infoEl = document.getElementById('cfg-dolar-origen');
  if(infoEl) {
    if(ajustes.dolar_compras_cop > 0) {
      infoEl.textContent = `✅ Valor guardado en Firebase: $ ${Number(ajustes.dolar_compras_cop).toLocaleString('es-CO')}`;
      infoEl.style.color = 'var(--green)';
    } else {
      infoEl.textContent = `⚠️ Sin valor en BD — usando TRM del día: $ ${Number(TRM_ACTUAL).toLocaleString('es-CO')}`;
      infoEl.style.color = 'var(--yellow)';
    }
  }
}

async function saveVenta() {
  const tienda   = gv('v-tienda');
  const copVenta = parseFloat(gv('v-cop-venta')) || 0;
  if(!tienda)    { alert('Selecciona una tienda.'); return; }
  //if(!copVenta)  { alert('Ingresa el precio de venta en COP.'); return; }
  const producto = ''; // campo eliminado del formulario

  const trm       = parseFloat(gv('v-trm')) || TRM_ACTUAL;
  const envioTipo = gv('v-envio-tipo');
  const envioVal  = parseFloat(gv('v-envio-int-usd'))||0;
  const envioReal = parseFloat(gv('v-envio-real'))||0;

  // Calcular envio en COP: ahora todos los tipos ingresan en COP en el registro
  const envioEstimadoCOP = envioVal; // ya es COP para todos (Servientrega también)
  const envioFinalCOP    = envioReal > 0 ? envioReal : envioEstimadoCOP;

  const fuentePago = gv('v-fuente-pago');
  const montoPago  = parseFloat(gv('v-monto-pago'))||0;
  const costoUsd   = parseFloat(gv('v-costo-usd'))||0;
  const costoCOP   = costoUsd * trm;

  await DB.upsertVenta({
    id:            _editVentaId || uid(),
    id_ml:         gv('v-id').trim(),
    tienda_id:     tienda,
    fecha_venta:   gv('v-fecha'),
    fecha_entrega: gv('v-fecha-entrega'),
    cliente:       gv('v-cliente').trim(),
    telefono:      gv('v-tel').trim(),
    producto,
    udes:          parseFloat(gv('v-udes'))||1,
    envio_tipo:    envioTipo,
    envio_extra:   parseFloat(gv('v-envio-extra'))||0,
    precio_cop:    copVenta,
    precio_usd:    trm > 0 ? copVenta / trm : 0,
    trm,
    precio_venta:  copVenta,
    costo_usd:     costoUsd,
    envio_int_usd: envioVal,            // en COP para todos los tipos (registro inicial)
    envio_int_es_cop: true,             // siempre COP al registrar
    envio_estimado_cop: envioEstimadoCOP,
    envio_real_cop:     envioReal,
    envio_validado:     gv('v-envio-validado') === '1',
    fuente_pago:   fuentePago,
    monto_pago:    montoPago,
    ref_pago:      gv('v-ref-pago').trim(),
    nota:          gv('v-nota').trim(),
    estado:        _editVentaId ? ((await DB.ventas()).find(x=>x.id===_editVentaId)?.estado || 'pendiente') : 'pendiente',
    fecha_registro: new Date().toISOString(),
  });

  // Registrar egreso automático si se indicó fuente de pago
  if(fuentePago && montoPago > 0 && !_editVentaId) {
    // Descontar del saldo de la fuente de pago (gasto en producto)
    const saldos = await DB.saldos();
    saldos[fuentePago] = (parseFloat(saldos[fuentePago])||0) - montoPago;
    await DB.saveSaldos(saldos);

    await DB.upsertMovimiento({
      id: uid(), fecha: gv('v-fecha'), tipo:'egreso',
      fuente: fuentePago, valor: montoPago,
      concepto: `Compra · Tienda ${tienda} · ${gv('v-id')||'sin ID'}`.slice(0,60),
      notas: `Venta ${gv('v-id')||'—'} · costo $${costoUsd} USD`,
      fecha_registro: new Date().toISOString(),
    });
  }

  // ── Auto-sumar pago de ML al Mercado Pago de la tienda correspondiente ──
  // Si ML pagó (precio_cop > 0), sumarlo al saldo MP de esa tienda
  if(copVenta > 0 && !_editVentaId) {
    const saldos = await DB.saldos();
    const mpKey  = 'mercadopago_' + tienda;
    saldos[mpKey] = (parseFloat(saldos[mpKey])||0) + copVenta;
    // También al mercadopago global
    saldos['mercadopago'] = (parseFloat(saldos['mercadopago'])||0) + copVenta;
    await DB.saveSaldos(saldos);

    await DB.upsertMovimiento({
      id: uid(), fecha: gv('v-fecha'), tipo:'ingreso',
      fuente: 'mercadopago', valor: copVenta,
      concepto: `Pago ML · ${gv('v-id')||'sin ID'}`,
      notas: `Venta ${gv('v-id')||'—'} · Tienda: ${tienda}`,
      fecha_registro: new Date().toISOString(),
    });
  }

  closeModal('modal-venta');
  showConfirmAnim('venta', !!_editVentaId);
  await renderVentasGanancias();
  await updateAlertaBadge();
}

async function renderVentas() {
  const tiendas = await DB.tiendas();
  let ventas    = await DB.ventas();

  // ── Banner: usar el período activo (igual que renderVentasGanancias) ──
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

  // ── Filtros de tabla ──
  const s      = (document.getElementById('vf-search')?.value  || '').toLowerCase();
  const ft     = document.getElementById('vf-tienda')?.value   || '';
  const fe     = document.getElementById('vf-estado')?.value   || '';
  const fm     = document.getElementById('vf-mes')?.value      || '';
  const fDesde = document.getElementById('vf-desde')?.value    || '';
  const fHasta = document.getElementById('vf-hasta')?.value    || '';

  const hayFiltro = s || ft || fe || fm || fDesde || fHasta;
  const btnLimpiar = document.getElementById('btn-limpiar-ventas');
  if (btnLimpiar) btnLimpiar.style.display = hayFiltro ? 'inline-flex' : 'none';

  // Aplicar filtros sobre el total de ventas
  if (s)  ventas = ventas.filter(v => (v.id_ml+v.telefono+v.nota).toLowerCase().includes(s));
  if (ft) ventas = ventas.filter(v => v.tienda_id === ft);
  if (fe) ventas = ventas.filter(v => v.estado    === fe);

  // Período: rango tiene prioridad sobre mes
  if (fDesde || fHasta) {
    ventas = ventas.filter(v => {
      const f = v.fecha_venta || '';
      if (fDesde && f < fDesde) return false;
      if (fHasta && f > fHasta) return false;
      return true;
    });
  } else if (fm) {
    ventas = ventas.filter(v => v.fecha_venta?.startsWith(fm));
  }

  // Ordenar cronológico → invertir para mostrar más reciente arriba
  ventas.sort((a,b) => (a.fecha_venta||'').localeCompare(b.fecha_venta||''));
  const ventasConNum  = ventas.map((v,i) => ({ ...v, _num: i+1 }));
  const ventasMostrar = [...ventasConNum].reverse();

  document.getElementById('ventas-count').textContent = `${ventas.length} venta(s) mostrada(s)`;

  // Estilos de color por estado — colores sólidos, letras blancas
  const ESTADO_PILL = {
    pendiente: { bg:'#ffc000', color:'#000', border:'#e0a800' },
    en_camino: { bg:'#70ad47', color:'#fff', border:'#5a9438' },
    entregado: { bg:'#002060', color:'#fff', border:'#001540' },
    cancelado: { bg:'#ff0000', color:'#000', border:'#cc0000' },
    problema:  { bg:'#f9a825', color:'#000', border:'#e08c00' },
    devuelto:  { bg:'#ff00ff', color:'#fff', border:'#cc00cc' },
    error:     { bg:'#a61c00', color:'#fff', border:'#7a1400' },
  };

  document.getElementById('ventas-tbody').innerHTML = ventasMostrar.map((v)=>{
    const t = tiendas.find(x=>x.id===v.tienda_id);
    const c = calcVenta(v);
    const isLoss = c.ganancia < 0;
    const envioLabel = { ml:'ML', servientrega:'Servientrega', aguachica:'Aguachica', otro:'Otro' }[v.envio_tipo]||v.envio_tipo||'—';
    const pill = ESTADO_PILL[v.estado] || { bg:'#f3f8f8', color:'var(--text2)', border:'var(--border)' };
    const selectStyle = `font-size:12px;padding:4px 8px;border-radius:20px;font-weight:800;cursor:pointer;`
      + `background:${pill.bg};color:${pill.color};border:1.5px solid ${pill.border};outline:none;`
      + `appearance:none;-webkit-appearance:none;text-align:center;min-width:96px;`;
    return `<tr class="${isLoss?'loss-row':''}">
      <td class="td-mono c-dim" style="text-align:center;">${v._num}</td>
      <td>
        <span style="display:flex;align-items:center;gap:5px;">
          ${t?.foto?`<img src="${t.foto}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;">`:
            `<span class="tienda-dot" style="background:${t?.color||'#aaa'}"></span>`}
          <span style="font-size:13px;font-weight:600;">${t?.nombre||'?'}</span>
        </span>
      </td>
      <td style="text-align:center;"><span class="venta-id" onclick="copiarIdVenta('${v.id_ml||v.id}',this)" title="Clic para copiar ID">${v.id_ml||v.id}</span><div style="font-size:12px;color:var(--text3);margin-top:3px;text-align:center;">${v.fecha_venta||'—'}</div></td>
      <td class="td-mono c-dim">${v.telefono||'—'}</td>
      <td class="td-mono">${fmt(c.precioCOP)}</td>
      <td class="td-mono">${fmtU(v.costo_usd||0)}</td>
      <td class="td-mono c-dim">${v.trm?fmt(v.trm):'—'}</td>
      <td style="font-size:11px;text-align:center;vertical-align:middle;">
        <span class="badge badge-${v.envio_tipo==='ml'?'en_camino':v.envio_tipo==='servientrega'?'entregado':v.envio_tipo==='aguachica'?'en_camino':''}"
          ${v.envio_tipo==='otro'?`style="background:#f0f0f0;color:#555;border:1px solid #ccc;"`:''}
        >${envioLabel}</span>
      </td>
      <td style="font-size:11px;text-align:center;vertical-align:middle;">
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
        ${(v.envio_tipo==='aguachica'||v.envio_tipo==='servientrega') && v.envio_int_usd > 0
          ? v.envio_validado
            ? `<div style="font-family:var(--font-mono);font-size:12px;font-weight:700;color:var(--green);">${fmt(v.envio_real_cop||v.envio_estimado_cop)}</div>`
            : `<button class="btn btn-sm" style="font-size:11px;padding:2px 6px;background:var(--yellow-bg);color:var(--yellow);border:1px solid #ffe08a;" onclick="openValidarEnvio('${v.id}')">
                 ${fmt(v.envio_estimado_cop||v.envio_int_usd)}
               </button>`
          : '<span class="c-dim">—</span>'
        }
        ${v.envio_extra>0?`<div class="mono" style="font-size:10px;color:var(--text3);">+${fmt(v.envio_extra)}</div>`:''}
        </div>
      </td>
      <td class="td-mono c-dim">${fmt(c.totalCostos)}</td>
      <td class="td-mono" style="color:${isLoss?'#842029':'#198754'};">
        ${fmt(c.ganancia)}
      </td>
      <td>
        <select style="${selectStyle}"
          onchange="_onEstadoChange(this,'${v.id}')">
          ${['pendiente','en_camino','entregado','cancelado','problema','devuelto','error']
            .map(e=>{const lbl={'pendiente':'PENDIENTE','en_camino':'EN CAMINO','entregado':'ENTREGADA','cancelado':'CANCELADA','problema':'PROBLEMA','devuelto':'DEVUELTO','error':'ERROR'}[e]||e.toUpperCase();return `<option value="${e}" ${v.estado===e?'selected':''}>${lbl}</option>`;}).join('')}
        </select>
      </td>
      <td>
        <div class="actions-cell">
            <button class="btn btn-ghost btn-icon btn-sm" title="Ver detalle" onclick="verDetalleVenta('${v.id}')"><img src="img/ver.png" alt="Ver" style="width:1rem;height:1rem;object-fit:contain;"></button>
          <button class="btn btn-ghost btn-icon btn-sm" title="Editar" onclick="openModalVenta('${v.id}')"><img src="img/editar.png" alt="Ver" style="width:1rem;height:1rem;object-fit:contain;"></button>
          <button class="btn btn-ghost btn-icon btn-sm" title="Registrar problema" onclick="openModalProblema('${v.id}')"><img src="img/advertencia.png" alt="Ver" style="width:1rem;height:1rem;object-fit:contain;"></button>
          <button class="btn btn-ghost btn-icon btn-sm" title="Eliminar" onclick="deleteVenta('${v.id}')"><img src="img/eliminar.png" alt="Ver" style="width:1rem;height:1rem;object-fit:contain;"></button>
        </div>
      </td>
    </tr>`;
  }).join('')||'<tr><td colspan="12" class="text-center c-dim" style="padding:40px;">Sin ventas registradas</td></tr>';
}

const _ESTADO_PILL_MAP = {
  pendiente: { bg:'#ffc000', color:'#000', border:'#e0a800' },
  en_camino: { bg:'#70ad47', color:'#fff', border:'#5a9438' },
  entregado: { bg:'#002060', color:'#fff', border:'#001540' },
  cancelado: { bg:'#ff0000', color:'#000', border:'#cc0000' },
  problema:  { bg:'#f9a825', color:'#000', border:'#e08c00' },
  devuelto:  { bg:'#ff00ff', color:'#fff', border:'#cc00cc' },
  error:     { bg:'#a61c00', color:'#fff', border:'#7a1400' },
};

function _onEstadoChange(selectEl, id) {
  const estado = selectEl.value;
  const pill = _ESTADO_PILL_MAP[estado] || { bg:'#f3f8f8', color:'var(--text2)', border:'var(--border)' };
  selectEl.style.background = pill.bg;
  selectEl.style.color      = pill.color;
  selectEl.style.borderColor= pill.border;
  cambiarEstado(id, estado);
}

async function cambiarEstado(id, estado) {
  const ventas = await DB.ventas();
  const v = ventas.find(x=>x.id===id);
  if(v) { v.estado = estado; await DB.saveVentas(ventas); await updateAlertaBadge(); }
}

// ── ELIMINAR VENTA CON CÓDIGO DE ACCESO ──
let _pendingDeleteId = null;

function deleteVenta(id) {
  _pendingDeleteId = id;
  const modal = document.getElementById('modal-delete-confirm');
  const input = document.getElementById('delete-code-input');
  const errEl = document.getElementById('delete-code-error');
  errEl.textContent = '';
  input.value = '';
  modal.style.display = 'flex';
  setTimeout(() => input.focus(), 80);
}

function _cancelDeleteVenta() {
  _pendingDeleteId = null;
  document.getElementById('modal-delete-confirm').style.display = 'none';
  document.getElementById('delete-code-input').value = '';
  document.getElementById('delete-code-error').textContent = '';
}

async function _confirmDeleteVenta() {
  const input  = document.getElementById('delete-code-input');
  const errEl  = document.getElementById('delete-code-error');
  const btn    = document.getElementById('delete-confirm-btn');
  const codigo = input.value.trim();

  if(!codigo) { errEl.textContent = 'Ingresa el código de acceso.'; return; }

  btn.textContent = 'Verificando...';
  btn.disabled = true;
  errEl.textContent = '';

  try {
    const snap = await _db.collection('config').doc('auth').get();
    if(!snap.exists) { errEl.textContent = '⚠️ No hay código configurado.'; btn.textContent = 'Eliminar'; btn.disabled = false; return; }
    const hashGuardado  = snap.data().hash;
    const hashIngresado = await _hashCode(codigo);

    if(hashIngresado === hashGuardado) {
      await DB.deleteVenta(_pendingDeleteId);
      _cancelDeleteVenta();
      await renderVentas();
      await updateAlertaBadge();
    } else {
      errEl.textContent = 'Código incorrecto. Intenta de nuevo.';
      input.value = '';
      input.focus();
    }
  } catch(e) {
    errEl.textContent = 'Error de conexión. Intenta de nuevo.';
    console.error(e);
  }

  btn.textContent = 'Eliminar';
  btn.disabled = false;
}

let _validarEnvioId = null;
let _validarEnvioEstimado = 0;
let _validarEnvioEsServientrega = false;
let _validarEnvioTRM = 0;

async function openValidarEnvio(id) {
  const v = (await DB.ventas()).find(x=>x.id===id);
  if(!v) return;
  const trm = v.trm || TRM_ACTUAL;
  // El estimado siempre está en COP
  const estimado = v.envio_estimado_cop || v.envio_int_usd || 0;
  const esServientrega = v.envio_tipo === 'servientrega';

  _validarEnvioId            = id;
  _validarEnvioEstimado      = estimado;
  _validarEnvioEsServientrega = esServientrega;
  _validarEnvioTRM           = trm;

  document.getElementById('ve-subtitulo').textContent =
    `${esServientrega ? 'Servientrega' : 'Aguachica'} · ${v.id_ml||v.id}`;
  document.getElementById('ve-estimado').textContent = fmt(estimado);

  // Cambiar el label según transportadora
  const labelEl = document.getElementById('ve-input-label');
  if(labelEl) {
    labelEl.textContent = esServientrega
      ? 'Valor REAL confirmado en Centris (USD$)'
      : 'Valor REAL confirmado en Centris (COP$)';
  }
  // Cambiar placeholder e input
  const inputEl = document.getElementById('ve-input');
  if(inputEl) {
    inputEl.placeholder = esServientrega ? 'Ej: 4.50' : 'Ej: 19000';
    inputEl.step        = esServientrega ? '0.01' : '1';
    inputEl.value       = esServientrega ? (estimado / trm).toFixed(2) : (estimado || '');
  }
  document.getElementById('ve-diff-box').style.display = 'none';

  const modal = document.getElementById('modal-validar-envio');
  modal.style.display = 'flex';
  setTimeout(()=>document.getElementById('ve-input').focus(), 80);
  _calcDiffEnvio();
}

function _calcDiffEnvio() {
  const raw  = parseFloat(document.getElementById('ve-input').value);
  const box  = document.getElementById('ve-diff-box');
  const txt  = document.getElementById('ve-diff-text');
  if(isNaN(raw)) { box.style.display='none'; return; }
  // Convertir a COP si es Servientrega (el input es USD)
  const val = _validarEnvioEsServientrega ? raw * _validarEnvioTRM : raw;
  const diff = val - _validarEnvioEstimado;
  box.style.display = 'block';
  if(Math.abs(diff) < 1) {
    box.style.background = '#e0f2f1';
    txt.style.color = '#00695c';
    txt.textContent = '✔ Igual al estimado';
  } else if(diff > 0) {
    box.style.background = '#fde8ea';
    txt.style.color = '#b0202e';
    txt.textContent = `▲ +${fmt(diff)} más caro que el estimado`;
  } else {
    box.style.background = '#d1f0e0';
    txt.style.color = '#1b7e4a';
    txt.textContent = `▼ ${fmt(diff)} más barato que el estimado`;
  }
}

function _cancelValidarEnvio() {
  document.getElementById('modal-validar-envio').style.display = 'none';
  _validarEnvioId = null;
}

async function _confirmarValidarEnvio() {
  const raw = parseFloat(document.getElementById('ve-input').value);
  if(isNaN(raw) || raw < 0) {
    document.getElementById('ve-input').style.borderColor = '#dc3545';
    setTimeout(()=>document.getElementById('ve-input').style.borderColor='#d8e4e3', 1200);
    return;
  }
  // Si es Servientrega el input está en USD → convertir a COP
  const realCOP = _validarEnvioEsServientrega ? Math.round(raw * _validarEnvioTRM) : raw;
  const ventas = await DB.ventas();
  const vv = ventas.find(x=>x.id===_validarEnvioId);
  if(vv) {
    vv.envio_real_cop      = realCOP;
    vv.envio_real_usd      = _validarEnvioEsServientrega ? raw : null;
    vv.envio_validado      = true;
    vv.envio_estimado_cop  = _validarEnvioEstimado;
    await DB.saveVentas(ventas);
    showConfirmAnim('validado', false);
    await renderVentas();
  }
  _cancelValidarEnvio();
}

function clearVentaFilters() {
  ['vf-search','vf-mes','vf-desde','vf-hasta'].forEach(i => sv(i,''));
  ['vf-tienda','vf-estado'].forEach(i => sv(i,''));
  // Resetear DRP visual
  if (typeof _DRP !== 'undefined') {
    _DRP.selStart = null; _DRP.selEnd = null; _DRP.activeShortcut = 'month';
  }
  if (typeof _drpUpdateLabel === 'function') _drpUpdateLabel();
  renderVentasGanancias();
}

async function verDetalleVenta(id) {
  const v = (await DB.ventas()).find(x=>x.id===id);
  if(!v) return;
  const t = (await DB.tiendas()).find(x=>x.id===v.tienda_id);
  const c = calcVenta(v);
  const problemas = (await DB.problemas()).filter(p=>p.venta_id===id);

  document.getElementById('md-title').textContent = `Detalle — ${v.id_ml||v.id}`;
  document.getElementById('md-btn-editar').onclick = ()=>{ closeModal('modal-detalle'); openModalVenta(id); };
  document.getElementById('md-btn-problema').onclick = ()=>{ closeModal('modal-detalle'); openModalProblema(id); };

  document.getElementById('md-body').innerHTML = `
    <div class="g2" style="margin-bottom:16px;">
      <div>
        <div class="fsec" style="margin-top:0;">Información de la venta</div>
        ${dr('ID Venta ML', `<span class="venta-id">${v.id_ml||v.id}</span>`)}
        ${dr('Tienda', `<span style="display:flex;align-items:center;gap:5px;"><span class="tienda-dot" style="background:${t?.color||'#aaa'}"></span>${t?.nombre||'?'}</span>`)}
        ${dr('Fecha venta', v.fecha_venta||'—')}
        ${dr('Fecha entrega', v.fecha_entrega||'—')}
        ${dr('Cliente', v.cliente||'—')}
        ${dr('Teléfono', v.telefono||'—')}
        ${dr('Producto', `<strong>${v.producto}</strong>`)}
        ${dr('Unidades', v.udes||1)}
        ${dr('Estado', `<span class="badge badge-${v.estado||'pendiente'}">${v.estado||'pendiente'}</span>`)}
        ${dr('Tipo de envío', v.envio_tipo||'ml')}
      </div>
      <div>
        <div class="fsec" style="margin-top:0;">Resultado financiero</div>
        <div class="calc-box">
          <div class="cr"><span class="cr-label">Precio USD</span><span class="cr-val neu">${fmtU(v.precio_usd)}</span></div>
          <div class="cr"><span class="cr-label">TRM aplicado</span><span class="cr-val neu">${fmt(v.trm)}</span></div>
          <div class="cr"><span class="cr-label">Precio COP</span><span class="cr-val neu fw7">${fmt(c.precioCOP)}</span></div>
          <div class="cr"><span class="cr-label">Unidades</span><span class="cr-val neu">× ${c.udes}</span></div>
          <div class="cr total"><span class="cr-label">Total Venta</span><span class="cr-val neu">${fmt(c.totalVenta)}</span></div>
          <div class="cr"><span class="cr-label">Costo producto</span><span class="cr-val neg">−${fmt(c.costoCOP*c.udes)}</span></div>
          <div class="cr"><span class="cr-label">Envío internacional</span><span class="cr-val neg">−${fmt(c.envioIntCOP)}</span></div>
          <div class="cr"><span class="cr-label">Envío extra local</span><span class="cr-val neg">−${fmt(c.envioExtra)}</span></div>
          <div class="cr total">
            <span class="cr-label fw7">GANANCIA NETA</span>
            <span class="cr-val fw7" style="color:${c.ganancia>=0?'var(--green)':'var(--red)'};">${fmt(c.ganancia)}</span>
          </div>
          <div class="cr"><span class="cr-label">Margen</span><span class="cr-val neu">${fmtP(c.margen)}</span></div>
        </div>
      </div>
    </div>
    ${problemas.length ? `
    <div class="fsec">Problemas registrados (${problemas.length})</div>
    ${problemas.map(p=>`
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:10px;margin-bottom:6px;">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
          <span class="badge badge-${p.estado}">${p.estado}</span>
          <span style="font-size:11px;color:var(--text2);">${p.tipo_label||p.tipo}</span>
          <span class="c-dim" style="font-size:10px;">${p.fecha||'—'}</span>
          ${p.valor_perdida>0?`<span class="badge badge-perdida">Pérdida: ${fmt(p.valor_perdida)}</span>`:''}
        </div>
        <div style="font-size:12px;margin-bottom:4px;"><strong>Problema:</strong> ${p.descripcion}</div>
        ${p.solucion?`<div style="font-size:12px;color:var(--text2);"><strong>Solución:</strong> ${p.solucion}</div>`:''}
      </div>`).join('')}` : ''}`;
  openModal('modal-detalle');
}

function dr(label, val) {
  return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px;">
    <span class="c-dim">${label}</span><span>${val}</span></div>`;
}


// ══════════════════════════════════════════════════════════
// DATE RANGE PICKER — botón compacto con calendario doble
// ══════════════════════════════════════════════════════════
// DATE RANGE PICKER — event delegation, sin conflictos de cierre
// ══════════════════════════════════════════════════════════
const _DRP = {
  selStart: null,
  selEnd:   null,
  hover:    null,
  viewY:    null,
  viewM:    null,
  activeShortcut: 'month',
};

const _MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const _DIAS_ES  = ['Lu','Ma','Mi','Ju','Vi','Sa','Do'];

function _drpToday() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}
function _drpFmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function _drpFmtLabel(d) {
  if (!d) return '';
  const [y,m,day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function _drpInit() {
  const now = new Date();
  _DRP.viewY = now.getFullYear();
  _DRP.viewM = now.getMonth();
  _drpApplyShortcut('month', false);

  // ── Event delegation en el panel — UN solo listener, nunca se recrea ──
  const panel = document.getElementById('drp-panel');
  if (!panel) return;

  // Bloquear que clicks dentro del panel cierren el picker
  panel.addEventListener('mousedown', e => e.stopPropagation());
  panel.addEventListener('click',     e => e.stopPropagation());

  // Delegación de clicks
  panel.addEventListener('click', e => {
    const t = e.target.closest('[data-drp]');
    if (!t) return;
    const action = t.dataset.drp;
    const val    = t.dataset.val;

    if (action === 'day') {
      if (!_DRP.selStart || (_DRP.selStart && _DRP.selEnd)) {
        // Primera selección — solo marca inicio, no re-renderizar completo
        _DRP.selStart = val; _DRP.selEnd = null; _DRP.hover = null; _DRP.activeShortcut = null;
        _drpUpdateRangeHighlight();
        _drpUpdateFooterLabel();
      } else {
        // Segunda selección — confirma el rango
        _DRP.hover = null;
        if (val < _DRP.selStart) { _DRP.selEnd = _DRP.selStart; _DRP.selStart = val; }
        else { _DRP.selEnd = val; }
        _DRP.activeShortcut = null;
        _drpUpdateRangeHighlight();
        _drpUpdateFooterLabel();
      }
    } else if (action === 'nav') {
      _DRP.viewM += parseInt(val);
      if (_DRP.viewM > 11) { _DRP.viewM = 0; _DRP.viewY++; }
      if (_DRP.viewM < 0)  { _DRP.viewM = 11; _DRP.viewY--; }
      _DRP.activeShortcut = null;
      _drpRender();
    } else if (action === 'sc') {
      _drpApplyShortcut(val);
    } else if (action === 'apply') {
      _drpApply();
    } else if (action === 'cancel') {
      _drpClose();
    }
  });

  // Hover sobre días — solo CSS, sin re-render
  panel.addEventListener('mouseover', e => {
    const t = e.target.closest('[data-drp="day"]');
    if (!t || !_DRP.selStart || _DRP.selEnd) return;
    _DRP.hover = t.dataset.val;
    _drpUpdateRangeHighlight();
  });
  panel.addEventListener('mouseleave', () => {
    if (_DRP.selStart && !_DRP.selEnd) {
      _DRP.hover = null;
      _drpUpdateRangeHighlight();
    }
  });
}

function _drpToggle() {
  const panel = document.getElementById('drp-panel');
  if (!panel) return;
  if (panel.style.display !== 'none' && panel.style.display !== '') {
    _drpClose(); return;
  }
  panel.style.display = 'block';
  _drpRender();
}

function _drpClose() {
  const panel = document.getElementById('drp-panel');
  if (panel) panel.style.display = 'none';
}

// Cerrar al hacer mousedown fuera del wrapper
document.addEventListener('mousedown', e => {
  const wrap = document.getElementById('drp-wrap');
  if (wrap && !wrap.contains(e.target)) _drpClose();
});

function _drpRender() {
  const panel = document.getElementById('drp-panel');
  if (!panel) return;

  const leftY = _DRP.viewY, leftM = _DRP.viewM;
  let rightM = leftM + 1, rightY = leftY;
  if (rightM > 11) { rightM = 0; rightY++; }

  const shortcuts = [
    { k:'today', l:'Hoy'            },
    { k:'ayer',  l:'Ayer'           },
    { k:'7d',    l:'Últimos 7 días' },
    { k:'30d',   l:'Últimos 30 días'},
    { k:'month', l:'Este mes'       },
    { k:'lastm', l:'Mes pasado'     },
  ];

  const labelHtml = _DRP.selStart
    ? `<strong>${_drpFmtLabel(_DRP.selStart)}</strong>${_DRP.selEnd && _DRP.selEnd !== _DRP.selStart
        ? ` → <strong>${_drpFmtLabel(_DRP.selEnd)}</strong>` : ''}`
    : '<span style="opacity:.5;">Selecciona una fecha o rango</span>';

  panel.innerHTML = `
    <div class="drp-body">
      <div class="drp-shortcuts">
        ${shortcuts.map(s => `<div class="drp-sc ${_DRP.activeShortcut===s.k?'active':''}"
          data-drp="sc" data-val="${s.k}">${s.l}</div>`).join('')}
      </div>
      <div>
        <div class="drp-cals">
          ${_drpCalHtml(leftY, leftM, true)}
          ${_drpCalHtml(rightY, rightM, false)}
        </div>
        <div class="drp-footer">
          <div class="drp-footer-label">${labelHtml}</div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-ghost btn-sm" data-drp="cancel">Cancelar</button>
            <button class="btn btn-primary btn-sm" data-drp="apply">Aplicar</button>
          </div>
        </div>
      </div>
    </div>`;
}

function _drpUpdateRangeHighlight() {
  const panel = document.getElementById('drp-panel');
  if (!panel) return;
  const rangeEnd = _DRP.selEnd || (_DRP.selStart && _DRP.hover && _DRP.hover >= _DRP.selStart ? _DRP.hover : null);
  panel.querySelectorAll('[data-drp="day"]').forEach(el => {
    const ds = el.dataset.val;
    el.classList.remove('drp-day-start','drp-day-end','drp-day-in-range');
    if (ds === _DRP.selStart)  el.classList.add('drp-day-start');
    if (ds === _DRP.selEnd)    el.classList.add('drp-day-end');
    if (_DRP.selStart && rangeEnd && ds > _DRP.selStart && ds < rangeEnd)
      el.classList.add('drp-day-in-range');
  });
}

function _drpUpdateFooterLabel() {
  const el = document.querySelector('#drp-panel .drp-footer-label');
  if (!el) return;
  el.innerHTML = _DRP.selStart
    ? `<strong>${_drpFmtLabel(_DRP.selStart)}</strong>${_DRP.selEnd && _DRP.selEnd !== _DRP.selStart
        ? ` → <strong>${_drpFmtLabel(_DRP.selEnd)}</strong>` : ''}`
    : '<span style="opacity:.5;">Selecciona una fecha o rango</span>';
}

function _drpCalHtml(y, m, isLeft) {
  const firstDay    = new Date(y, m, 1).getDay();
  const offset      = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const daysInPrev  = new Date(y, m, 0).getDate();
  const today       = _drpToday();

  let cells = '';
  for (let i = offset - 1; i >= 0; i--)
    cells += `<div class="drp-day drp-day-other">${daysInPrev - i}</div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const rangeEnd = _DRP.selEnd || (_DRP.selStart && _DRP.hover && _DRP.hover >= _DRP.selStart ? _DRP.hover : null);
    let cls = 'drp-day';
    if (ds === _DRP.selStart) cls += ' drp-day-start';
    if (ds === _DRP.selEnd)   cls += ' drp-day-end';
    if (_DRP.selStart && rangeEnd && ds > _DRP.selStart && ds < rangeEnd) cls += ' drp-day-in-range';
    if (ds === today)          cls += ' drp-day-today';
    cells += `<div class="${cls}" data-drp="day" data-val="${ds}">${d}</div>`;
  }

  const total = offset + daysInMonth;
  const rem   = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= rem; d++)
    cells += `<div class="drp-day drp-day-other">${d}</div>`;

  const navL = isLeft  ? `<button class="drp-nav" data-drp="nav" data-val="-1">‹</button>` : `<div style="width:24px"></div>`;
  const navR = !isLeft ? `<button class="drp-nav" data-drp="nav" data-val="1">›</button>`  : `<div style="width:24px"></div>`;

  return `<div class="drp-cal">
    <div class="drp-cal-header">
      ${navL}<div class="drp-cal-title">${_MESES_ES[m]} ${y}</div>${navR}
    </div>
    <div class="drp-grid">
      ${_DIAS_ES.map(d=>`<div class="drp-dow">${d}</div>`).join('')}
      ${cells}
    </div>
  </div>`;
}

function _drpApplyShortcut(k, render=true) {
  const now = new Date();
  _DRP.activeShortcut = k;
  switch (k) {
    case 'today':
      _DRP.selStart = _drpToday(); _DRP.selEnd = _drpToday(); break;
    case 'ayer': {
      const a = new Date(now); a.setDate(a.getDate()-1);
      _DRP.selStart = _drpFmt(a); _DRP.selEnd = _drpFmt(a); break;
    }
    case '7d': {
      const a = new Date(now); a.setDate(a.getDate()-6);
      _DRP.selStart = _drpFmt(a); _DRP.selEnd = _drpToday(); break;
    }
    case '30d': {
      const a = new Date(now); a.setDate(a.getDate()-29);
      _DRP.selStart = _drpFmt(a); _DRP.selEnd = _drpToday(); break;
    }
    case 'month':
      _DRP.selStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
      _DRP.selEnd   = _drpToday();
      _DRP.viewY = now.getFullYear(); _DRP.viewM = now.getMonth(); break;
    case 'lastm': {
      const lm = new Date(now.getFullYear(), now.getMonth()-1, 1);
      const le = new Date(now.getFullYear(), now.getMonth(), 0);
      _DRP.selStart = _drpFmt(lm); _DRP.selEnd = _drpFmt(le);
      _DRP.viewY = lm.getFullYear(); _DRP.viewM = lm.getMonth(); break;
    }
  }
  if (render) _drpRender();
}

function _drpApply() {
  const desde = _DRP.selStart || '';
  const hasta = _DRP.selEnd   || _DRP.selStart || '';
  const elDesde = document.getElementById('vf-desde');
  const elHasta = document.getElementById('vf-hasta');
  const elMes   = document.getElementById('vf-mes');
  if (elDesde) elDesde.value = desde;
  if (elHasta) elHasta.value = hasta;
  if (elMes)   elMes.value   = '';
  _drpUpdateLabel();
  _drpClose();
  renderVentasGanancias();
}

function _drpClear() {
  _DRP.selStart = null; _DRP.selEnd = null; _DRP.activeShortcut = 'month';
  ['vf-desde','vf-hasta','vf-mes'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  _drpUpdateLabel();
  renderVentasGanancias();
}

function _drpUpdateLabel() {
  const lbl   = document.getElementById('drp-label');
  const clear = document.getElementById('drp-clear');
  const desde = document.getElementById('vf-desde')?.value || '';
  const hasta = document.getElementById('vf-hasta')?.value || '';
  if (desde && hasta && desde !== hasta) {
    if(lbl) lbl.textContent = `${_drpFmtLabel(desde)} → ${_drpFmtLabel(hasta)}`;
    if(clear) clear.style.display = 'inline';
  } else if (desde) {
    if(lbl) lbl.textContent = _drpFmtLabel(desde);
    if(clear) clear.style.display = 'inline';
  } else {
    if(lbl) lbl.textContent = 'Período: mes actual';
    if(clear) clear.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => { _drpInit(); });