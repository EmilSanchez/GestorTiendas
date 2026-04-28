/* Firebase config — Sistema multiusuario sin Firebase Auth */

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

// ══════════════════════════════════════════════════════════
// USUARIO ACTUAL
// Se setea en app-init.js tras el login.
// Admin  → usa colecciones en la RAÍZ (compatibilidad total)
// Otros  → usan colecciones bajo usuarios/{uid}/
// ══════════════════════════════════════════════════════════
let _currentUser = null; // objeto {uid, usuario, rol, ...}

function _isAdmin() { return _currentUser?.rol === 'admin'; }

function _col(nombre) {
  return _isAdmin()
    ? _db.collection(nombre)
    : _db.collection(`usuarios/${_currentUser.uid}/${nombre}`);
}
function _doc(col, id) {
  return _isAdmin()
    ? _db.collection(col).doc(id)
    : _db.collection(`usuarios/${_currentUser.uid}/${col}`).doc(id);
}
function _cfg(docId) {
  return _isAdmin()
    ? _db.collection('config').doc(docId)
    : _db.collection(`usuarios/${_currentUser.uid}/config`).doc(docId);
}

// ══ CACHÉ ══
const _cache = {
  tiendas:null, ventas:null, problemas:null, movimientos:null,
  membresias:null, billeteras:null, envios:null, envios_sky:null,
  saldos:null, ajustes:null,
};

