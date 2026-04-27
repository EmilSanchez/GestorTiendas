/* Módulo Finanzas — v2 */

// ── SVG ICONS ──
const _FIN_ICON = {
  card:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  wallet:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12V22H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/><path d="M20 12a2 2 0 0 0-2-2H4"/><circle cx="18" cy="17" r="2"/></svg>`,
  up:      `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`,
  down:    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`,
  trash:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
  edit:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  truck:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  mp:      `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
};

// ── HELPERS ──
function _mesLabel(ym) {
  const M = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const [y,m] = (ym||'').split('-');
  return `${M[parseInt(m,10)-1]||ym} ${y}`;
}

// ── RENDER PRINCIPAL ──
async function renderFinanzas() {
  const [movs, saldos, billeteras, tiendas, enviosSky] = await Promise.all([
    DB.movimientos(), DB.saldos(), DB.billeteras(), DB.tiendas(), DB.envios_sky()
  ]);

  // Selector de mes
  const mesEl = document.getElementById('fin-filtro-mes');
  if (mesEl && !mesEl.dataset.init) {
    const meses = Array.from({length:8}, (_,i)=>{ const d=new Date(); d.setMonth(d.getMonth()-i); return d.toISOString().slice(0,7); });
    mesEl.innerHTML = meses.map(m=>`<option value="${m}" ${m===mes()?'selected':''}>${_mesLabel(m)}</option>`).join('');
    mesEl.dataset.init = '1';
  }
  const mesAct = mesEl?.value || mes();

  _renderBilleteras(saldos, billeteras, tiendas);
  const movMes = movs.filter(m=>m.fecha?.startsWith(mesAct)).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  _renderMovimientos(movMes, mesAct);
  const skyMes = enviosSky.filter(e=>(e.fecha||'').startsWith(mesAct));
  _renderEnviosSky(skyMes, mesAct);
}

// ── BILLETERAS ──
function _renderBilleteras(saldos, billeteras, tiendas) {
  const el = document.getElementById('fin-billeteras');
  if (!el) return;

  const skySaldo = parseFloat(saldos['skydropx']) || 0;
  const skyCard = `
    <div class="fin-wallet-card" onclick="editarSaldoSkydropx()">
      <div class="fin-wallet-top">
        <span class="fin-wallet-icon">${_FIN_ICON.truck}</span>
        <div style="flex:1;min-width:0;">
          <div class="fin-wallet-name">Skydropx</div>
          <div class="fin-wallet-sub">Envíos nacionales</div>
        </div>
      </div>
      <div class="fin-wallet-amount ${skySaldo<0?'neg':skySaldo===0?'zero':''}">${fmt(skySaldo)}</div>
    </div>`;

  const mpCards = tiendas.map(t => {
    const key = 'mercadopago_' + t.id;
    const s   = parseFloat(saldos[key]) || 0;
    const foto = t.foto
      ? `<img src="${t.foto}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid ${t.color};flex-shrink:0;">`
      : `<span style="width:28px;height:28px;border-radius:50%;background:${t.color};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;">${_FIN_ICON.mp}</span>`;
    return `
    <div class="fin-wallet-card" onclick="editarMPSaldo('${t.id}')">
      <div class="fin-wallet-top">
        ${foto}
        <div style="flex:1;min-width:0;">
          <div class="fin-wallet-name">MP · ${t.nombre}</div>
          <div class="fin-wallet-sub">Mercado Pago</div>
        </div>
      </div>
      <div class="fin-wallet-amount ${s<0?'neg':s===0?'zero':''}">${fmt(s)}</div>
    </div>`;
  });

  const bwCards = billeteras.map(b => {
    const s = parseFloat(saldos[b.id]) || 0;
    return `
    <div class="fin-wallet-card" onclick="openModalSaldo('${b.id}')">
      <div class="fin-wallet-top">
        <span class="fin-wallet-icon">${_FIN_ICON.wallet}</span>
        <div style="flex:1;min-width:0;">
          <div class="fin-wallet-name">${b.nombre}</div>
          <div class="fin-wallet-sub">${b.tipo||'Billetera'}</div>
        </div>
        <button class="btn btn-ghost btn-icon btn-sm" title="Eliminar billetera"
          onclick="event.stopPropagation();deleteBilletera('${b.id}')"
          style="opacity:.45;margin-left:4px;">${_FIN_ICON.trash}</button>
      </div>
      <div class="fin-wallet-amount ${s<0?'neg':s===0?'zero':''}">${fmt(s)}</div>
    </div>`;
  });

  el.innerHTML = [skyCard, ...mpCards, ...bwCards].join('');
}

// ── MOVIMIENTOS ──
function _renderMovimientos(movMes, mesAct) {
  const el = document.getElementById('fin-movimientos');
  if (!el) return;

  const totalIng = movMes.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.valor,0);
  const totalEgr = movMes.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+m.valor,0);
  const net = totalIng - totalEgr;

  const resumen = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
      <div style="padding:9px 11px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
        <div style="font-size:9px;color:#15803d;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Ingresos</div>
        <div style="font-size:14px;font-weight:800;color:#15803d;">${fmt(totalIng)}</div>
      </div>
      <div style="padding:9px 11px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca;">
        <div style="font-size:9px;color:#b91c1c;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Egresos</div>
        <div style="font-size:14px;font-weight:800;color:#b91c1c;">${fmt(totalEgr)}</div>
      </div>
      <div style="padding:9px 11px;background:${net>=0?'#f0fdf4':'#fef2f2'};border-radius:8px;border:1px solid ${net>=0?'#bbf7d0':'#fecaca'};">
        <div style="font-size:9px;color:${net>=0?'#15803d':'#b91c1c'};font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Neto</div>
        <div style="font-size:14px;font-weight:800;color:${net>=0?'#15803d':'#b91c1c'};">${net>=0?'+':''}${fmt(net)}</div>
      </div>
    </div>`;

  if (!movMes.length) {
    el.innerHTML = resumen + `<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">Sin movimientos en ${_mesLabel(mesAct)}</div>`;
    return;
  }

  const rows = movMes.map(m => {
    const isIng = m.tipo === 'ingreso';
    const fl = FUENTES_LABEL[m.fuente] || m.fuente || '—';
    const isSkyAuto = !!m._sky_id;
    return `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);">
      <span style="width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;
        background:${isIng?'#f0fdf4':'#fef2f2'};flex-shrink:0;">
        ${isIng ? _FIN_ICON.up : _FIN_ICON.down}
      </span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.concepto}${isSkyAuto?` <span style="font-size:9px;background:#e0f2fe;color:#0369a1;padding:1px 5px;border-radius:3px;font-weight:700;">AUTO</span>`:''}</div>
        <div style="font-size:10px;color:var(--text3);">${m.fecha} · ${fl}</div>
      </div>
      <span style="font-size:12px;font-weight:800;color:${isIng?'var(--green)':'var(--red)'};white-space:nowrap;">${isIng?'+':'−'}${fmt(m.valor)}</span>
      ${!isSkyAuto?`<button class="btn btn-ghost btn-icon btn-sm" onclick="openModalMovimiento('${m.id}')">${_FIN_ICON.edit}</button>`:''}
      <button class="btn btn-danger btn-icon btn-sm" onclick="deleteMovimiento('${m.id}')">${_FIN_ICON.trash}</button>
    </div>`;
  }).join('');

  el.innerHTML = resumen + `<div style="max-height:300px;overflow-y:auto;">${rows}</div>`;
}

