/* Módulo Ayudas */

// MÓDULO AYUDAS — localStorage, CRUD, UI
// ══════════════════════════════════════════════════════════

const _AYUDAS_KEY = 'mm_ayudas_v1';
let _ayudas = [];
let _ayudaCatActiva = '__todas__';

// Paleta de colores para las tarjetas
const _AYUDA_COLORES = [
  { hex:'#00897b', label:'Teal'      },
  { hex:'#1565c0', label:'Azul'      },
  { hex:'#2e7d32', label:'Verde'     },
  { hex:'#c62828', label:'Rojo'      },
  { hex:'#6a1b9a', label:'Morado'    },
  { hex:'#e65100', label:'Naranja'   },
  { hex:'#f9a825', label:'Amarillo'  },
  { hex:'#37474f', label:'Gris'      },
];

// Categoría → color por defecto
const _CAT_COLORES = {
  reembolso:'#c62828', demoras:'#e65100', cliente:'#1565c0',
  amazon:'#f9a825', mercadolibre:'#00897b', envios:'#2e7d32',
  rastreo:'#6a1b9a', infracciones:'#37474f', general:'#37474f', otro:'#37474f'
};

function _loadAyudas() {
  try {
    const raw = localStorage.getItem(_AYUDAS_KEY);
    _ayudas = raw ? JSON.parse(raw) : [];
  } catch { _ayudas = []; }
}

function _saveAyudas() {
  localStorage.setItem(_AYUDAS_KEY, JSON.stringify(_ayudas));
}

function _ayudaId() {
  return 'ay_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
}

