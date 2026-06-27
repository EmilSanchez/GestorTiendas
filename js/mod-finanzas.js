/* Módulo Finanzas — v3 */

// ── SVG ICONS ──
const _FIN_ICON = {
  wallet: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12V22H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/><path d="M20 12a2 2 0 0 0-2-2H4"/><circle cx="18" cy="17" r="2"/></svg>`,
  up:     `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`,
  down:   `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`,
  trash:  `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
  edit:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  truck:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  mp:     `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
};

var _finTiendas = [];

function _mesLabel(ym) {
  const M = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const [y,m] = (ym||'').split('-');
  return `${M[parseInt(m,10)-1]||ym} ${y}`;
}

// ── RENDER PRINCIPAL ──
async function renderFinanzas() {
  await _procesarTransferenciasPendientes();
  await _renderPendientesTransfer();
  if (typeof renderCierresMes_Fin === 'function') renderCierresMes_Fin();
  const [movs, saldos, billeteras, tiendas, ventas, enviosSky] = await Promise.all([
    DB.movimientos(), DB.saldos(), DB.billeteras(), DB.tiendas(), DB.ventas(), DB.envios_sky()
  ]);
  _finTiendas = tiendas;

  // Ganancia del mes actual (ventas - envíos sky - egresos externos)
  const mesAct2 = (document.getElementById('fin-filtro-mes')?.value) || mes();
  const ventasMes = ventas.filter(v => (v.fecha_venta||'').startsWith(mesAct2));
  // Use ganancia_congelada if the venta belongs to a CLOSED month (regardless of which month is being viewed)
  let _cierresFinSet = new Set();
  try { const _cl2 = await _getCierres(); _cl2.forEach(x => _cierresFinSet.add(x.mes)); } catch(e) {}
  const ganVentasMes = ventasMes.reduce((s,v) => {
    const mesDeLaVenta = (v.fecha_venta||'').slice(0,7);
    const ganancia = (_cierresFinSet.has(mesDeLaVenta) && v.ganancia_congelada !== undefined)
      ? v.ganancia_congelada
      : calcVenta(v).ganancia;
    return s + ganancia;
  }, 0);
  // Solo descontar envíos sky que NO están ligados a una venta registrada
  // (los que sí tienen num_venta ya están contabilizados como costo en calcVenta)
  const idsMlVentas = new Set(ventas.map(v => v.id_ml).filter(Boolean));
  const egSkyMes = enviosSky
    .filter(e => (e.fecha||'').startsWith(mesAct2) && !idsMlVentas.has(e.num_venta))
    .reduce((s,e) => s + (parseFloat(e.valor)||0), 0);
  const ganMes = ganVentasMes - egSkyMes;
  const ganEl  = document.getElementById('fin-ganancia-mes');
  if (ganEl) {
    ganEl.textContent = fmt(ganMes);
    ganEl.style.color = ganMes >= 0 ? '#065f46' : '#7f1d1d';
  }
  const ganCntEl = document.getElementById('fin-ventas-mes-cnt');
  if (ganCntEl) ganCntEl.textContent = `${ventasMes.length} ventas · ${_mesLabel(mesAct2)}`;

  const mesEl = document.getElementById('fin-filtro-mes');
  if (mesEl && !mesEl.dataset.init) {
    const meses = Array.from({length:8},(_,i)=>{ const d=new Date(); d.setMonth(d.getMonth()-i); return d.toISOString().slice(0,7); });
    mesEl.innerHTML = meses.map(m=>`<option value="${m}" ${m===mes()?'selected':''}>${_mesLabel(m)}</option>`).join('');
    mesEl.dataset.init = '1';
  }
  const mesAct = mesEl?.value || mes();

  _renderBilleteras(saldos, billeteras, tiendas);

  const movMes = movs.filter(m=>m.fecha?.startsWith(mesAct)).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  _renderMovimientos(movMes, mesAct);
}

// ── BILLETERAS ──
function _renderBilleteras(saldos, billeteras, tiendas) {
  const el = document.getElementById('fin-billeteras');
  if (!el) return;

  // Skydropx — siempre fija
  const skySaldo = parseFloat(saldos['skydropx'])||0;
  const skyEsBanco = !!saldos['_es_banco_skydropx'];
  const skyCard = `
    <div class="fin-wallet-card" onclick="openModalEditarSaldo('skydropx','Skydropx',${skySaldo})">
      <div class="fin-wallet-top">
        <span style="width:28px;height:28px;border-radius:50%;background:#6366f1;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;">${_FIN_ICON.truck}</span>
        <div style="flex:1;min-width:0;">
          <div class="fin-wallet-name">Skydropx ${skyEsBanco?'<span style="font-size:8px;background:#e0e7ff;color:#4338ca;padding:1px 5px;border-radius:8px;font-weight:700;vertical-align:middle;">BANCO</span>':''}</div>
          <div class="fin-wallet-sub">Envíos nacionales</div>
        </div>
        <button class="btn btn-ghost btn-icon btn-sm" title="${skyEsBanco?'Quitar marca de banco':'Marcar como banco'}"
          onclick="event.stopPropagation();_toggleEsBancoFijo('skydropx')" style="opacity:.5;flex-shrink:0;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
        </button>
      </div>
      <div class="fin-wallet-amount ${skySaldo<0?'neg':skySaldo===0?'zero':''}">${fmt(skySaldo)}</div>
    </div>`;

  // MP por tienda — fijas
  const mpCards = tiendas.map(t => {
    const key = 'mercadopago_'+t.id;
    const s   = parseFloat(saldos[key])||0;
    const esBanco = !!saldos['_es_banco_'+key];
    const dot = t.foto
      ? `<img src="${t.foto}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid ${t.color||'#00897b'};flex-shrink:0;">`
      : `<span style="width:28px;height:28px;border-radius:50%;background:${t.color||'#00897b'};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;">${_FIN_ICON.mp}</span>`;
    return `
    <div class="fin-wallet-card" onclick="openModalEditarSaldo('${key}','MP · ${t.nombre}',${s})">
      <div class="fin-wallet-top">
        ${dot}
        <div style="flex:1;min-width:0;">
          <div class="fin-wallet-name">MP · ${t.nombre} ${esBanco?'<span style="font-size:8px;background:#e0e7ff;color:#4338ca;padding:1px 5px;border-radius:8px;font-weight:700;vertical-align:middle;">BANCO</span>':''}</div>
          <div class="fin-wallet-sub">Mercado Pago</div>
        </div>
        <button class="btn btn-ghost btn-icon btn-sm" title="${esBanco?'Quitar marca de banco':'Marcar como banco'}"
          onclick="event.stopPropagation();_toggleEsBancoFijo('${key}')" style="opacity:.5;flex-shrink:0;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
        </button>
      </div>
      <div class="fin-wallet-amount ${s<0?'neg':s===0?'zero':''}">${fmt(s)}</div>
    </div>`;
  });

  // Billeteras personalizadas
  const bwCards = billeteras.map(b => {
    const s     = parseFloat(saldos[b.id])||0;
    const color = b.color||'#6b7280';
    return `
    <div class="fin-wallet-card" onclick="openModalEditarSaldo('${b.id}','${b.nombre.replace(/'/g,"\\'")}',${s})">
      <div class="fin-wallet-top">
        <span style="width:28px;height:28px;border-radius:50%;background:${color};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;">${_FIN_ICON.wallet}</span>
        <div style="flex:1;min-width:0;">
          <div class="fin-wallet-name">${b.nombre} ${b.es_banco?'<span style="font-size:8px;background:#e0e7ff;color:#4338ca;padding:1px 5px;border-radius:8px;font-weight:700;vertical-align:middle;">BANCO</span>':''}</div>
          <div class="fin-wallet-sub">${b.tipo||'Billetera'}</div>
        </div>
        <button class="btn btn-ghost btn-icon btn-sm" title="Editar billetera"
          onclick="event.stopPropagation();openModalEditarBilletera('${b.id}')"
          style="opacity:.5;flex-shrink:0;">${_FIN_ICON.edit}</button>
        <button class="btn btn-ghost btn-icon btn-sm" title="Eliminar billetera"
          onclick="event.stopPropagation();_pedirCodigoEliminarBilletera('${b.id}','${b.nombre.replace(/'/g,"\\'")}')"
          style="opacity:.4;flex-shrink:0;">${_FIN_ICON.trash}</button>
      </div>
      <div class="fin-wallet-amount ${s<0?'neg':s===0?'zero':''}">${fmt(s)}</div>
    </div>`;
  });

  el.innerHTML = [skyCard, ...mpCards, ...bwCards].join('');
}

async function _toggleEsBancoFijo(key) {
  const saldos = await DB.saldos();
  const current = !!saldos['_es_banco_'+key];
  saldos['_es_banco_'+key] = !current;
  await DB.saveSaldos(saldos);
  await renderFinanzas();
  showToast(!current ? 'Marcado como banco' : 'Ya no se considera banco', 'success', 1800);
}

// ── MODAL EDITAR SALDO (reemplaza el prompt) ──
var _editSaldoKey = '';
function openModalEditarSaldo(key, nombre, actual) {
  _editSaldoKey = key;
  document.getElementById('editar-saldo-nombre').textContent = nombre;
  document.getElementById('editar-saldo-actual').textContent = fmt(actual);
  document.getElementById('editar-saldo-input').value = actual || '';
  document.getElementById('editar-saldo-error').textContent = '';
  openModal('modal-editar-saldo');
  setTimeout(()=>{ const inp=document.getElementById('editar-saldo-input'); if(inp){inp.focus();inp.select();} },150);
}
async function saveEditarSaldo() {
  const val = parseFloat(document.getElementById('editar-saldo-input').value);
  if (isNaN(val)) { document.getElementById('editar-saldo-error').textContent='Ingresa un valor válido.'; return; }
  const saldos = await DB.saldos();
  saldos[_editSaldoKey] = val;
  await DB.saveSaldos(saldos);
  closeModal('modal-editar-saldo');
  await renderFinanzas();
  showToast('Saldo actualizado','success');
}
// Alias for backwards compat
function editarMPSaldo(tiendaId) { 
  DB.saldos().then(s=>{ const key='mercadopago_'+tiendaId; openModalEditarSaldo(key,'MP · '+tiendaId, parseFloat(s[key])||0); }); 
}
function editarSaldoSkydropx() { 
  DB.saldos().then(s=>openModalEditarSaldo('skydropx','Skydropx',parseFloat(s['skydropx'])||0)); 
}
async function openModalSaldo(fuente) {
  const s = await DB.saldos();
  openModalEditarSaldo(fuente, FUENTES_LABEL[fuente]||fuente, parseFloat(s[fuente])||0);
}

// ── ELIMINAR BILLETERA CON CÓDIGO ──
var _deleteBwId = '', _deleteBwNombre = '';
function _pedirCodigoEliminarBilletera(id, nombre) {
  _deleteBwId = id; _deleteBwNombre = nombre;
  const inp = document.getElementById('del-bw-code-input');
  const err = document.getElementById('del-bw-code-error');
  if(inp) inp.value=''; if(err) err.textContent='';
  document.getElementById('del-bw-nombre').textContent = `"${nombre}"`;
  openModal('modal-del-billetera');
  setTimeout(()=>inp&&inp.focus(),150);
}
async function _confirmDeleteBilletera() {
  const inp  = document.getElementById('del-bw-code-input');
  const err  = document.getElementById('del-bw-code-error');
  const btn  = document.getElementById('del-bw-confirm-btn');
  const code = inp?.value.trim()||'';
  if (!code) { if(err) err.textContent='Ingresa el código.'; return; }
  if(btn){ btn.textContent='Verificando...'; btn.disabled=true; }
  try {
    const ok = await _verificarCodigoAcceso(code);
    if (!ok) { if(err) err.textContent='Código incorrecto.'; if(inp){inp.value='';inp.focus();} return; }
    closeModal('modal-del-billetera');
    // Use DB.deleteBilletera which calls _delDoc
    await DB.deleteBilletera(_deleteBwId);
    const saldos = await DB.saldos(); delete saldos[_deleteBwId]; await DB.saveSaldos(saldos);
    delete FUENTES_LABEL[_deleteBwId];
    await renderFinanzas(); await actualizarSelectsFuente();
    showToast(`Billetera "${_deleteBwNombre}" eliminada`,'success');
  } catch(e){ if(err) err.textContent='Error al verificar.'; console.error(e); }
  finally { if(btn){ btn.textContent='Eliminar'; btn.disabled=false; } }
}

// ── MOVIMIENTOS ──
function _renderMovimientos(movMes, mesAct) {
  const el = document.getElementById('fin-movimientos');
  if (!el) return;

  // Filter tabs: todos / venta (ML auto) / skydropx / externo (manual)
  const activeTab = document.querySelector('.fin-mov-tab.active')?.dataset.tab || 'todos';
  let filtrados = movMes;
  // fuente='mercadopago' → pago de venta ML (auto)
  // _sky_id presente       → egreso de envío Skydropx (auto)
  // todo lo demás          → movimiento externo manual
  const _isVentaML  = m => (m.fuente === 'mercadopago' || m.fuente?.startsWith('mercadopago_')) && !m._sky_id && m.tipo !== 'transferencia';
  const _isSkyMov   = m => !!m._sky_id;
  const _isTransfer = m => m.tipo === 'transferencia';
  const _isExterno  = m => !_isVentaML(m) && !_isSkyMov(m) && !_isTransfer(m);
  if (activeTab === 'venta')        filtrados = movMes.filter(_isVentaML);
  if (activeTab === 'skydropx')     filtrados = movMes.filter(_isSkyMov);
  if (activeTab === 'externo')      filtrados = movMes.filter(_isExterno);
  if (activeTab === 'transferencia') filtrados = movMes.filter(_isTransfer);

  const tabs = `
    <div style="display:flex;gap:4px;margin-bottom:12px;">
      ${['todos','venta','skydropx','externo','transferencia'].map(t=>{
        const labels={todos:'Todos',venta:'Ventas ML',skydropx:'Skydropx',externo:'Externos',transferencia:'Transferencias'};
        const isActive = activeTab===t;
        return `<button class="fin-mov-tab ${isActive?'active':''}" data-tab="${t}"
          onclick="document.querySelectorAll('.fin-mov-tab').forEach(b=>{b.classList.remove('active');b.style.background='';b.style.color='var(--text2)';b.style.borderColor='var(--border)';});this.classList.add('active');this.style.background='var(--teal)';this.style.color='#fff';this.style.borderColor='var(--teal)';renderFinanzas();"
          style="padding:5px 13px;border:1.5px solid ${isActive?'var(--teal)':'var(--border)'};border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;font-family:Arial,sans-serif;background:${isActive?'var(--teal)':'var(--white)'};color:${isActive?'#fff':'var(--text2)'};transition:all .15s;">
          ${labels[t]}
        </button>`;
      }).join('')}
    </div>`;
  el.innerHTML = tabs;  // will be rebuilt below

  movMes = filtrados;

  const totalIng = movMes.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.valor,0);
  const totalEgr = movMes.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+m.valor,0);
  const net = totalIng - totalEgr;

  const resumen = `
    <div style="display:flex;gap:0;margin-bottom:14px;border:1px solid var(--border);border-radius:8px;overflow:hidden;">
      <div style="flex:1;padding:10px 16px;border-right:1px solid var(--border);">
        <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:4px;">Ingresos</div>
        <div style="font-size:15px;font-weight:700;color:#065f46;">${fmt(totalIng)}</div>
      </div>
      <div style="flex:1;padding:10px 16px;border-right:1px solid var(--border);">
        <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:4px;">Egresos</div>
        <div style="font-size:15px;font-weight:700;color:#7f1d1d;">${fmt(totalEgr)}</div>
      </div>
      <div style="flex:1;padding:10px 16px;">
        <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:4px;">Neto</div>
        <div style="font-size:15px;font-weight:700;color:${net>=0?'#065f46':'#7f1d1d'};">${net>=0?'+':''}${fmt(net)}</div>
      </div>
    </div>`;

  if (!movMes.length) {
    el.innerHTML += resumen + `<div style="text-align:center;padding:24px;color:var(--text3);font-size:12px;">Sin movimientos en ${_mesLabel(mesAct)}</div>`;
    return;
  }

  const rows = movMes.map(m => {
    const isIng = m.tipo==='ingreso' || (m.tipo==='transferencia' && false);
    const isSkyAuto = !!m._sky_id;
    const isTransfer = m.tipo === 'transferencia';
    const isPendiente = isTransfer && m.pendiente;

    // Fuente label
    let fl = '—';
    if (m.fuente?.startsWith('mercadopago_')) {
      const t = _finTiendas.find(x=>x.id===m.fuente.replace('mercadopago_',''));
      fl = 'MP · '+(t?t.nombre:m.fuente);
    } else if (m.fuente==='skydropx') {
      fl = 'Skydropx';
    } else {
      fl = FUENTES_LABEL[m.fuente]||m.fuente||'—';
    }

    const iconBg = isTransfer ? '#e0e7ff' : (isIng?'#d1fae5':'#fee2e2');
    const iconEl = isTransfer
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4338ca" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>'
      : (isIng?_FIN_ICON.up:_FIN_ICON.down);
    return `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
      <span style="width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${iconBg};flex-shrink:0;">
        ${iconEl}
      </span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.concepto}${isSkyAuto?' <span style="font-size:9px;background:#dbeafe;color:#1d4ed8;padding:1px 5px;border-radius:3px;font-weight:700;vertical-align:middle;">AUTO</span>':''}${isPendiente?' <span style="font-size:9px;background:var(--yellow-bg);color:var(--yellow);padding:1px 6px;border-radius:3px;font-weight:700;vertical-align:middle;border:1px solid #f0c040;">PENDIENTE INGRESO</span>':''}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:1px;">${m.fecha} <span style="opacity:.35;">·</span> <span style="color:var(--teal);font-weight:600;">${fl}</span>${isTransfer && m.notas ? ` <span style="opacity:.35;">·</span> ${m.notas}` : ''}${isPendiente?` <span style="opacity:.35;">·</span> <span style="color:var(--yellow);">Disponible ${fmtFecha(m.fecha_disponible)}</span>`:''}</div>
      </div>
      <span style="font-size:13px;font-weight:800;color:${isTransfer?'#4338ca':(isIng?'#16a34a':'#dc2626')};white-space:nowrap;">${isTransfer?'⇄':(isIng?'+':'−')}${fmt(m.valor)}</span>
      ${isPendiente?`<button class="btn btn-ghost btn-sm" style="color:var(--red);font-size:11px;padding:4px 10px;" onclick="_pedirCodigoCancelarTransfer('${m.id}')">Cancelar</button>`:''}
      ${!isSkyAuto && !isTransfer?`<button class="btn btn-ghost btn-icon btn-sm" onclick="openModalMovimiento('${m.id}')">${_FIN_ICON.edit}</button>`:''}
      <button class="btn btn-danger btn-icon btn-sm" onclick="_pedirCodigoEliminarMovimiento('${m.id}')">${_FIN_ICON.trash}</button>
    </div>`;
  }).join('');

  el.innerHTML += resumen + `<div style="max-height:340px;overflow-y:auto;padding-right:2px;">${rows}</div>`;
}

// ── ELIMINAR MOVIMIENTO CON CÓDIGO ──
var _deleteMovId = '';
function _pedirCodigoEliminarMovimiento(id) {
  _deleteMovId = id;
  const inp = document.getElementById('del-mov-code-input');
  const err = document.getElementById('del-mov-code-error');
  if(inp) inp.value=''; if(err) err.textContent='';
  openModal('modal-del-movimiento');
  setTimeout(()=>inp&&inp.focus(),150);
}
async function _confirmDeleteMovimiento() {
  const inp  = document.getElementById('del-mov-code-input');
  const err  = document.getElementById('del-mov-code-error');
  const btn  = document.getElementById('del-mov-confirm-btn');
  const code = inp?.value.trim()||'';
  if (!code) { if(err) err.textContent='Ingresa el código.'; return; }
  if(btn){ btn.textContent='Verificando...'; btn.disabled=true; }
  try {
    const ok = await _verificarCodigoAcceso(code);
    if (!ok) { if(err) err.textContent='Código incorrecto.'; if(inp){inp.value='';inp.focus();} return; }
    closeModal('modal-del-movimiento');

    // Revertir el efecto en saldos antes de eliminar (solo ingreso/egreso manuales)
    const movs = await DB.movimientos();
    const m = movs.find(x => x.id === _deleteMovId);
    if (m && (m.tipo === 'ingreso' || m.tipo === 'egreso')) {
      const saldos = await DB.saldos();
      const signo = m.tipo === 'ingreso' ? -1 : 1; // revertir
      saldos[m.fuente] = (parseFloat(saldos[m.fuente]) || 0) + signo * (parseFloat(m.valor) || 0);
      await DB.saveSaldos(saldos);
    } else if (m && m.tipo === 'transferencia') {
      // Revertir transferencia: devolver a origen, quitar de destino si ya se había acreditado
      const saldos = await DB.saldos();
      saldos[m.fuente] = (parseFloat(saldos[m.fuente]) || 0) + (parseFloat(m.valor) || 0);
      if (!m.pendiente) {
        saldos[m.fuente_destino] = (parseFloat(saldos[m.fuente_destino]) || 0) - (parseFloat(m.valor) || 0);
      }
      await DB.saveSaldos(saldos);
    }

    await DB.deleteMovimiento(_deleteMovId);
    await renderFinanzas();
    showToast('Movimiento eliminado','success');
  } catch(e){ if(err) err.textContent='Error al verificar.'; console.error(e); }
  finally { if(btn){ btn.textContent='Eliminar'; btn.disabled=false; } }
}
async function deleteMovimiento(id) { _pedirCodigoEliminarMovimiento(id); }

// ── ENVÍOS SKYDROPX ──
function _renderEnviosSky(skyMes, mesAct) {
  const el = document.getElementById('fin-envios-sky');
  if (!el) return;
  const total = skyMes.reduce((s,e)=>s+(parseFloat(e.valor)||0),0);
  if (!skyMes.length) {
    el.innerHTML=`<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">Sin envíos en ${_mesLabel(mesAct)}</div>`;
    return;
  }

  const rows = skyMes.map(e=>{
    const fuenteLabel = e.fuente_pago==='skydropx'?'Skydropx':(FUENTES_LABEL[e.fuente_pago]||e.fuente_pago||'Skydropx');
    const estado = e.estado||'Pendiente';
    return `
    <tr style="border-bottom:1px solid var(--border);">
      <td style="padding:8px 10px;font-size:12px;color:var(--text3);font-family:Arial,sans-serif;">${fmtFecha(e.fecha)}</td>
      <td style="padding:8px 10px;">
        ${e.num_venta ? `<span class="venta-id" onclick="copiarIdVenta('${e.num_venta}',this)" title="Clic para copiar">${e.num_venta}</span>` : '<span style="color:var(--text3);">—</span>'}
      </td>
      <td style="padding:8px 10px;">
        ${e.num_guia ? `<span class="venta-id" onclick="copiarIdVenta('${e.num_guia}',this)" title="Clic para copiar">${e.num_guia}</span>` : '<span style="color:var(--text3);">—</span>'}
      </td>
      <td style="padding:8px 10px;font-size:13px;font-family:Arial,sans-serif;font-weight:600;">${e.transportadora||'—'}</td>
      <td style="padding:8px 10px;">${_buildEstadoDrop(estado,['Pendiente','En camino','Entregado','Novedad'],'_cambiarEstadoSky',e.id)}</td>
      <td style="padding:8px 10px;font-size:13px;color:var(--text);font-family:Arial,sans-serif;">${fmt(e.valor)}</td>
      <td style="padding:8px 10px;font-size:12px;color:var(--text3);font-family:Arial,sans-serif;">${fuenteLabel}</td>
      <td style="padding:8px 6px;text-align:center;white-space:nowrap;">
        <button class="btn btn-ghost btn-icon btn-sm" onclick="openModalEnvioSky('${e.id}')" title="Editar">${_FIN_ICON.edit}</button>
        <button class="btn btn-danger btn-icon btn-sm" onclick="deleteEnvioSky('${e.id}')" title="Eliminar">${_FIN_ICON.trash}</button>
      </td>
    </tr>`;
  }).join('');
  el.innerHTML=`<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
    <thead><tr style="border-bottom:2px solid var(--border);">${['Fecha','N° Venta','Guía','Transportadora','Estado','Valor','Pagado desde',''].map(h=>`<th style="padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);font-weight:700;font-family:Arial,sans-serif;">${h}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody></table></div>
    <div style="padding:8px 0 0;font-size:11px;color:var(--text3);text-align:right;">Total: <strong style="color:#dc2626;">${fmt(total)}</strong> en ${_mesLabel(mesAct)}</div>`;
}

// ── MODAL ENVÍO SKYDROPX ──
var _editEnvioSkyId = null;
async function openModalEnvioSky(id) {
  _editEnvioSkyId = id||null;
  const [billeteras,tiendas]=await Promise.all([DB.billeteras(),DB.tiendas()]);
  const opts=[
    `<option value="skydropx">Skydropx (saldo propio)</option>`,
    ...tiendas.map(t=>`<option value="mercadopago_${t.id}">MP · ${t.nombre}</option>`),
    ...billeteras.map(b=>`<option value="${b.id}">${b.nombre}</option>`),
  ].join('');
  document.getElementById('sky-fuente').innerHTML=opts;
  if(id){
    const e=(await DB.envios_sky()).find(x=>x.id===id);
    if(e){sv('sky-fecha',e.fecha||hoy());sv('sky-num-venta',e.num_venta||'');sv('sky-num-guia',e.num_guia||'');sv('sky-transportadora',e.transportadora||'Servientrega');sv('sky-valor',e.valor||'');sv('sky-fuente',e.fuente_pago||'skydropx');sv('sky-estado',e.estado||'Pendiente');}
  } else {
    sv('sky-fecha',hoy());sv('sky-num-venta','');sv('sky-num-guia','');sv('sky-transportadora','Servientrega');sv('sky-valor','');sv('sky-fuente','skydropx');sv('sky-estado','Pendiente');
  }
  document.getElementById('modal-envio-sky-title').textContent=id?'Editar Envío':'Registrar Envío Skydropx';
  openModal('modal-envio-sky');
}
async function saveEnvioSky() {
  const valor=_parseNum(gv('sky-valor'))||0;
  // valor 0 es permitido
  const fecha=gv('sky-fecha')||hoy(),num_venta=gv('sky-num-venta').trim(),num_guia=gv('sky-num-guia').trim(),transport=gv('sky-transportadora')||'Servientrega',fuente_pago=gv('sky-fuente')||'skydropx',estado=gv('sky-estado')||'Pendiente';
  const id=_editEnvioSkyId||uid();
  const _tsNow = new Date().toISOString();
  const _esNuevo = !_editEnvioSkyId;
  await DB.upsertEnvioSky({id,fecha,num_venta,num_guia,transportadora:transport,estado,valor,fuente_pago,fecha_registro:_tsNow,...(_esNuevo?{creado:_tsNow}:{})});
  const saldos=await DB.saldos();
  saldos[fuente_pago]=(parseFloat(saldos[fuente_pago])||0)-valor;
  await DB.saveSaldos(saldos);
  await DB.upsertMovimiento({id:'sky_'+id,fecha,tipo:'egreso',fuente:fuente_pago,valor,
    concepto:`Envío Skydropx${num_venta?' · '+num_venta:''}${num_guia?' · '+num_guia:''}`,
    notas:`Transportadora: ${transport||'—'}`,fecha_registro:new Date().toISOString(),_sky_id:id});
  closeModal('modal-envio-sky');
  await renderFinanzas();
  // Refrescar panel de envíos externos si está visible
  if (typeof _renderEnviosSkyPanel === 'function') {
    const panel = document.getElementById('panel-env-externos');
    if (panel && panel.style.display !== 'none') await _renderEnviosSkyPanel();
  }
  showToast(`Envío registrado · ${fmt(valor)} descontado`,'success');
}
var _deleteEnvioSkyId = null;
function deleteEnvioSky(id) {
  _deleteEnvioSkyId = id;
  const inp = document.getElementById('del-envio-sky-code');
  const err = document.getElementById('del-envio-sky-error');
  if(inp) inp.value=''; if(err) err.textContent='';
  openModal('modal-del-envio-sky');
  setTimeout(()=>inp&&inp.focus(),150);
}
async function _confirmDeleteEnvioSky() {
  const inp  = document.getElementById('del-envio-sky-code');
  const err  = document.getElementById('del-envio-sky-error');
  const btn  = document.getElementById('del-envio-sky-btn');
  const code = inp?.value.trim()||'';
  if(!code){if(err)err.textContent='Ingresa el código.';return;}
  if(btn){btn.textContent='Verificando...';btn.disabled=true;}
  try {
    const ok = await _verificarCodigoAcceso(code);
    if(!ok){if(err)err.textContent='Código incorrecto.';if(inp){inp.value='';inp.focus();}return;}
    closeModal('modal-del-envio-sky');
    const movs=await DB.movimientos();
    const linked=movs.find(m=>m._sky_id===_deleteEnvioSkyId);
    if(linked)await DB.deleteMovimiento(linked.id);
    await DB.deleteEnvioSky(_deleteEnvioSkyId);
    _deleteEnvioSkyId=null;
    await renderFinanzas();
    if (typeof _renderEnviosSkyPanel === 'function') {
      const panel = document.getElementById('panel-env-externos');
      if (panel && panel.style.display !== 'none') await _renderEnviosSkyPanel();
    }
    showToast('Envío eliminado','success');
  } catch(e){if(err)err.textContent='Error al verificar.';console.error(e);}
  finally{if(btn){btn.textContent='Eliminar';btn.disabled=false;}}
}

function _cambiarEstadoSky(id, estado) {
  DB.envios_sky().then(async arr=>{
    const e=arr.find(x=>x.id===id);
    if(e){ e.estado=estado; await DB.upsertEnvioSky(e); }
    if (typeof _renderEnviosSkyPanel === 'function') {
      const panel = document.getElementById('panel-env-externos');
      if (panel && panel.style.display !== 'none') await _renderEnviosSkyPanel();
    }
  });
}

function _copiarTextoSky(el, texto) {
  if(!texto || texto==='—') return;
  navigator.clipboard.writeText(texto).then(()=>{
    const orig = el.textContent.trim();
    el.textContent = 'Copiado';
    el.style.color = 'var(--teal)';
    setTimeout(()=>{ el.textContent=orig; el.style.color=''; },1200);
  }).catch(()=>{ showToast('No se pudo copiar','error'); });
}


// ── BILLETERAS PERSONALIZADAS ──
function _bwPickColor(el) {
  document.querySelectorAll('#bw-color-picker span').forEach(s=>{s.style.outline='none';s.style.borderColor='transparent';});
  el.style.outline='3px solid '+el.dataset.color;
  el.style.outlineOffset='2px';
  document.getElementById('bw-color').value=el.dataset.color;
}
var _editBilleteraId = null;

function openModalNuevaBilletera() {
  _editBilleteraId = null;
  sv('bw-nombre','');sv('bw-saldo','');sv('bw-color','#0ea5e9');
  const sel=document.getElementById('bw-tipo-select'); if(sel) sel.value='Neobank';
  sv('bw-tipo','Neobank');
  const custom=document.getElementById('bw-tipo-custom'); if(custom) custom.style.display='none';
  document.getElementById('bw-es-banco').checked = false;
  document.querySelectorAll('#bw-color-picker span').forEach((s,i)=>{s.style.outline='none';if(i===0){s.style.outline='3px solid #0ea5e9';s.style.outlineOffset='2px';}});
  document.getElementById('modal-billetera-title').textContent='Nueva Billetera';
  document.getElementById('bw-save-btn').textContent='Crear billetera';
  openModal('modal-billetera');
}

async function openModalEditarBilletera(id) {
  const bws = await DB.billeteras();
  const b = bws.find(x => x.id === id);
  if (!b) return;
  _editBilleteraId = id;
  const saldos = await DB.saldos();
  sv('bw-nombre', b.nombre);
  sv('bw-saldo', saldos[id] || 0);
  sv('bw-color', b.color || '#0ea5e9');
  document.getElementById('bw-es-banco').checked = !!b.es_banco;
  const tiposFijos = ['Neobank','Cuenta de ahorros','Cuenta corriente','Billetera digital'];
  const sel = document.getElementById('bw-tipo-select');
  const custom = document.getElementById('bw-tipo-custom');
  if (tiposFijos.includes(b.tipo)) {
    sel.value = b.tipo; sv('bw-tipo', b.tipo); custom.style.display = 'none';
  } else {
    sel.value = 'otro'; sv('bw-tipo', b.tipo); custom.value = b.tipo; custom.style.display = 'block';
  }
  document.querySelectorAll('#bw-color-picker span').forEach(s => {
    const match = s.dataset.color === (b.color || '#0ea5e9');
    s.style.outline = match ? `3px solid ${s.dataset.color}` : 'none';
    s.style.outlineOffset = match ? '2px' : '0';
  });
  document.getElementById('modal-billetera-title').textContent = 'Editar Billetera';
  document.getElementById('bw-save-btn').textContent = 'Guardar cambios';
  openModal('modal-billetera');
}

async function saveNuevaBilletera() {
  const nombre=gv('bw-nombre').trim();
  if(!nombre){showToast('El nombre es requerido.','error');return;}
  const tipoSel=document.getElementById('bw-tipo-select')?.value;
  const tipo=tipoSel==='otro'?(gv('bw-tipo-custom')||'Billetera'):(gv('bw-tipo')||'Neobank');
  const color=gv('bw-color')||'#6b7280';
  const saldo=_parseNum(gv('bw-saldo'))||0;
  const esBanco = document.getElementById('bw-es-banco').checked;
  const bws=await DB.billeteras();
  const saldos=await DB.saldos();

  if (_editBilleteraId) {
    const b = bws.find(x => x.id === _editBilleteraId);
    if (b) { b.nombre = nombre; b.tipo = tipo; b.color = color; b.es_banco = esBanco; }
    saldos[_editBilleteraId] = saldo;
    await DB.saveBilleteras(bws);
    await DB.saveSaldos(saldos);
    FUENTES_LABEL[_editBilleteraId] = nombre;
    closeModal('modal-billetera');
    await renderFinanzas(); await actualizarSelectsFuente();
    showToast(`Billetera "${nombre}" actualizada`,'success');
  } else {
    const id='bw_'+uid();
    bws.push({id,nombre,tipo,color,es_banco:esBanco,fecha:hoy()});
    await DB.saveBilleteras(bws);
    saldos[id]=saldo; await DB.saveSaldos(saldos);
    FUENTES_LABEL[id]=nombre;
    closeModal('modal-billetera');
    await renderFinanzas(); await actualizarSelectsFuente();
    showToast(`Billetera "${nombre}" creada`,'success');
  }
}
async function actualizarSelectsFuente() {
  const [bws,tiendas]=await Promise.all([DB.billeteras(),DB.tiendas()]);
  const opts=`<option value="">— Seleccionar —</option>`
    +tiendas.map(t=>`<option value="mercadopago_${t.id}">MP · ${t.nombre}</option>`).join('')
    +`<option value="skydropx">Skydropx</option>`
    +bws.map(b=>`<option value="${b.id}">${b.nombre}</option>`).join('');
  ['v-fuente-pago','mov-fuente'].forEach(id=>{const el=document.getElementById(id);if(el){const cur=el.value;el.innerHTML=opts;el.value=cur||'';}});
}

// ── MOVIMIENTOS MANUALES ──
async function openModalMovimiento(id) {
  const [movList,bws,tiendas]=await Promise.all([DB.movimientos(),DB.billeteras(),DB.tiendas()]);
  const mov=id?movList.find(x=>x.id===id):null;
  const opts=tiendas.map(t=>`<option value="mercadopago_${t.id}">MP · ${t.nombre}</option>`).join('')
    +`<option value="skydropx">Skydropx</option>`
    +bws.map(b=>`<option value="${b.id}">${b.nombre}</option>`).join('');
  document.getElementById('mov-fuente').innerHTML=opts;
  document.getElementById('mov-title').textContent=mov?'Editar Movimiento':'Nuevo Movimiento';
  sv('mov-fecha',mov?.fecha||hoy());sv('mov-tipo',mov?.tipo||'egreso');
  sv('mov-fuente',mov?.fuente||'');sv('mov-valor',mov?.valor||'');
  sv('mov-concepto',mov?.concepto||'');sv('mov-notas',mov?.notas||'');
  document.getElementById('modal-movimiento')._editId=id||null;
  openModal('modal-movimiento');
  setTimeout(_actualizarPreviewMovimiento, 50);
}

async function _actualizarPreviewMovimiento() {
  const previewEl = document.getElementById('mov-preview');
  const fuenteSel = document.getElementById('mov-fuente');
  const fuenteKey = fuenteSel?.value || '';
  const tipo = document.getElementById('mov-tipo')?.value || 'egreso';
  const valor = _parseNum(document.getElementById('mov-valor')?.value) || 0;

  if (!fuenteKey || !valor) { if (previewEl) previewEl.style.display = 'none'; return; }

  const saldos = await DB.saldos();
  const saldoAntes = parseFloat(saldos[fuenteKey]) || 0;
  const esIngreso = tipo === 'ingreso';
  const saldoDespues = esIngreso ? saldoAntes + valor : saldoAntes - valor;

  const nombreFuente = fuenteSel.selectedOptions[0]?.textContent.trim() || fuenteKey;
  document.getElementById('mov-preview-fuente-label').textContent = nombreFuente;
  document.getElementById('mov-preview-antes').textContent = fmt(saldoAntes);
  const despuesEl = document.getElementById('mov-preview-despues');
  despuesEl.textContent = fmt(saldoDespues);
  despuesEl.style.color = saldoDespues < 0 ? 'var(--red)' : '';

  if (previewEl) previewEl.style.display = '';
}
async function saveMovimiento() {
  const errEl = document.getElementById('mov-err');
  if (errEl) errEl.textContent = '';

  const valor=_parseNum(gv('mov-valor'))||0,concepto=gv('mov-concepto').trim();
  const tipo = gv('mov-tipo'), fuente = gv('mov-fuente');
  if(!valor){ if(errEl) errEl.textContent='Ingresa el valor.'; showToast('Ingresa el valor.','error');return;}
  if(!concepto){ if(errEl) errEl.textContent='Ingresa un concepto.'; showToast('Ingresa un concepto.','error');return;}
  if(!fuente){ if(errEl) errEl.textContent='Selecciona una fuente.'; showToast('Selecciona una fuente.','error');return;}

  const id=document.getElementById('modal-movimiento')._editId||uid();
  const movs = await DB.movimientos();
  const movAnterior = movs.find(m => m.id === id);
  const saldos = await DB.saldos();

  // Calcular el saldo disponible en la fuente, revirtiendo primero el efecto anterior si se está editando
  let saldoDisponible = parseFloat(saldos[fuente]) || 0;
  if (movAnterior && movAnterior.fuente === fuente) {
    const signoAnt = movAnterior.tipo === 'ingreso' ? -1 : 1;
    saldoDisponible += signoAnt * (parseFloat(movAnterior.valor) || 0);
  }

  // Validar saldo suficiente si es egreso
  if (tipo === 'egreso' && valor > saldoDisponible) {
    const fuenteSel = document.getElementById('mov-fuente');
    const nombreFuente = fuenteSel?.selectedOptions[0]?.textContent.trim() || fuente;
    const msg = `Saldo insuficiente en ${nombreFuente} (disponible: ${fmt(saldoDisponible)}).`;
    if (errEl) errEl.textContent = msg;
    showToast(msg, 'error', 3000);
    return;
  }

  // Si estamos editando y la fuente cambió, revertir en la fuente anterior también
  if (movAnterior && movAnterior.fuente !== fuente) {
    const signoAnt = movAnterior.tipo === 'ingreso' ? -1 : 1;
    saldos[movAnterior.fuente] = (parseFloat(saldos[movAnterior.fuente]) || 0) + signoAnt * (parseFloat(movAnterior.valor) || 0);
  }

  // Aplicar el efecto del movimiento nuevo/editado en la fuente actual
  const signo = tipo === 'ingreso' ? 1 : -1;
  if (movAnterior && movAnterior.fuente === fuente) {
    // Misma fuente: usamos el saldo ya revertido (saldoDisponible) como base
    saldos[fuente] = saldoDisponible + signo * valor;
  } else {
    saldos[fuente] = (parseFloat(saldos[fuente]) || 0) + signo * valor;
  }
  await DB.saveSaldos(saldos);

  await DB.upsertMovimiento({id,fecha:gv('mov-fecha'),tipo,fuente,valor,concepto,notas:gv('mov-notas'),fecha_registro:new Date().toISOString()});
  closeModal('modal-movimiento');
  await renderFinanzas();
  showToast(movAnterior ? 'Movimiento actualizado' : 'Movimiento registrado', 'success', 2000);
}

// ── MEMBRESÍA (compatibilidad) ──
function openModalMembresia(){sv('mem-mes',mes());sv('mem-valor','');sv('mem-fuente','');sv('mem-fecha',hoy());sv('mem-obs','');openModal('modal-membresia');}
async function saveMembresia(){
  const valor=parseFloat(gv('mem-valor'))||0;
  if(!valor){showToast('Ingresa el valor.','error');return;}
  await DB.upsertMembresia({id:uid(),mes:gv('mem-mes'),valor,fuente:gv('mem-fuente'),fecha:gv('mem-fecha'),obs:gv('mem-obs'),fecha_registro:new Date().toISOString()});
  await DB.upsertMovimiento({id:uid(),fecha:gv('mem-fecha'),tipo:'egreso',fuente:gv('mem-fuente'),valor,concepto:`Membresía Centris ${gv('mem-mes')}`,notas:gv('mem-obs'),fecha_registro:new Date().toISOString()});
  closeModal('modal-membresia');
  await renderFinanzas();
}
async function deleteMembresia(id){if(!confirm('¿Eliminar?'))return;await DB.saveMembresias((await DB.membresias()).filter(m=>m.id!==id));await renderFinanzas();}


// ══════════════════════════════════════════════════════════
// TRANSFERENCIAS ENTRE BILLETERAS
// ══════════════════════════════════════════════════════════

// Construye la lista de todas las "fuentes" disponibles (sky, mp por tienda, billeteras)
async function _listaFuentesTransfer() {
  const [billeteras, tiendas, saldos] = await Promise.all([DB.billeteras(), DB.tiendas(), DB.saldos()]);
  const fuentes = [
    { key: 'skydropx', nombre: 'Skydropx', es_banco: !!saldos['_es_banco_skydropx'] },
  ];
  tiendas.forEach(t => {
    const key = 'mercadopago_'+t.id;
    fuentes.push({ key, nombre: 'MP · '+t.nombre, es_banco: !!saldos['_es_banco_'+key] });
  });
  billeteras.forEach(b => fuentes.push({ key: b.id, nombre: b.nombre, es_banco: !!b.es_banco }));
  return fuentes;
}

async function openModalTransferencia() {
  const fuentes = await _listaFuentesTransfer();
  const opts = fuentes.map(f => `<option value="${f.key}" data-es-banco="${f.es_banco}">${f.nombre}${f.es_banco?' 🏦':''}</option>`).join('');
  document.getElementById('tr-origen').innerHTML  = opts;
  document.getElementById('tr-destino').innerHTML = opts;
  if (fuentes.length > 1) document.getElementById('tr-destino').selectedIndex = 1;
  sv('tr-valor', '');
  sv('tr-fecha', hoy());
  sv('tr-descripcion', '');
  const habilChk = document.getElementById('tr-banco-habil');
  if (habilChk) habilChk.checked = _esHoyDiaHabil();
  document.getElementById('tr-err').textContent = '';
  _actualizarBancoTransfer();
  openModal('modal-transferencia');
}

function _esHoyDiaHabil() {
  const dia = new Date().getDay();
  return dia >= 1 && dia <= 5;
}

async function _actualizarBancoTransfer() {
  const origenSel  = document.getElementById('tr-origen');
  const destinoSel  = document.getElementById('tr-destino');
  const avisoEl     = document.getElementById('tr-banco-aviso');
  const avisoTxtEl  = document.getElementById('tr-banco-aviso-txt');
  if (!origenSel || !destinoSel) return;
  const esBancoOrigen  = origenSel.selectedOptions[0]?.dataset.esBanco === 'true';
  const esBancoDestino = destinoSel.selectedOptions[0]?.dataset.esBanco === 'true';
  const ambosBancos = esBancoOrigen && esBancoDestino;

  if (ambosBancos) {
    const info = _calcularLlegadaTransfer();
    avisoTxtEl.textContent = info.esHoy
      ? 'El dinero estará disponible el mismo día.'
      : `El dinero quedará "Pendiente ingreso" hasta ${info.label}.`;
    avisoEl.style.display = '';
  } else {
    avisoEl.style.display = 'none';
  }

  // ── Previsualización de saldos ──
  const previewEl = document.getElementById('tr-preview');
  const origenKey  = origenSel.value;
  const destinoKey = destinoSel.value;
  const valor = _parseNum(document.getElementById('tr-valor').value) || 0;

  if (!origenKey || !destinoKey || origenKey === destinoKey) {
    if (previewEl) previewEl.style.display = 'none';
    return;
  }

  const saldos = await DB.saldos();
  const saldoOrigenAntes  = parseFloat(saldos[origenKey])  || 0;
  const saldoDestinoAntes = parseFloat(saldos[destinoKey]) || 0;
  // Misma regla que guardarTransferencia: si ambos son banco, depende del día hábil/hora; si no, siempre inmediato
  const seAcreditaYa = ambosBancos ? _calcularLlegadaTransfer().esHoy : true;

  const saldoOrigenDespues  = saldoOrigenAntes - valor;
  const saldoDestinoDespues = seAcreditaYa ? (saldoDestinoAntes + valor) : saldoDestinoAntes;

  document.getElementById('tr-preview-origen-label').textContent  = origenSel.selectedOptions[0]?.textContent.trim() || 'Origen';
  document.getElementById('tr-preview-destino-label').textContent = destinoSel.selectedOptions[0]?.textContent.trim() || 'Destino';
  document.getElementById('tr-preview-origen-antes').textContent    = fmt(saldoOrigenAntes);
  document.getElementById('tr-preview-origen-despues').textContent  = fmt(saldoOrigenDespues);
  document.getElementById('tr-preview-destino-antes').textContent   = fmt(saldoDestinoAntes);
  document.getElementById('tr-preview-destino-despues').textContent = seAcreditaYa
    ? fmt(saldoDestinoDespues)
    : fmt(saldoDestinoAntes) + ' (pendiente +' + fmt(valor).replace('$ ','') + ')';

  // Advertencia visual si el saldo origen queda negativo
  const origenDespuesEl = document.getElementById('tr-preview-origen-despues');
  origenDespuesEl.style.color = saldoOrigenDespues < 0 ? 'var(--red)' : '';

  previewEl.style.display = valor > 0 ? '' : 'none';
}

// Calcula si la transferencia entre bancos distintos llega el mismo día o al siguiente día hábil
function _calcularLlegadaTransfer() {
  const ahora = new Date();
  const hora  = ahora.getHours();
  const antesDelMediodia = hora < 12;
  // El usuario indica manualmente si hoy es día hábil bancario (checkbox)
  const habilChk = document.getElementById('tr-banco-habil');
  const esHabil = habilChk ? habilChk.checked : _esHoyDiaHabil();

  if (esHabil && antesDelMediodia) {
    return { esHoy: true, fechaDisponible: hoy(), label: 'hoy' };
  }
  // Buscar siguiente día (asumimos el día siguiente es hábil salvo que el usuario diga lo contrario en su próxima transferencia)
  let next = new Date(ahora);
  next.setDate(next.getDate() + 1);
  // Si hoy no es hábil, seguimos saltando fines de semana como aproximación
  if (!esHabil) {
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1);
    }
  }
  const y = next.getFullYear(), m = String(next.getMonth()+1).padStart(2,'0'), d = String(next.getDate()).padStart(2,'0');
  const fechaDisponible = `${y}-${m}-${d}`;
  return { esHoy: false, fechaDisponible, label: fmtFecha(fechaDisponible) };
}

async function guardarTransferencia() {
  const errEl = document.getElementById('tr-err');
  const origenKey  = document.getElementById('tr-origen').value;
  const destinoKey = document.getElementById('tr-destino').value;
  const valor = _parseNum(gv('tr-valor')) || 0;
  const fecha = gv('tr-fecha') || hoy();

  if (!origenKey || !destinoKey) { errEl.textContent = 'Selecciona origen y destino.'; return; }
  if (origenKey === destinoKey) { errEl.textContent = 'El origen y destino deben ser diferentes.'; return; }
  if (!valor || valor <= 0) { errEl.textContent = 'Ingresa un valor válido.'; return; }

  const fuentes = await _listaFuentesTransfer();
  const fOrigen  = fuentes.find(f => f.key === origenKey);
  const fDestino = fuentes.find(f => f.key === destinoKey);

  const saldos = await DB.saldos();
  const saldoOrigen = parseFloat(saldos[origenKey]) || 0;
  if (saldoOrigen < valor) { errEl.textContent = `Saldo insuficiente en ${fOrigen.nombre} (${fmt(saldoOrigen)}).`; return; }

  const ambosBancos = fOrigen.es_banco && fDestino.es_banco;
  const llegada = ambosBancos ? _calcularLlegadaTransfer() : { esHoy: true, fechaDisponible: fecha };

  const id = 'tr_' + uid();
  const ts = new Date().toISOString();

  // 1. Descontar de origen inmediatamente
  saldos[origenKey] = saldoOrigen - valor;

  // 2. Si mismo banco o llega hoy: acreditar destino de inmediato
  //    Si bancos distintos y no llega hoy: queda pendiente (no se acredita aún)
  if (llegada.esHoy) {
    saldos[destinoKey] = (parseFloat(saldos[destinoKey]) || 0) + valor;
  }
  await DB.saveSaldos(saldos);

  // 3. Registrar el movimiento de transferencia (un solo registro, tipo "transferencia")
  const descripcion = gv('tr-descripcion').trim();
  await DB.upsertMovimiento({
    id, fecha, tipo: 'transferencia',
    fuente: origenKey, fuente_destino: destinoKey,
    valor,
    concepto: `Transferencia: ${fOrigen.nombre} → ${fDestino.nombre}`,
    notas: descripcion || (ambosBancos ? 'Transferencia entre cuentas bancarias' : ''),
    fecha_registro: ts,
    pendiente: !llegada.esHoy,
    fecha_disponible: llegada.fechaDisponible,
  });

  closeModal('modal-transferencia');
  await renderFinanzas();
  showToast(
    llegada.esHoy ? 'Transferencia completada' : `Transferencia en camino — disponible ${fmtFecha(llegada.fechaDisponible)}`,
    'success', 2500
  );
}

// Muestra la lista de transferencias pendientes por ingresar (todas, sin filtro de mes)
async function _renderPendientesTransfer() {
  const movs = await DB.movimientos();
  const pendientes = movs.filter(m => m.tipo === 'transferencia' && m.pendiente)
    .sort((a,b) => (a.fecha_disponible||'').localeCompare(b.fecha_disponible||''));
  const cardEl = document.getElementById('fin-pendientes-card');
  const listEl = document.getElementById('fin-pendientes-list');
  if (!cardEl || !listEl) return;

  if (!pendientes.length) { cardEl.style.display = 'none'; return; }
  cardEl.style.display = '';

  const fuentes = await _listaFuentesTransfer();
  const nombreFuente = (key) => fuentes.find(f => f.key === key)?.nombre || key;

  listEl.innerHTML = pendientes.map(m => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);">
      <span style="width:24px;height:24px;border-radius:50%;background:var(--yellow-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:600;color:var(--text);">${nombreFuente(m.fuente)} → ${nombreFuente(m.fuente_destino)}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:1px;">${m.notas ? m.notas + ' · ' : ''}Disponible el <strong style="color:var(--yellow);">${fmtFecha(m.fecha_disponible)}</strong></div>
      </div>
      <span style="font-size:13px;font-weight:800;color:var(--yellow);white-space:nowrap;">${fmt(m.valor)}</span>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);font-size:11px;padding:4px 10px;" onclick="_pedirCodigoCancelarTransfer('${m.id}')">Cancelar</button>
    </div>`).join('');
}