async function _fetchCol(nombre) {
  const snap = await _col(nombre).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function _cargarTodo() {
  const [t,v,p,m,mem,b,env,esky,sDoc,ajDoc] = await Promise.all([
    _fetchCol('tiendas'), _fetchCol('ventas'), _fetchCol('problemas'),
    _fetchCol('movimientos'), _fetchCol('membresias'), _fetchCol('billeteras'),
    _fetchCol('envios'), _fetchCol('envios_sky'),
    _cfg('saldos').get(), _cfg('ajustes').get(),
  ]);
  _cache.tiendas     = t;
  _cache.ventas      = v;
  _cache.problemas   = p;
  _cache.movimientos = m;
  _cache.membresias  = mem;
  _cache.billeteras  = b;
  _cache.envios      = env;
  _cache.envios_sky  = esky;
  _cache.saldos      = sDoc.exists  ? sDoc.data()  : {};
  _cache.ajustes     = ajDoc.exists ? ajDoc.data() : {};
}

// ══ Sync helpers ══
function _syncCol(nombre, arr) {
  const b = _db.batch();
  arr.forEach(item => b.set(_doc(nombre, item.id), JSON.parse(JSON.stringify(item))));
  b.commit().catch(e => console.warn('Firebase sync error:', e));
}
function _syncDoc(colNombre, id, obj) {
  _doc(colNombre, id).set(JSON.parse(JSON.stringify(obj))).catch(e => console.warn(e));
}
function _syncCfg(docId, obj) {
  _cfg(docId).set(JSON.parse(JSON.stringify(obj))).catch(e => console.warn(e));
}
function _delDoc(colNombre, id) {
  _doc(colNombre, id).delete().catch(e => console.warn(e));
}

// ══ Auth doc por usuario ══
function _getAuthDoc() {
  return _cfg('auth').get();
}
function _setAuthHash(hash) {
  return _cfg('auth').set({ hash });
}

// ══════════════════════════════════════════════════════════
// DB — API pública
// ══════════════════════════════════════════════════════════
const DB = {
  tiendas:      () => Promise.resolve(_cache.tiendas     || []),
  ventas:       () => Promise.resolve(_cache.ventas      || []),
  problemas:    () => Promise.resolve(_cache.problemas   || []),
  movimientos:  () => Promise.resolve(_cache.movimientos || []),
  membresias:   () => Promise.resolve(_cache.membresias  || []),
  billeteras:   () => Promise.resolve(_cache.billeteras  || []),
  saldos:       () => Promise.resolve(_cache.saldos      || {}),
  ajustes:      () => Promise.resolve(_cache.ajustes     || {}),

  saveTiendas:     (arr) => { _cache.tiendas     = arr; _syncCol('tiendas',arr);     return Promise.resolve(); },
  saveVentas:      (arr) => { _cache.ventas      = arr; _syncCol('ventas',arr);      return Promise.resolve(); },
  saveProblemas:   (arr) => { _cache.problemas   = arr; _syncCol('problemas',arr);   return Promise.resolve(); },
  saveMovimientos: (arr) => { _cache.movimientos = arr; _syncCol('movimientos',arr); return Promise.resolve(); },
  saveMembresias:  (arr) => { _cache.membresias  = arr; _syncCol('membresias',arr);  return Promise.resolve(); },
  saveBilleteras:  (arr) => { _cache.billeteras  = arr; _syncCol('billeteras',arr);  return Promise.resolve(); },
  deleteBilletera: (id)  => { _cache.billeteras  = (_cache.billeteras||[]).filter(x=>x.id!==id); _delDoc('billeteras',id); return Promise.resolve(); },
  saveSaldos:      (obj) => { _cache.saldos      = obj; _syncCfg('saldos',obj);      return Promise.resolve(); },
  saveAjustes:     (obj) => { _cache.ajustes     = obj; _syncCfg('ajustes',obj);     return Promise.resolve(); },

  upsertTienda:    (t) => { const a=_cache.tiendas||[];    const i=a.findIndex(x=>x.id===t.id); i>=0?a[i]=t:a.push(t); _cache.tiendas=a;    _syncDoc('tiendas',t.id,t);    return Promise.resolve(); },
  upsertVenta:     (v) => { const a=_cache.ventas||[];     const i=a.findIndex(x=>x.id===v.id); i>=0?a[i]=v:a.push(v); _cache.ventas=a;     _syncDoc('ventas',v.id,v);     return Promise.resolve(); },
  upsertProblema:  (p) => { const a=_cache.problemas||[];  const i=a.findIndex(x=>x.id===p.id); i>=0?a[i]=p:a.push(p); _cache.problemas=a;  _syncDoc('problemas',p.id,p);  return Promise.resolve(); },
  upsertMovimiento:(m) => { const a=_cache.movimientos||[];const i=a.findIndex(x=>x.id===m.id); i>=0?a[i]=m:a.push(m); _cache.movimientos=a;_syncDoc('movimientos',m.id,m); return Promise.resolve(); },
  upsertMembresia: (m) => { const a=_cache.membresias||[]; const i=a.findIndex(x=>x.id===m.id); i>=0?a[i]=m:a.push(m); _cache.membresias=a; _syncDoc('membresias',m.id,m); return Promise.resolve(); },

  deleteVenta:      (id) => { _cache.ventas      = (_cache.ventas     ||[]).filter(x=>x.id!==id); _delDoc('ventas',id);      return Promise.resolve(); },
  deleteProblema:   (id) => { _cache.problemas   = (_cache.problemas  ||[]).filter(x=>x.id!==id); _delDoc('problemas',id);   return Promise.resolve(); },
  deleteMovimiento: (id) => { _cache.movimientos = (_cache.movimientos||[]).filter(x=>x.id!==id); _delDoc('movimientos',id); return Promise.resolve(); },

  envios:       () => Promise.resolve(_cache.envios || []),
  saveEnvios:   (arr) => { _cache.envios=arr; _syncCol('envios',arr); return Promise.resolve(); },
  upsertEnvio:  (e)   => { const a=_cache.envios||[];const i=a.findIndex(x=>x.id===e.id);i>=0?a[i]=e:a.push(e);_cache.envios=a;_syncDoc('envios',e.id,e); return Promise.resolve(); },
  deleteEnvio:  (id)  => { _cache.envios=(_cache.envios||[]).filter(x=>x.id!==id);_delDoc('envios',id); return Promise.resolve(); },

  envios_sky:     () => Promise.resolve(_cache.envios_sky || []),
  upsertEnvioSky: (e)  => { const a=_cache.envios_sky||[];const i=a.findIndex(x=>x.id===e.id);i>=0?a[i]=e:a.push(e);_cache.envios_sky=a;_syncDoc('envios_sky',e.id,e); return Promise.resolve(); },
  deleteEnvioSky: (id) => { _cache.envios_sky=(_cache.envios_sky||[]).filter(x=>x.id!==id);_delDoc('envios_sky',id); return Promise.resolve(); },

  // ── Gestión de usuarios (solo admin) ──
  getUsuarios: () => _db.collection('usuarios').get().then(snap =>
    snap.docs.map(d => ({ uid: d.id, ...d.data() }))
  ),
  crearUsuario: async (data) => {
    // data: { uid, usuario, nombre, rol, activo }
    await _db.collection('usuarios').doc(data.uid).set({ ...data, creado: new Date().toISOString() });
    // Crear código de acceso en su config
    await _db.collection(`usuarios/${data.uid}/config`).doc('auth').set({ hash: data.hash });
  },
  toggleUsuario: async (uid, activo) => {
    await _db.collection('usuarios').doc(uid).update({ activo });
  },
  deleteUsuario: async (uid) => {
    await _db.collection('usuarios').doc(uid).delete();
  },
};