// ── PRE-CARGA: insertar ayudas del screenshot si no hay ninguna ──
function _precargarAyudas() {
  if(_ayudas.length > 0) return;
  const datos = [
    { titulo:'Mensajes para quitar demoras', categoria:'demoras', color:'#00897b',
      contenido:'Buenos días, espero se encuentre bien, lo que pasa es que tengo unas ventas las cuales no logré despachar a tiempo el pedido indicado por cuestión de las fuertes lluvias en mi ciudad, literalmente las calles estaban totalmente inundadas, por favor me pueden ayudar para que esto no me afecte en mi reputación. Ya siempre trato de despachar todo a tiempo, pero esta vez se me salió de las manos con varios productos' },
    { titulo:'Para pedir reembolso en Amazon – pedido marca entregado y "No Llego"', categoria:'amazon', color:'#c62828',
      contenido:'Lo que pasa es que compré el siguiente pedido — y me aparece entregado, ya yo consulté con el transportista y no me recibieron ninguna ayuda, me comunicaron que en la sucursal procesaron el movimiento al día siguiente. Sin embargo, cuento con el comprobante de despacho que respalda el cumplimiento con los tiempos de entrega. Agradezco mucho tu apoyo para revisar este inconveniente.' },
    { titulo:'Enviar solo si el cliente desea reversar la compra', categoria:'reembolso', color:'#e65100',
      contenido:'Para realizar la cancelación de forma correcta y evitar retrasos en el reembolso del dinero por favor seguir los siguientes pasos:\n> Ingresar a detalles de la compra\n> Seleccionar la opción cancelar compra\n> Luego seleccionar la opción la fecha de entrega cambio' },
    { titulo:'Para tumbar demoras', categoria:'demoras', color:'#37474f',
      contenido:'Estamos trabajando para solucionar este problema cuanto antes. La demora está afectando tu reputación.' },
    { titulo:'Cuando hay problemas al importar un producto', categoria:'cliente', color:'#1565c0',
      contenido:'Buen día, espero te encuentres bien, me comunico con el fin de informarte que tenemos un inconveniente ya que al ser este artículo muy solicitado estaría llegando mínimo en 3 meses y ya para estas fechas mercado libre no da garantía de tu dinero y me darían el dinero sin usted haber recibido el producto, por ello me contacto con el fin de saber como procedemos. Entender si deseas reversar la compra.' },
    { titulo:'Para solicitar datos al cliente', categoria:'cliente', color:'#2e7d32',
      contenido:'Voy a necesitar los siguientes datos\n\nnombre completo:\ncédula:\ndirección:\nbarrio:\nciudad:\ndepartamento:\nteléfono:\ncorreo:' },
    { titulo:'Rastreo Servientrega Kiwi para información exacta', categoria:'rastreo', color:'#6a1b9a',
      contenido:'https://mytrack.servientrega.us/es' },
    { titulo:'Cuando hay que pedir dinero al cliente', categoria:'cliente', color:'#f9a825',
      contenido:'Buenas tardes! Espero te encuentres bien, nos indican que para que el producto pueda ingresar a Colombia están cobrando un valor adicional de 67990, quisiera saber si estas dispuesto a colaborarnos ya que nosotros estamos cubriendo los demás gastos de importación y envío. Quedo atento 😊' },
    { titulo:'Para que el cliente cancele', categoria:'reembolso', color:'#c62828',
      contenido:'Buenas tardes, lo que pasa es que hemos intentado despachar el producto pero hemos tenido con la etiqueta que MercadoLibre nos brinda para despachar el producto, hemos hablado con pero no nos han colaborado dándonos la etiqueta para despachar el producto, sin obtener ayuda. Ya que nos aparece como envío pendiente y no nos genera la etiqueta, entonces para un reclamo indicando que tuviste un inconveniente y hacerte el reembolso para que puedas hacer nuevamente la compra' },
    { titulo:'Enviar para que retiren las denuncias', categoria:'infracciones', color:'#37474f',
      contenido:'Buenos días, espero te encuentres bien, mira lo que pasa es que yo recibí una denuncia en mercado libre acerca de unas publicaciones que realizé de la marca (), las cuales fueron confirmadas por ustedes y dicen que no tengo autorización para vender, cosa que yo no sabía, me estoy comunicando con ustedes por este medio para solicitar por favor si es posible me sea retirada la denuncia ya que esto afecta directamente mi cuenta, mi compromiso es retirar todas las publicaciones que tenga de esta marca, en cuanto ustedes me retiren la denuncia, muchas gracias. quedo atenta a su respuesta.' },
    { titulo:'Tumbar y revisar infracciones de las tiendas', categoria:'infracciones', color:'#c62828',
      contenido:'https://www.mercadolibre.com.co/noindex/pppi/infractions\n\n¿Por qué quieres contactarte?\nNo estoy de acuerdo con la infracción\n\nExplícanos más:\n\nBuenas tardes, me comunico ya que me están llegando correos por link y datos de contacto diciendo que estoy cometiendo infracciones y no es así, serías tan amable de ayudarme con eso.' },
    { titulo:'Responder denuncias (eliminar imágenes denunciadas)', categoria:'infracciones', color:'#6a1b9a',
      contenido:'Hola, buenos días, las imágenes que nosotros publicamos son brindadas por nuestro proveedor oficial en este caso es Amazon de igual forma estoy dispuesto a borrar la publicación si es necesario, ya que no quiero que mi cuenta se vea en un futuro suspendida' },
    { titulo:'Error de venta o no disponible en Amazon', categoria:'amazon', color:'#f9a825',
      contenido:'Buenos días, lastimosamente te comento que mi proveedor se encuentra en otra ubicación y tiempo el envío, estaría llegando mínimo en 3 meses y ya para estas fechas mercado libre no de tu dinero y me darían el dinero sin usted haber recibido el producto, por ello me contacto a saber como procedemos.' },
    { titulo:'Para iniciar un chat de una con Mercado Libre', categoria:'mercadolibre', color:'#00897b',
      contenido:'https://www.mercadolibre.com.co/ayuda/content/39353/contact/1482' },
    { titulo:'Para revisar categorías incorrectas — Mercado Libre', categoria:'mercadolibre', color:'#00897b',
      contenido:'https://www.mercadolibre.com.co/publicaciones/?listado?filters=CHANNEL_NO_PROXIMITY_AND_NO_MP_MERCHANTS|OMNI_INFRINGED_POLICIES&page=1&sort=DEFAULT' },
    { titulo:'Cuando el pedido no aparece y toca dar un reembolso', categoria:'reembolso', color:'#c62828',
      contenido:'Lamento profundamente no haberle dado la experiencia de compra que merece. Me disculpo sinceramente por los inconvenientes y la espera que ha tenido que soportar debido a los retrasos en aduanas, sobre los cuales no he logrado obtener una fecha de liberación. Procederé con el reembolso como me lo solicitó. Aprecio mucho su paciencia y lamento cualquier molestia que esto le haya causado.' },
    { titulo:'Pedir número a clientes', categoria:'cliente', color:'#2e7d32',
      contenido:'Buen día, espero te encuentres bien, con el fin de mantenerte informado por todos los canales posibles a cerca del proceso de tu compra, estamos solicitando tu número de contacto.\n\nQue tengas un excelente día' },
  ];
  datos.forEach(d => {
    _ayudas.push({
      id: _ayudaId(),
      titulo: d.titulo,
      categoria: d.categoria,
      color: d.color,
      contenido: d.contenido,
      ts: Date.now()
    });
  });
  _saveAyudas();
}

