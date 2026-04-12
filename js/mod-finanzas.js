/* Módulo Finanzas */

// ── MÓDULO FINANZAS ──
async function renderFinanzas() {
  const movs    = await DB.movimientos();
  const mems    = await DB.membresias();
  const saldos  = await DB.saldos();
  const bwExtra = await DB.billeteras(); // billeteras personalizadas

  // Poblar selector de mes
  const mesEl = document.getElementById('fin-filtro-mes');
  if(mesEl && !mesEl.innerHTML) {
    const meses = Array.from({length:6},(_,i)=>{ const d=new Date(); d.setMonth(d.getMonth()-i); return d.toISOString().slice(0,7); });
    mesEl.innerHTML = meses.map(m=>`<option value="${m}" ${m===mes()?'selected':''}>${m}</option>`).join('');
  }
  const mesAct = mesEl?.value || mes();

  // ── Saldos — solo billeteras guardadas en la BD ──
  document.getElementById('fin-saldos').innerHTML = bwExtra.length
    ? bwExtra.map(b=>{
        const s = parseFloat(saldos[b.id])||0;
        return `<div class="stat-card ${s<0?'red':s===0?'yellow':'green'}" style="cursor:pointer;" onclick="openModalSaldo('${b.id}')">
          <div class="stat-icon">${b.icono||'💳'}</div>
          <div class="stat-label">${b.nombre}</div>
          <div class="stat-value ${s<0?'red':s===0?'yellow':'green'}">${fmt(s)}</div>
          <div class="stat-delta"><button class="btn btn-danger btn-sm" style="font-size:9px;padding:1px 5px;margin-top:2px;"
            onclick="event.stopPropagation();deleteBilletera('${b.id}')">🗑 Eliminar</button></div>
        </div>`;
      }).join('')
    : '<div class="c-dim" style="font-size:12px;padding:16px 0;">No hay billeteras registradas. Crea una con "+ Billetera".</div>';

  // ── Membresía Centris ──
  const memMes = mems.filter(m=>m.mes===mesAct);
  const memEl  = document.getElementById('fin-membresia');
  if(memMes.length) {
    const m = memMes[memMes.length-1];
    memEl.innerHTML = `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;">
      <span style="font-size:22px;">✅</span>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:var(--green);">Pagado — ${fmt(m.valor)}</div>
        <div style="font-size:11px;color:var(--text3);">${m.fecha} · ${FUENTES_ICON[m.fuente]||''} ${FUENTES_LABEL[m.fuente]||m.fuente}${m.obs?' · '+m.obs:''}</div>
      </div>
      <button class="btn btn-danger btn-sm btn-icon" onclick="deleteMembresia('${m.id}')">🗑</button>
    </div>`;
  } else {
    memEl.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;">
      <span style="font-size:22px;opacity:.3;">📦</span>
      <div style="font-size:12px;color:var(--yellow);font-weight:600;">⚠️ Sin pago registrado para ${mesAct}</div>
    </div>`;
  }

  // ── Movimientos del mes ──
  const movMes = movs.filter(m=>m.fecha?.startsWith(mesAct)).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const movEl  = document.getElementById('fin-movimientos');
  if(!movMes.length) {
    movEl.innerHTML = '<div class="empty-state" style="padding:24px;"><div class="empty-icon">📋</div><div class="empty-title">Sin movimientos</div></div>';
  } else {
    movEl.innerHTML = `<div style="max-height:360px;overflow-y:auto;">${movMes.map(m=>`
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:16px;">${m.tipo==='ingreso'?'⬆️':'⬇️'}</span>
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:600;">${m.concepto}</div>
          <div style="font-size:10px;color:var(--text3);">${m.fecha} · ${FUENTES_ICON[m.fuente]||''} ${FUENTES_LABEL[m.fuente]||m.fuente}</div>
        </div>
        <span class="mono fw7" style="color:${m.tipo==='ingreso'?'var(--green)':'var(--red)'};">
          ${m.tipo==='ingreso'?'+':'−'}${fmt(m.valor)}
        </span>
        <button class="btn btn-danger btn-icon btn-sm" onclick="deleteMovimiento('${m.id}')">🗑</button>
      </div>`).join('')}
    </div>
    <div style="padding:8px 0;font-size:11px;color:var(--text3);display:flex;justify-content:space-between;">
      <span>Total ingresos: <b style="color:var(--green);">${fmt(movMes.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.valor,0))}</b></span>
      <span>Total egresos: <b style="color:var(--red);">${fmt(movMes.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+m.valor,0))}</b></span>
    </div>`;
  }

  // ── Resumen por fuente ──
  const porFuente = {};
  movMes.forEach(m=>{ if(!porFuente[m.fuente]) porFuente[m.fuente]={ing:0,egr:0}; if(m.tipo==='ingreso') porFuente[m.fuente].ing+=m.valor; else porFuente[m.fuente].egr+=m.valor; });
  const fEl = document.getElementById('fin-por-fuente');
  const fKeys = Object.keys(porFuente);
  fEl.innerHTML = fKeys.length ? fKeys.map(f=>{
    const d = porFuente[f];
    const net = d.ing - d.egr;
    return `<div style="padding:8px 0;border-bottom:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
        <span style="font-size:12px;font-weight:600;">${FUENTES_ICON[f]||'💳'} ${FUENTES_LABEL[f]||f}</span>
        <span class="mono fw7" style="color:${net>=0?'var(--green)':'var(--red)'};">${net>=0?'+':''}${fmt(net)}</span>
      </div>
      <div style="font-size:10px;color:var(--text3);display:flex;gap:12px;">
        <span>⬆️ Ingresos: ${fmt(d.ing)}</span>
        <span>⬇️ Egresos: ${fmt(d.egr)}</span>
      </div>
    </div>`;
  }).join('') : '<div class="c-dim" style="font-size:12px;padding:16px 0;text-align:center;">Sin movimientos este mes</div>';
}

// ── BILLETERAS PERSONALIZADAS ──
function openModalNuevaBilletera() {
  sv('bw-nombre',''); sv('bw-icono','💳'); sv('bw-saldo','');
  openModal('modal-billetera');
}
async function saveNuevaBilletera() {
  const nombre = gv('bw-nombre').trim();
  if(!nombre){ alert('El nombre es requerido.'); return; }
  const icono  = gv('bw-icono').trim() || '💳';
  const saldo  = parseFloat(gv('bw-saldo')) || 0;
  const id     = 'bw_' + uid();
  const bws    = await DB.billeteras();
  bws.push({ id, nombre, icono, fecha:hoy() });
  await DB.saveBilleteras(bws);
  // Guardar saldo inicial
  const saldos = await DB.saldos();
  saldos[id] = saldo;
  await DB.saveSaldos(saldos);
  // Actualizar maps en memoria
  FUENTES_LABEL[id] = nombre;
  FUENTES_ICON[id]  = icono;
  closeModal('modal-billetera');
  await renderFinanzas();
  // Actualizar selects de fuente de pago en modal venta y movimiento
  await actualizarSelectsFuente();
}
async function deleteBilletera(id) {
  const bws = await DB.billeteras();
  const bw  = bws.find(x=>x.id===id);
  if(!bw) return;
  if(!confirm(`¿Eliminar la billetera "${bw.nombre}"? El saldo se perderá.`)) return;
  await DB.saveBilleteras(bws.filter(x=>x.id!==id));
  const saldos = await DB.saldos();
  delete saldos[id];
  await DB.saveSaldos(saldos);
  delete FUENTES_LABEL[id];
  delete FUENTES_ICON[id];
  await renderFinanzas();
  await actualizarSelectsFuente();
}
async function actualizarSelectsFuente() {
  const bws = await DB.billeteras();
  // Solo billeteras guardadas en la BD
  const allOpts = bws.map(b=>`<option value="${b.id}">${b.icono||'💳'} ${b.nombre}</option>`).join('');
  ['v-fuente-pago','mov-fuente'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){ const cur=el.value; el.innerHTML=`<option value="">— Seleccionar —</option>`+allOpts; el.value=cur||''; }
  });
}

async function openModalMovimiento(id) {
  const mov = id ? (await DB.movimientos()).find(x=>x.id===id) : null;
  document.getElementById('mov-title').textContent = mov ? 'Editar Movimiento' : 'Nuevo Movimiento';
  sv('mov-fecha', mov?.fecha||hoy());
  sv('mov-tipo',  mov?.tipo||'egreso');
  sv('mov-fuente',mov?.fuente||'mercadopago');
  sv('mov-valor', mov?.valor||'');
  sv('mov-concepto', mov?.concepto||'');
  sv('mov-notas', mov?.notas||'');
  document.getElementById('modal-movimiento')._editId = id||null;
  openModal('modal-movimiento');
}

async function saveMovimiento() {
  const valor   = parseFloat(gv('mov-valor'))||0;
  const concepto= gv('mov-concepto').trim();
  if(!valor)    { alert('Ingresa el valor del movimiento.'); return; }
  if(!concepto) { alert('Ingresa un concepto.'); return; }
  const id = document.getElementById('modal-movimiento')._editId || uid();
  await DB.upsertMovimiento({ id, fecha:gv('mov-fecha'), tipo:gv('mov-tipo'),
    fuente:gv('mov-fuente'), valor, concepto, notas:gv('mov-notas'), fecha_registro:new Date().toISOString() });
  closeModal('modal-movimiento');
  await renderFinanzas();
}

async function deleteMovimiento(id) {
  if(!confirm('¿Eliminar este movimiento?')) return;
  await DB.deleteMovimiento(id);
  await renderFinanzas();
}

function openModalMembresia() {
  sv('mem-mes', mes()); sv('mem-valor',''); sv('mem-fuente','mercadopago');
  sv('mem-fecha', hoy()); sv('mem-obs','');
  openModal('modal-membresia');
}

async function saveMembresia() {
  const valor = parseFloat(gv('mem-valor'))||0;
  if(!valor) { alert('Ingresa el valor de la membresía.'); return; }
  await DB.upsertMembresia({ id:uid(), mes:gv('mem-mes'), valor, fuente:gv('mem-fuente'),
    fecha:gv('mem-fecha'), obs:gv('mem-obs'), fecha_registro:new Date().toISOString() });
  // También registrar como movimiento egreso automáticamente
  await DB.upsertMovimiento({ id:uid(), fecha:gv('mem-fecha'), tipo:'egreso',
    fuente:gv('mem-fuente'), valor, concepto:`Membresía Centris ${gv('mem-mes')}`,
    notas:gv('mem-obs'), fecha_registro:new Date().toISOString() });
  closeModal('modal-membresia');
  await renderFinanzas();
}

async function deleteMembresia(id) {
  if(!confirm('¿Eliminar este pago de membresía?')) return;
  const mems = (await DB.membresias()).filter(m=>m.id!==id);
  await DB.saveMembresias(mems);
  await renderFinanzas();
}

async function openModalSaldo(fuente) {
  const actual = await getSaldoFuente(fuente);
  const nuevo  = prompt(`${FUENTES_ICON[fuente]} ${FUENTES_LABEL[fuente]}\nSaldo actual: ${fmt(actual)}\n\nIngresa el nuevo saldo (COP$):`, actual||'');
  if(nuevo===null) return;
  const val = parseFloat(nuevo);
  if(isNaN(val)) { alert('Valor inválido'); return; }
  const saldos = await DB.saldos();
  saldos[fuente] = val;
  await DB.saveSaldos(saldos);
  await renderFinanzas();
}