// Revisa transferencias pendientes y las acredita si ya llegó su fecha disponible
async function _procesarTransferenciasPendientes() {
  const movs = await DB.movimientos();
  const pendientes = movs.filter(m => m.tipo === 'transferencia' && m.pendiente && m.fecha_disponible <= hoy());
  if (!pendientes.length) return;
  const saldos = await DB.saldos();
  let cambios = false;
  for (const m of pendientes) {
    saldos[m.fuente_destino] = (parseFloat(saldos[m.fuente_destino]) || 0) + (parseFloat(m.valor) || 0);
    m.pendiente = false;
    cambios = true;
  }
  if (cambios) {
    await DB.saveSaldos(saldos);
    await DB.saveMovimientos(movs);
  }
}


// ── CANCELAR TRANSFERENCIA PENDIENTE ──
var _cancelTransferId = '';
function _pedirCodigoCancelarTransfer(id) {
  _cancelTransferId = id;
  const inp = document.getElementById('cancel-tr-code-input');
  const err = document.getElementById('cancel-tr-code-error');
  if (inp) inp.value = '';
  if (err) err.textContent = '';
  openModal('modal-cancelar-transferencia');
  setTimeout(() => inp && inp.focus(), 150);
}

async function _confirmCancelarTransfer() {
  const inp  = document.getElementById('cancel-tr-code-input');
  const err  = document.getElementById('cancel-tr-code-error');
  const btn  = document.getElementById('cancel-tr-confirm-btn');
  const code = inp?.value.trim() || '';
  if (!code) { if (err) err.textContent = 'Ingresa el código.'; return; }
  if (btn) { btn.textContent = 'Verificando...'; btn.disabled = true; }
  try {
    const ok = await _verificarCodigoAcceso(code);
    if (!ok) { if (err) err.textContent = 'Código incorrecto.'; if (inp) { inp.value=''; inp.focus(); } return; }

    const movs = await DB.movimientos();
    const m = movs.find(x => x.id === _cancelTransferId);
    if (!m || m.tipo !== 'transferencia' || !m.pendiente) {
      if (err) err.textContent = 'Esta transferencia ya no se puede cancelar.';
      return;
    }

    // Revertir: devolver el dinero a la fuente de origen (nunca llegó a acreditarse en destino)
    const saldos = await DB.saldos();
    saldos[m.fuente] = (parseFloat(saldos[m.fuente]) || 0) + (parseFloat(m.valor) || 0);
    await DB.saveSaldos(saldos);
    await DB.deleteMovimiento(m.id);

    closeModal('modal-cancelar-transferencia');
    await renderFinanzas();
    showToast('Transferencia cancelada y dinero devuelto', 'success', 2500);
  } catch(e) {
    if (err) err.textContent = 'Error al verificar.';
    console.error(e);
  } finally {
    if (btn) { btn.textContent = 'Cancelar transferencia'; btn.disabled = false; }
  }
}