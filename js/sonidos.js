/* Sonidos de la interfaz — sintetizados con Web Audio (sin archivos externos).
 *
 * Cada acción tiene su propio sonido, limpio y suave, pensado para que "diga"
 * lo que pasó:
 *   registrar   → tres notas que suben (algo nuevo se agregó)
 *   guardar     → dos notas cortas que suben (cambios guardados)
 *   editar      → un toque suave (se ajustó algo existente)
 *   validar     → "tic" + nota firme (verificado / aprobado)
 *   eliminar    → dos notas que bajan, opacas (algo se quitó)
 *   salir       → tres notas que bajan despacio (despedida)
 *   dolar       → destello metálico tipo moneda (un valor se actualizó)
 *   resolver    → arpegio mayor que se abre (algo quedó solucionado)
 *   ayuda       → burbuja que sube (nueva nota/ayuda)
 *   transferir  → deslizamiento de un tono a otro (valor pasa de un mes a otro)
 *   cerrarMes   → golpe grave tipo "candado" + campanita (mes cerrado)
 *   viaje       → soplido suave (el problema viaja hacia el menú)
 *   entrada     → "pling" de dos notas (el problema entra a Pendientes)
 *   filtro      → clic muy corto (se eligió un filtro)
 *   barajar     → roce suave (las tarjetas se reacomodan)
 *
 * Se respeta el audio del navegador: el contexto se crea/activa con el primer
 * gesto del usuario (clic o tecla). Si el navegador no permite audio, no suena.
 */
const Sonido = (() => {
  let ctx = null;
  const VOL = 0.18; // volumen general discreto

  function preparar() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = ctx || new AC();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
    return ctx;
  }
  // Activar el audio con el primer gesto (política de autoplay de los navegadores)
  ['pointerdown', 'keydown'].forEach(ev =>
    window.addEventListener(ev, preparar, { capture: true, passive: true }));

  function listo() { return ctx && ctx.state === 'running' ? ctx : null; }

  function salida(vol) {
    const g = ctx.createGain();
    g.gain.value = VOL * (vol ?? 1);
    g.connect(ctx.destination);
    return g;
  }

  // Nota con ataque rápido y caída suave. glide: frecuencia final (opcional)
  function nota(dest, freq, t, dur, { tipo = 'sine', pico = 1, glide, ataque = 0.012 } = {}) {
    const o = ctx.createOscillator(), e = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur * 0.9);
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(pico, t + ataque);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(e).connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // Ruido filtrado con barrido (soplidos / roces)
  function soplido(dest, t, dur, { desde = 500, hasta = 2200, q = 0.9, pico = 0.6 } = {}) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(desde, t);
    f.frequency.exponentialRampToValueAtTime(hasta, t + dur);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(pico, t + dur * 0.45);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(e).connect(dest);
    src.start(t); src.stop(t + dur + 0.02);
  }

  // Notas (Hz)
  const N = { A4: 440, C5: 523.25, E5: 659.25, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5,
              D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760, B6: 1975.53, E7: 2637.02 };

  const SONIDOS = {
    registrar(t, o) { [N.C6, N.E6, N.G6].forEach((f, i) => nota(o, f, t + i * 0.07, 0.34)); },
    guardar(t, o)   { nota(o, N.G5, t, 0.22); nota(o, N.C6, t + 0.07, 0.32); },
    editar(t, o)    { nota(o, N.A5, t, 0.2, { pico: .8 }); nota(o, N.D6, t + 0.05, 0.24, { pico: .55 }); },
    validar(t, o)   { nota(o, 3200, t, 0.04, { tipo: 'triangle', pico: .35, ataque: .003 });
                      nota(o, N.E6, t + 0.04, 0.36); nota(o, N.B6, t + 0.04, 0.3, { pico: .25 }); },
    eliminar(t, o)  { nota(o, N.E5, t, 0.22, { tipo: 'triangle', pico: .7 });
                      nota(o, N.A4, t + 0.09, 0.32, { tipo: 'triangle', pico: .7, glide: 392 }); },
    salir(t, o)     { [N.G5, N.E5, N.C5].forEach((f, i) => nota(o, f, t + i * 0.12, 0.42, { pico: .8 })); },
    dolar(t, o)     { nota(o, N.B6, t, 0.16, { tipo: 'triangle', pico: .6 }); nota(o, N.E7, t + 0.06, 0.4, { pico: .55 }); },
    resolver(t, o)  { [N.C6, N.E6, N.G6].forEach((f, i) => nota(o, f, t + i * 0.055, 0.5, { pico: .85 }));
                      nota(o, 2093, t + 0.18, 0.55, { pico: .4 }); },
    ayuda(t, o)     { nota(o, 600, t, 0.18, { glide: 1400, pico: .8 }); nota(o, N.E6, t + 0.12, 0.26, { pico: .5 }); },
    transferir(t, o){ nota(o, N.C5, t, 0.5, { glide: N.C6, pico: .7 }); nota(o, N.G6, t + 0.38, 0.3, { pico: .45 }); },
    cerrarMes(t, o) { nota(o, 196, t, 0.22, { tipo: 'triangle', pico: .9, glide: 150 });
                      soplido(o, t, 0.06, { desde: 1800, hasta: 900, q: 2, pico: .5 });
                      nota(o, N.E6, t + 0.16, 0.5, { pico: .6 }); nota(o, N.B6, t + 0.24, 0.5, { pico: .35 }); },
    viaje(t, o)     { soplido(o, t, 0.78, { desde: 380, hasta: 2600, q: 0.7, pico: .55 }); },
    entrada(t, o)   { nota(o, N.E6, t, 0.32); nota(o, N.B6, t + 0.075, 0.42); },
    filtro(t, o)    { nota(o, 2400, t, 0.05, { tipo: 'triangle', pico: .45, ataque: .002 }); },
    barajar(t, o)   { soplido(o, t, 0.34, { desde: 900, hasta: 3200, q: 1.1, pico: .35 }); },
  };
  // Volumen relativo por sonido (los roces/soplidos van más bajos)
  const VOLUMEN = { viaje: .7, barajar: .55, filtro: .6, eliminar: .9 };

  function play(nombre) {
    const c = listo() || preparar();
    if (!c || c.state !== 'running' || !SONIDOS[nombre]) return;
    try { SONIDOS[nombre](c.currentTime + 0.005, salida(VOLUMEN[nombre])); } catch (e) {}
  }

  return { play, preparar };
})();
