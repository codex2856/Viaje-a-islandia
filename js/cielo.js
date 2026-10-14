/* =====================================================================
   cielo.js · Aurora boreal, estrellas que parpadean y nieve
   ---------------------------------------------------------------------
   Antes la aurora eran capas CSS animadas. Problema: cualquier animación
   CSS infinita obliga al navegador a redibujar la pantalla 60 veces por
   segundo, y eso disparaba el uso de CPU. Ahora TODO el cielo animado se
   dibuja en dos <canvas> con un único bucle limitado a ~24 fotogramas/s:

   - Aurora: se pinta en un canvas DIMINUTO (240×120 px) que CSS estira a
     toda la pantalla. Al ampliarlo, el navegador lo suaviza solo: así
     conseguimos el desenfoque típico de la aurora sin usar filter: blur().
   - Nieve y estrellas: en un canvas a densidad 1 (máx. 70 copos).

   Ahorro de energía:
   - Se pausa si la pestaña está oculta o si el cielo no se ve en pantalla.
   - Con "reducir movimiento" se dibuja un único fotograma quieto, sin nieve.
   ===================================================================== */

const FPS = 20; // la nieve cae despacio: 20 fotogramas/s se ven fluidos
const INTERVALO = 1000 / FPS;
const movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------------------
   Aurora
   Cada banda es una "cortina": una fila de franjas verticales finas cuya
   altura y brillo ondulan con funciones seno que cambian con el tiempo.
   --------------------------------------------------------------------- */
const ANCHO_AURORA = 240;
const ALTO_AURORA = 120;

const BANDAS = [
  // color RGB · altura base (0-1) · amplitud de la onda · frecuencia · velocidad · alto de la cortina · brillo
  { rgb: [92, 255, 177], y: 0.20, amp: 0.10, frec: 1.6, vel: 0.11, alto: 0.42, brillo: 0.55, fase: 0 },
  { rgb: [127, 209, 232], y: 0.30, amp: 0.08, frec: 2.3, vel: -0.08, alto: 0.32, brillo: 0.32, fase: 2.1 },
  { rgb: [138, 107, 255], y: 0.12, amp: 0.07, frec: 1.2, vel: 0.06, alto: 0.38, brillo: 0.38, fase: 4.2 },
];

/** Franja vertical con degradado: transparente arriba, brillante abajo. Se reutiliza en cada fotograma. */
function crearFranja([r, g, b]) {
  const franja = document.createElement('canvas');
  franja.width = 1;
  franja.height = 64;
  const c = franja.getContext('2d');
  const d = c.createLinearGradient(0, 0, 0, 64);
  d.addColorStop(0, `rgba(${r},${g},${b},0)`);
  d.addColorStop(0.65, `rgba(${r},${g},${b},0.35)`);
  d.addColorStop(0.9, `rgba(${r},${g},${b},1)`);
  d.addColorStop(1, `rgba(${r},${g},${b},0)`);
  c.fillStyle = d;
  c.fillRect(0, 0, 1, 64);
  return franja;
}

function crearAurora(canvas) {
  canvas.width = ANCHO_AURORA;
  canvas.height = ALTO_AURORA;
  const ctx = canvas.getContext('2d');
  const franjas = BANDAS.map((b) => crearFranja(b.rgb));

  return function dibujar(t) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, ANCHO_AURORA, ALTO_AURORA);
    ctx.globalCompositeOperation = 'lighter'; // las luces se suman, como en una aurora real

    BANDAS.forEach((b, i) => {
      const altoCortina = b.alto * ALTO_AURORA;
      for (let x = 0; x < ANCHO_AURORA; x += 2) {
        const u = x / ANCHO_AURORA; // posición horizontal de 0 a 1
        // Ondulación principal + una más fina que hace "temblar" la cortina
        const onda = Math.sin(u * b.frec * Math.PI * 2 + t * b.vel + b.fase)
          + 0.35 * Math.sin(u * 9 + t * b.vel * 3.1 + b.fase);
        const arriba = (b.y + b.amp * onda) * ALTO_AURORA;
        // Brillo que viaja a lo largo de la banda + desvanecido en los extremos
        const pulso = 0.5 + 0.5 * Math.sin(u * 5.3 - t * b.vel * 2.4 + b.fase * 1.7);
        const bordes = Math.sin(Math.PI * u);
        ctx.globalAlpha = b.brillo * pulso * pulso * bordes;
        ctx.drawImage(franjas[i], x, arriba, 2, altoCortina); // ancho = paso: sin solapes (evita rayas)
      }
    });
    ctx.globalAlpha = 1;
  };
}

/* ---------------------------------------------------------------------
   Nieve + estrellas que parpadean
   --------------------------------------------------------------------- */