// ── ENVÍOS SKYDROPX ──
function _renderEnviosSky(skyMes, mesAct) {
  const el = document.getElementById('fin-envios-sky');
  if (!el) return;

  const total = skyMes.reduce((s,e)=>s+(parseFloat(e.valor)||0),0);

  if (!skyMes.length) {
    el.innerHTML = `<div style="text-align:center;padding:18px;color:var(--text3);font-size:12px;">Sin envíos registrados en ${_mesLabel(mesAct)}</div>`;
    return;
  }

  const rows = skyMes.map(e=>`
    <tr style="border-bottom:1px solid var(--border);">
      <td style="padding:7px 8px;font-size:11px;color:var(--text3);">${e.fecha||'—'}</td>
      <td style="padding:7px 8px;font-size:12px;font-weight:600;">${e.num_venta||'—'}</td>
      <td style="padding:7px 8px;font-family:var(--font-mono);font-size:11px;">${e.num_guia||'—'}</td>
      <td style="padding:7px 8px;font-size:11px;">${e.transportadora||'—'}</td>
      <td style="padding:7px 8px;font-size:12px;font-weight:700;color:var(--red);">${fmt(e.valor)}</td>
      <td style="padding:7px 8px;font-size:11px;color:var(--text3);">${FUENTES_LABEL[e.fuente_pago]||e.fuente_pago||'Skydropx'}</td>
      <td style="padding:7px 8px;text-align:center;">
        <button class="btn btn-danger btn-icon btn-sm" onclick="deleteEnvioSky('${e.id}')">${_FIN_ICON.trash}</button>
      </td>
    </tr>`).join('');

  el.innerHTML = `
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:2px solid var(--border);">
            ${['Fecha','N° Venta','Guía','Transportadora','Valor','Pagado desde',''].map(h=>`<th style="padding:6px 8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);font-weight:700;">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="padding:8px 0 0;font-size:11px;color:var(--text3);text-align:right;">
      Total: <strong style="color:var(--red);">${fmt(total)}</strong> descontados de Skydropx en ${_mesLabel(mesAct)}
    </div>`;
}

// ── MODAL ENVÍO SKYDROPX ──
let _editEnvioSkyId = null;

async function openModalEnvioSky(id) {
  _editEnvioSkyId = id || null;
  const [billeteras, tiendas] = await Promise.all([DB.billeteras(), DB.tiendas()]);
  const opts = [
    `<option value="skydropx">Skydropx (saldo propio)</option>`,
    ...tiendas.map(t=>`<option value="mercadopago_${t.id}">MP · ${t.nombre}</option>`),
    ...billeteras.map(b=>`<option value="${b.id}">${b.nombre}</option>`),
  ].join('');
  document.getElementById('sky-fuente').innerHTML = opts;

  if (id) {
    const e = (await DB.envios_sky()).find(x=>x.id===id);
    if (e) {
      sv('sky-fecha',e.fecha||hoy()); sv('sky-num-venta',e.num_venta||'');
      sv('sky-num-guia',e.num_guia||''); sv('sky-transportadora',e.transportadora||'');
      sv('sky-valor',e.valor||''); sv('sky-fuente',e.fuente_pago||'skydropx');
    }
  } else {
    sv('sky-fecha',hoy()); sv('sky-num-venta',''); sv('sky-num-guia','');
    sv('sky-transportadora',''); sv('sky-valor',''); sv('sky-fuente','skydropx');
  }
  document.getElementById('modal-envio-sky-title').textContent = id ? 'Editar Envío' : 'Registrar Envío Skydropx';
  openModal('modal-envio-sky');
}

async function saveEnvioSky() {
  const valor = parseFloat(gv('sky-valor')) || 0;
  if (!valor) { showToast('Ingresa el valor del envío.','error'); return; }
  const fecha       = gv('sky-fecha')||hoy();
  const num_venta   = gv('sky-num-venta').trim();
  const num_guia    = gv('sky-num-guia').trim();
  const transport   = gv('sky-transportadora').trim();
  const fuente_pago = gv('sky-fuente')||'skydropx';
  const id = _editEnvioSkyId || uid();

  await DB.upsertEnvioSky({ id, fecha, num_venta, num_guia, transportadora:transport, valor, fuente_pago, fecha_registro:new Date().toISOString() });

  // Descontar del saldo de la billetera origen
  const saldos = await DB.saldos();
  saldos[fuente_pago] = (parseFloat(saldos[fuente_pago])||0) - valor;
  await DB.saveSaldos(saldos);

  // Registrar movimiento egreso automático
  await DB.upsertMovimiento({
    id: 'sky_'+id, fecha, tipo:'egreso', fuente:fuente_pago, valor,
    concepto:`Envío Skydropx${num_venta?' · '+num_venta:''}${num_guia?' · '+num_guia:''}`,
    notas:`Transportadora: ${transport||'—'}`, fecha_registro:new Date().toISOString(), _sky_id:id,
  });

  closeModal('modal-envio-sky');
  await renderFinanzas();
  showToast(`Envío registrado · ${fmt(valor)} descontado`, 'success');
}

async function deleteEnvioSky(id) {
  if (!confirm('¿Eliminar este envío Skydropx?\nNota: el saldo NO se reintegrará automáticamente.')) return;
  const movs   = await DB.movimientos();
  const linked = movs.find(m=>m._sky_id===id);
  if (linked) await DB.deleteMovimiento(linked.id);
  await DB.deleteEnvioSky(id);
  await renderFinanzas();
}

async function editarSaldoSkydropx() {
  const saldos = await DB.saldos();
  const actual = parseFloat(saldos['skydropx'])||0;
  const nuevo  = prompt(`Skydropx — Saldo actual: ${fmt(actual)}\n\nIngresa el nuevo saldo (COP$):`, actual||'');
  if (nuevo===null) return;
  const val = parseFloat(nuevo);
  if (isNaN(val)) { alert('Valor inválido'); return; }
  saldos['skydropx'] = val;
  await DB.saveSaldos(saldos);
  await renderFinanzas();
}

// ── BILLETERAS PERSONALIZADAS ──
function openModalNuevaBilletera() {
  sv('bw-nombre',''); sv('bw-tipo',''); sv('bw-saldo','');
  openModal('modal-billetera');
}
async function saveNuevaBilletera() {
  const nombre = gv('bw-nombre').trim();
  if (!nombre) { showToast('El nombre es requerido.','error'); return; }
  const tipo  = gv('bw-tipo').trim()||'Billetera';
  const saldo = parseFloat(gv('bw-saldo'))||0;
  const id    = 'bw_'+uid();
  const bws   = await DB.billeteras();
  bws.push({ id, nombre, tipo, fecha:hoy() });
  await DB.saveBilleteras(bws);
  const saldos = await DB.saldos();
  saldos[id]   = saldo;
  await DB.saveSaldos(saldos);
  FUENTES_LABEL[id] = nombre;
  closeModal('modal-billetera');
  await renderFinanzas();
  await actualizarSelectsFuente();
  showToast(`Billetera "${nombre}" creada`,'success');
}
async function deleteBilletera(id) {
  const bws = await DB.billeteras();
  const bw  = bws.find(x=>x.id===id);
  if (!bw||!confirm(`¿Eliminar "${bw.nombre}"? El saldo se perderá.`)) return;
  await DB.saveBilleteras(bws.filter(x=>x.id!==id));
  const saldos = await DB.saldos(); delete saldos[id]; await DB.saveSaldos(saldos);
  delete FUENTES_LABEL[id];
  await renderFinanzas(); await actualizarSelectsFuente();
}
async function actualizarSelectsFuente() {
  const [bws, tiendas] = await Promise.all([DB.billeteras(), DB.tiendas()]);
  const opts = `<option value="">— Seleccionar —</option>`
    + tiendas.map(t=>`<option value="mercadopago_${t.id}">MP · ${t.nombre}</option>`).join('')
    + `<option value="skydropx">Skydropx</option>`
    + bws.map(b=>`<option value="${b.id}">${b.nombre}</option>`).join('');
  ['v-fuente-pago','mov-fuente'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){const cur=el.value;el.innerHTML=opts;el.value=cur||'';}
  });
}

// ── MOVIMIENTOS MANUALES ──
async function openModalMovimiento(id) {
  const [mov, bws, tiendas] = await Promise.all([
    id?(await DB.movimientos()).find(x=>x.id===id):null,
    DB.billeteras(), DB.tiendas()
  ]);
  const opts = tiendas.map(t=>`<option value="mercadopago_${t.id}">MP · ${t.nombre}</option>`).join('')
    + `<option value="skydropx">Skydropx</option>`
    + bws.map(b=>`<option value="${b.id}">${b.nombre}</option>`).join('');
  document.getElementById('mov-fuente').innerHTML = opts;
  document.getElementById('mov-title').textContent = mov?'Editar Movimiento':'Nuevo Movimiento';
  sv('mov-fecha',  mov?.fecha   ||hoy());
  sv('mov-tipo',   mov?.tipo    ||'egreso');
  sv('mov-fuente', mov?.fuente  ||'');
  sv('mov-valor',  mov?.valor   ||'');
  sv('mov-concepto',mov?.concepto||'');
  sv('mov-notas',  mov?.notas   ||'');
  document.getElementById('modal-movimiento')._editId = id||null;
  openModal('modal-movimiento');
}
async function saveMovimiento() {
  const valor=parseFloat(gv('mov-valor'))||0;
  const concepto=gv('mov-concepto').trim();
  if(!valor){showToast('Ingresa el valor.','error');return;}
  if(!concepto){showToast('Ingresa un concepto.','error');return;}
  const id=document.getElementById('modal-movimiento')._editId||uid();
  await DB.upsertMovimiento({id,fecha:gv('mov-fecha'),tipo:gv('mov-tipo'),
    fuente:gv('mov-fuente'),valor,concepto,notas:gv('mov-notas'),fecha_registro:new Date().toISOString()});
  closeModal('modal-movimiento');
  await renderFinanzas();
}
async function deleteMovimiento(id) {
  if(!confirm('¿Eliminar este movimiento?'))return;
  await DB.deleteMovimiento(id);
  await renderFinanzas();
}

// ── SALDO MANUAL ──
async function openModalSaldo(fuente) {
  const saldos=await DB.saldos();
  const actual=parseFloat(saldos[fuente])||0;
  const label=FUENTES_LABEL[fuente]||fuente;
  const nuevo=prompt(`${label}\nSaldo actual: ${fmt(actual)}\n\nIngresa el nuevo saldo (COP$):`,actual||'');
  if(nuevo===null)return;
  const val=parseFloat(nuevo);
  if(isNaN(val)){alert('Valor inválido');return;}
  saldos[fuente]=val;
  await DB.saveSaldos(saldos);
  await renderFinanzas();
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