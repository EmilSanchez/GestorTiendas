/* Firebase config, caché y capa DB */

// ═══════════════════════════════════════════════════════
//  MELI MANAGER v3 — JavaScript
//  Diseño Centris · Firebase Firestore · TRM automático
// ═══════════════════════════════════════════════════════

// ┌──────────────────────────────────────────────────────────┐
// │  🔑  REEMPLAZA ESTOS VALORES CON LOS DE TU PROYECTO      │
// │  Firebase Console → Configuración → Tus apps → Web (</>)  │
// └──────────────────────────────────────────────────────────┘
const firebaseConfig = {
  apiKey:            "AIzaSyCv58vFNQSt_yc6w2ulI6k9ETTzvjUFTj0",
  authDomain:        "melimanager-56304.firebaseapp.com",
  projectId:         "melimanager-56304",
  storageBucket:     "melimanager-56304.firebasestorage.app",
  messagingSenderId: "621757629762",
  appId:             "1:621757629762:web:23bc53285b6829e52374db"
};

firebase.initializeApp(firebaseConfig);
const _db = firebase.firestore();

// ═══════════════════════════════════════════════════════
// CAPA DE CACHÉ EN MEMORIA
// Se carga UNA sola vez al inicio. Todas las lecturas
// son instantáneas (memoria). Solo las escrituras van
// a Firestore en segundo plano (fire-and-forget para
// no bloquear la UI).
// ═══════════════════════════════════════════════════════
const _cache = {
  tiendas:     null,
  ventas:      null,
  problemas:   null,
  movimientos: null,
  membresias:  null,
  saldos:      null,
  billeteras:  null,
  envios:      null,
  ajustes:     null,
};

// Carga todas las colecciones en paralelo al iniciar
async function _cargarTodo() {
  const clean = d => JSON.parse(JSON.stringify(d));
  const col = async (nombre) => {
    const snap = await _db.collection(nombre).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  };
  const [t, v, p, m, mem, b, env, sDoc, ajDoc] = await Promise.all([
    col('tiendas'), col('ventas'), col('problemas'),
    col('movimientos'), col('membresias'), col('billeteras'), col('envios'),
    _db.collection('config').doc('saldos').get(),
    _db.collection('config').doc('ajustes').get(),
  ]);
  _cache.tiendas     = t;
  _cache.ventas      = v;
  _cache.problemas   = p;
  _cache.movimientos = m;
  _cache.membresias  = mem;
  _cache.billeteras  = b;
  _cache.envios      = env;
  _cache.saldos      = sDoc.exists ? sDoc.data() : {};
  _cache.ajustes     = ajDoc.exists ? ajDoc.data() : {};
}

// Persiste en Firestore en segundo plano (no bloquea UI)
function _syncCol(nombre, arr) {
  const b = _db.batch();
  arr.forEach(item => b.set(
    _db.collection(nombre).doc(item.id),
    JSON.parse(JSON.stringify(item))
  ));
  b.commit().catch(e => console.warn('Firebase sync error:', e));
}
function _syncDoc(col, id, obj) {
  _db.collection(col).doc(id).set(JSON.parse(JSON.stringify(obj)))
    .catch(e => console.warn('Firebase sync error:', e));
}
function _delDoc(col, id) {
  _db.collection(col).doc(id).delete()
    .catch(e => console.warn('Firebase sync error:', e));
}