function crearNieve(canvas) {
  const ctx = canvas.getContext('2d');
  let copos = [];
  let estrellas = [];
  let ancho = 0;
  let alto = 0;

  function nuevoCopo(enCualquierAltura) {
    const profundidad = Math.random(); // 0 = lejos, 1 = cerca
    return {
      x: Math.random() * ancho,
      y: enCualquierAltura ? Math.random() * alto : -10,
      r: 0.6 + profundidad * 2.2,
      vy: 18 + profundidad * 42,           // píxeles por segundo
      deriva: Math.random() * Math.PI * 2, // fase del balanceo lateral
      alfa: 0.25 + profundidad * 0.6,
    };
  }

  function redimensionar() {
    // Densidad de píxeles 1: en pantallas retina los copos se ven igual de bien
    // y el canvas tiene 4 veces menos píxeles que mover.
    const dpr = 1;
    ancho = canvas.clientWidth;
    alto = canvas.clientHeight;
    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // ~1 copo por cada 18000 px², máximo 70 (suficiente para el efecto)
    copos = Array.from({ length: Math.min(70, Math.round((ancho * alto) / 18000)) }, () => nuevoCopo(true));
    // Unas pocas estrellas brillantes que parpadean (las pequeñas son CSS estático)
    estrellas = Array.from({ length: 22 }, () => ({
      x: Math.random() * ancho,
      y: Math.random() * alto * 0.45,
      r: 0.7 + Math.random() * 0.9,
      vel: 0.6 + Math.random() * 1.6,
      fase: Math.random() * Math.PI * 2,
    }));
  }

  function dibujar(t, dt, conNieve) {
    ctx.clearRect(0, 0, ancho, alto);
    ctx.fillStyle = '#f4fbff';

    for (const e of estrellas) {
      ctx.globalAlpha = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * e.vel + e.fase));
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (conNieve) {
      for (const c of copos) {
        c.deriva += dt * 0.8;
        c.y += c.vy * dt;
        c.x += Math.sin(c.deriva) * 12 * dt + 6 * dt; // viento suave hacia la derecha
        if (c.y > alto + 10) Object.assign(c, nuevoCopo(false));
        if (c.x > ancho + 10) c.x = -10;
        ctx.globalAlpha = c.alfa;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  return { redimensionar, dibujar, ancho: () => ancho, alto: () => alto, elemento: canvas };
}

/* ---------------------------------------------------------------------
   Bucle único para los dos canvas
   --------------------------------------------------------------------- */
export function iniciarCielo({ aurora: canvasAurora, nieve: canvasNieve, zona }) {
  const dibujarAurora = canvasAurora ? crearAurora(canvasAurora) : null;
  const nieve = canvasNieve ? crearNieve(canvasNieve) : null;
  nieve?.redimensionar();

  // Con movimiento reducido: un único fotograma quieto (aurora y estrellas, sin nieve)
  if (movimientoReducido) {
    dibujarAurora?.(3);
    nieve?.dibujar(3, 0, false);
    canvasAurora?.classList.add('aurora-canvas--lista');
    return;
  }

  let visible = true;
  let animando = false;
  let ultimo = performance.now();
  let temporizador = 0;
  let cuenta = 0;
  const inicio = performance.now();

  // Importante: NO encadenamos requestAnimationFrame en cada fotograma de pantalla
  // (60 veces/s), porque solo con "despertarse" el navegador ya trabaja 60 veces
  // por segundo. Esperamos con setTimeout y pedimos un único fotograma cada vez.
  function programar() {
    temporizador = setTimeout(() => requestAnimationFrame(fotograma), INTERVALO);
  }

  function fotograma(ahora) {
    if (!animando) return;
    const dt = Math.min((ahora - ultimo) / 1000, 0.1);
    ultimo = ahora;
    const t = (ahora - inicio) / 1000; // segundos desde el inicio
    // La aurora se mueve muy despacio: basta con redibujarla 1 de cada 2 fotogramas
    if (++cuenta % 2 === 0) dibujarAurora?.(t);
    nieve?.dibujar(t, dt, true);
    programar();
  }

  function actualizarEstado() {
    const debeAnimar = visible && document.visibilityState === 'visible';
    if (debeAnimar && !animando) {
      animando = true;
      ultimo = performance.now();
      programar();
    } else if (!debeAnimar && animando) {
      animando = false;
      clearTimeout(temporizador);
    }
  }

  // Solo animamos si se ve al menos un 15 % del cielo (no por una franja en el borde)
  new IntersectionObserver(([e]) => { visible = e.intersectionRatio >= 0.15; actualizarEstado(); },
    { threshold: [0, 0.15, 0.3] })
    .observe(zona || canvasNieve || canvasAurora);
  document.addEventListener('visibilitychange', actualizarEstado);

  let temporizadorResize;
  addEventListener('resize', () => {
    clearTimeout(temporizadorResize);
    // En móvil la barra del navegador cambia la altura al hacer scroll:
    // solo recalculamos si cambia el ANCHO o la altura de forma notable.
    temporizadorResize = setTimeout(() => {
      if (nieve && (canvasNieve.clientWidth !== nieve.ancho() || Math.abs(canvasNieve.clientHeight - nieve.alto()) > 150)) {
        nieve.redimensionar();
      }
    }, 200);
  });

  dibujarAurora?.(0);
  canvasAurora?.classList.add('aurora-canvas--lista'); // aparece con un fundido (CSS)
  actualizarEstado();
}