// ── RENDER PRINCIPAL ──
async function renderAyudas() {
  _loadAyudas();
  _precargarAyudas();
  renderAyudasFiltradas();
}

function renderAyudasFiltradas() {
  const q   = (document.getElementById('ayuda-search')?.value || '').toLowerCase().trim();
  const cat = _ayudaCatActiva;

  // Filtrar
  let lista = _ayudas.filter(a => {
    const matchCat = (cat === '__todas__') || (a.categoria === cat);
    const matchQ   = !q || a.titulo.toLowerCase().includes(q) || a.contenido.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  // Render chips de categorías
  const cats = ['__todas__', ...[...new Set(_ayudas.map(a => a.categoria).filter(Boolean))]];
  const catsBar = document.getElementById('ayuda-cats-bar');
  if(catsBar) {
    catsBar.innerHTML = cats.map(c => {
      const label = c === '__todas__' ? `Todas (${_ayudas.length})` : _catLabel(c) + ` (${_ayudas.filter(a=>a.categoria===c).length})`;
      return `<span class="ayuda-filter-chip ${c===_ayudaCatActiva?'active':''}"
        onclick="_setAyudaCat('${c}')">${label}</span>`;
    }).join('');
  }

  // Render grid
  const grid  = document.getElementById('ayudas-grid');
  const empty = document.getElementById('ayudas-empty');
  if(!grid) return;

  if(lista.length === 0) {
    grid.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  grid.innerHTML = lista.map((a, i) => {
    const preview = a.contenido.replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const cat     = _catLabel(a.categoria);
    const color   = a.color || '#00897b';
    const delay   = Math.min(i * 40, 400);
    return `
    <div class="ayuda-card" style="animation-delay:${delay}ms;" onclick="verAyuda('${a.id}')">
      <div class="ayuda-card-bar" style="background:${color};"></div>
      <div class="ayuda-card-body">
        <div class="ayuda-card-titulo">${_esc(a.titulo)}</div>
        <div class="ayuda-card-preview">${preview}</div>
      </div>
      <div class="ayuda-card-footer">
        <span class="ayuda-cat-chip" style="background:${color}22;color:${color};border-color:${color}44;">${cat}</span>
        <button class="ayuda-copy-btn" id="copy-btn-${a.id}" onclick="event.stopPropagation();copiarAyuda('${a.id}',this)" title="Copiar mensaje">📋 Copiar</button>
        <button class="ayuda-edit-btn" onclick="event.stopPropagation();openModalAyuda('${a.id}')" title="Editar">✏️</button>
        <button class="ayuda-del-btn"  onclick="event.stopPropagation();eliminarAyuda('${a.id}')" title="Eliminar">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function _setAyudaCat(cat) {
  _ayudaCatActiva = cat;
  renderAyudasFiltradas();
}

function _catLabel(cat) {
  const labels = { general:'General', reembolso:'Reembolso', demoras:'Demoras',
    cliente:'Cliente', amazon:'Amazon', mercadolibre:'Mercado Libre',
    envios:'Envíos', rastreo:'Rastreo', infracciones:'Infracciones', otro:'Otro' };
  return labels[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
}

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── ABRIR MODAL NUEVA / EDITAR ──
function openModalAyuda(id) {
  const modal = document.getElementById('modal-ayuda');
  const ayuda = id ? _ayudas.find(a=>a.id===id) : null;

  document.getElementById('ma-title').textContent    = ayuda ? '✏️ Editar Ayuda' : '📋 Nueva Ayuda';
  document.getElementById('ma-titulo').value         = ayuda?.titulo    || '';
  document.getElementById('ma-contenido').value      = ayuda?.contenido || '';
  document.getElementById('ma-id').value             = ayuda?.id        || '';
  document.getElementById('ma-cat-nueva').value      = '';

  // Categoría select
  const selCat = document.getElementById('ma-categoria');
  const knownCats = Array.from(selCat.options).map(o=>o.value);
  if(ayuda?.categoria && !knownCats.includes(ayuda.categoria)) {
    const opt = new Option(_catLabel(ayuda.categoria), ayuda.categoria);
    selCat.appendChild(opt);
  }
  selCat.value = ayuda?.categoria || 'general';

  // Color actual
  const colorActual = ayuda?.color || '#00897b';
  document.getElementById('ma-color').value = colorActual;
  _renderColorPicker(colorActual);

  modal.classList.add('open');
  setTimeout(() => document.getElementById('ma-titulo').focus(), 120);
}

function _renderColorPicker(selected) {
  const wrap = document.getElementById('ma-colores');
  if(!wrap) return;
  wrap.innerHTML = _AYUDA_COLORES.map(c => `
    <div class="color-circle ${c.hex===selected?'selected':''}"
      style="background:${c.hex};"
      title="${c.label}"
      onclick="_selectColor('${c.hex}',this)"
    ></div>
  `).join('');
}

function _selectColor(hex, el) {
  document.getElementById('ma-color').value = hex;
  document.querySelectorAll('#ma-colores .color-circle').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
}

// ── GUARDAR AYUDA ──
async function guardarAyuda() {
  const titulo    = document.getElementById('ma-titulo').value.trim();
  const contenido = document.getElementById('ma-contenido').value.trim();
  const catNueva  = document.getElementById('ma-cat-nueva').value.trim();
  const catSelect = document.getElementById('ma-categoria').value;
  const categoria = catNueva ? catNueva.toLowerCase().replace(/\s+/g,'-') : catSelect;
  const color     = document.getElementById('ma-color').value || '#00897b';
  const id        = document.getElementById('ma-id').value;

  // Validar
  let error = false;
  if(!titulo) {
    document.getElementById('ma-titulo').classList.add('shake');
    document.getElementById('ma-titulo').style.borderColor = 'var(--red)';
    setTimeout(()=>{
      document.getElementById('ma-titulo').classList.remove('shake');
      document.getElementById('ma-titulo').style.borderColor = '';
    }, 600);
    error = true;
  }
  if(!contenido) {
    document.getElementById('ma-contenido').classList.add('shake');
    document.getElementById('ma-contenido').style.borderColor = 'var(--red)';
    setTimeout(()=>{
      document.getElementById('ma-contenido').classList.remove('shake');
      document.getElementById('ma-contenido').style.borderColor = '';
    }, 600);
    error = true;
  }
  if(error) return;

  // Animación botón guardar
  const btn = document.getElementById('ma-guardar-btn');
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span style="display:inline-block;animation:_spin .5s linear infinite;">↻</span> Guardando...';

  await new Promise(r => setTimeout(r, 380));

  if(id) {
    // Editar
    const idx = _ayudas.findIndex(a=>a.id===id);
    if(idx>=0) _ayudas[idx] = { ..._ayudas[idx], titulo, contenido, categoria, color, tsEdit:Date.now() };
  } else {
    // Nuevo
    _ayudas.unshift({ id:_ayudaId(), titulo, contenido, categoria, color, ts:Date.now() });
  }

  _saveAyudas();
  btn.innerHTML = origText;
  btn.disabled = false;
  closeModal('modal-ayuda');

  // Confirmación elegante
  showConfirmAnim(id ? 'edit' : 'venta', !!id);
  showToast(id ? '✏️ Ayuda actualizada' : '✅ Ayuda guardada', 'success', 2200);

  renderAyudasFiltradas();
}

// ── VER AYUDA (modal detalle) ──
function verAyuda(id) {
  const a = _ayudas.find(x=>x.id===id);
  if(!a) return;
  const color = a.color || '#00897b';

  document.getElementById('mva-titulo').textContent = a.titulo;
  document.getElementById('mva-contenido').textContent = a.contenido;
  document.getElementById('mva-id').value = id;

  const catBadge = document.getElementById('mva-cat-badge');
  catBadge.innerHTML = `<span class="ayuda-cat-chip" style="background:${color}33;color:${color};border-color:${color}55;">
    ${_catLabel(a.categoria)}</span>`;

  // Header color
  document.getElementById('mva-header').style.background =
    `linear-gradient(135deg, ${color}dd 0%, ${color}aa 100%)`;

  // Botón editar
  document.getElementById('mva-edit-btn').onclick = () => {
    closeModal('modal-ver-ayuda');
    setTimeout(()=>openModalAyuda(id), 150);
  };

  // Botón copiar
  const copyBtn = document.getElementById('mva-copy-btn');
  const copyIcon = document.getElementById('mva-copy-icon');
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(a.contenido).then(()=>{
      copyIcon.textContent = '✅';
      copyBtn.style.background = 'var(--green)';
      copyBtn.style.borderColor = '#157347';
      setTimeout(()=>{
        copyIcon.textContent = '📋';
        copyBtn.style.background = '';
        copyBtn.style.borderColor = '';
      }, 1800);
      showToast('📋 Texto copiado al portapapeles', 'success', 2000);
    });
  };

  openModal('modal-ver-ayuda');
}

// ── COPIAR DESDE TARJETA ──
function copiarAyuda(id, btn) {
  const a = _ayudas.find(x=>x.id===id);
  if(!a) return;
  navigator.clipboard.writeText(a.contenido).then(()=>{
    const orig = btn.innerHTML;
    btn.classList.add('copied');
    btn.innerHTML = '✅ Copiado';
    setTimeout(()=>{
      btn.classList.remove('copied');
      btn.innerHTML = orig;
    }, 1800);
    showToast('📋 Mensaje copiado', 'success', 2000);
  });
}

// ── ELIMINAR — modal elegante ──
let _ayudaIdPendienteEliminar = null;

function eliminarAyuda(id) {
  const a = _ayudas.find(x => x.id === id);
  if (!a) return;
  _ayudaIdPendienteEliminar = id;

  // Poblar modal de confirmación
  document.getElementById('mdel-ayuda-nombre').textContent = a.titulo;
  const color = a.color || '#00897b';
  document.getElementById('mdel-ayuda-cat').innerHTML =
    `<span class="ayuda-cat-chip" style="background:${color}22;color:${color};border-color:${color}44;font-size:0.7rem;">
      ${_catLabel(a.categoria)}
    </span>`;

  document.getElementById('modal-delete-ayuda').classList.add('open');
}

function _confirmarEliminarAyuda() {
  if (!_ayudaIdPendienteEliminar) return;
  _ayudas = _ayudas.filter(x => x.id !== _ayudaIdPendienteEliminar);
  _saveAyudas();
  _ayudaIdPendienteEliminar = null;
  closeModal('modal-delete-ayuda');
  showToast('🗑 Ayuda eliminada', 'info', 2000);
  renderAyudasFiltradas();
}

function _cancelarEliminarAyuda() {
  _ayudaIdPendienteEliminar = null;
  closeModal('modal-delete-ayuda');
}