// ── Objeto DB — lecturas síncronas desde caché, escrituras async ──
const DB = {
  // Tiendas
  tiendas:      () => Promise.resolve(_cache.tiendas     || []),
  ventas:       () => Promise.resolve(_cache.ventas      || []),
  problemas:    () => Promise.resolve(_cache.problemas   || []),
  movimientos:  () => Promise.resolve(_cache.movimientos || []),
  membresias:   () => Promise.resolve(_cache.membresias  || []),
  billeteras:   () => Promise.resolve(_cache.billeteras  || []),
  saldos:       () => Promise.resolve(_cache.saldos      || {}),

  saveTiendas:  (arr) => { _cache.tiendas     = arr; _syncCol('tiendas', arr); return Promise.resolve(); },
  saveVentas:   (arr) => { _cache.ventas      = arr; _syncCol('ventas', arr);  return Promise.resolve(); },
  saveProblemas:(arr) => { _cache.problemas   = arr; _syncCol('problemas', arr); return Promise.resolve(); },
  saveMovimientos:(arr)=>{ _cache.movimientos = arr; _syncCol('movimientos', arr); return Promise.resolve(); },
  saveMembresias:(arr)=>{ _cache.membresias   = arr; _syncCol('membresias', arr); return Promise.resolve(); },
  saveBilleteras:(arr)=>{ _cache.billeteras   = arr; _syncCol('billeteras', arr); return Promise.resolve(); },
  saveSaldos:   (obj) => { _cache.saldos      = obj; _syncDoc('config','saldos', obj); return Promise.resolve(); },
  saveAjustes:  (obj) => { _cache.ajustes     = obj; _syncDoc('config','ajustes', obj); return Promise.resolve(); },
  ajustes:      () => Promise.resolve(_cache.ajustes || {}),

  upsertTienda: (t) => {
    const a = _cache.tiendas || []; const i = a.findIndex(x=>x.id===t.id);
    i>=0 ? a[i]=t : a.push(t); _cache.tiendas = a;
    _syncDoc('tiendas', t.id, t); return Promise.resolve();
  },
  upsertVenta: (v) => {
    const a = _cache.ventas || []; const i = a.findIndex(x=>x.id===v.id);
    i>=0 ? a[i]=v : a.push(v); _cache.ventas = a;
    _syncDoc('ventas', v.id, v); return Promise.resolve();
  },
  upsertProblema: (p) => {
    const a = _cache.problemas || []; const i = a.findIndex(x=>x.id===p.id);
    i>=0 ? a[i]=p : a.push(p); _cache.problemas = a;
    _syncDoc('problemas', p.id, p); return Promise.resolve();
  },
  upsertMovimiento: (m) => {
    const a = _cache.movimientos || []; const i = a.findIndex(x=>x.id===m.id);
    i>=0 ? a[i]=m : a.push(m); _cache.movimientos = a;
    _syncDoc('movimientos', m.id, m); return Promise.resolve();
  },
  upsertMembresia: (m) => {
    const a = _cache.membresias || []; const i = a.findIndex(x=>x.id===m.id);
    i>=0 ? a[i]=m : a.push(m); _cache.membresias = a;
    _syncDoc('membresias', m.id, m); return Promise.resolve();
  },
  deleteVenta:    (id) => { _cache.ventas      = (_cache.ventas||[]).filter(x=>x.id!==id);      _delDoc('ventas', id);      return Promise.resolve(); },
  deleteProblema: (id) => { _cache.problemas   = (_cache.problemas||[]).filter(x=>x.id!==id);   _delDoc('problemas', id);   return Promise.resolve(); },
  deleteMovimiento:(id)=> { _cache.movimientos = (_cache.movimientos||[]).filter(x=>x.id!==id); _delDoc('movimientos', id); return Promise.resolve(); },

  // Envíos
  envios:       () => Promise.resolve(_cache.envios || []),
  saveEnvios:   (arr) => { _cache.envios = arr; _syncCol('envios', arr); return Promise.resolve(); },
  upsertEnvio:  (e) => {
    const a = _cache.envios || []; const i = a.findIndex(x=>x.id===e.id);
    i>=0 ? a[i]=e : a.push(e); _cache.envios = a;
    _syncDoc('envios', e.id, e); return Promise.resolve();
  },
  deleteEnvio:  (id) => { _cache.envios = (_cache.envios||[]).filter(x=>x.id!==id); _delDoc('envios', id); return Promise.resolve(); },
};
