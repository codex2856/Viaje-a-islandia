/* =====================================================================
   mapa-ilustrado.js · Mapa dibujado de Islandia, interactivo
   ---------------------------------------------------------------------
   La imagen es una ilustración (no un mapa real), así que convertimos
   las coordenadas reales (lat, lng) de la ruta y de las paradas en
   píxeles de la imagen con una transformación lineal calculada a partir
   de puntos de referencia del dibujo (ver "mapa_ilustrado" en
   datos-viaje.json):   x = a·lng + b·lat + c     y = d·lng + e·lat + f

   Todo va dentro de un único <svg>: la imagen de fondo, la ruta y los
   marcadores. Para "acercarnos" a la ruta solo cambiamos el viewBox
   (la parte de la imagen que se ve), así todo se mueve junto.
   ===================================================================== */

import { escaparHTML, formatearFecha } from './datos.js';
import { COLOR_DIA } from './mapa.js';

const SVG = 'http://www.w3.org/2000/svg';
const movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Crea un elemento SVG con atributos. */
function nodo(etiqueta, atributos = {}) {
  const el = document.createElementNS(SVG, etiqueta);
  for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, v);
  return el;
}

/** Devuelve una función (lat, lng) → [x, y] en píxeles de la imagen. */
function crearProyeccion({ x, y }) {
  return (lat, lng) => [x[0] * lng + x[1] * lat + x[2], y[0] * lng + y[1] * lat + y[2]];
}

/** Rectángulo que encierra unos puntos, con margen. */
function caja(puntos, margen) {
  const xs = puntos.map((p) => p[0]);
  const ys = puntos.map((p) => p[1]);
  const x0 = Math.min(...xs) - margen;
  const y0 = Math.min(...ys) - margen;
  return { x: x0, y: y0, w: Math.max(...xs) + margen - x0, h: Math.max(...ys) + margen - y0 };
}

/**
 * Ajusta una caja a la proporción del contenedor (para que no se deforme)
 * y la mueve para que no se salga de la imagen (si no, se vería su borde).
 */
function ajustarProporcion(c, proporcion, limite) {
  let { x, y, w, h } = c;
  if (w / h > proporcion) { const nh = w / proporcion; y -= (nh - h) / 2; h = nh; }
  else { const nw = h * proporcion; x -= (nw - w) / 2; w = nw; }
  if (limite) {
    // Si la vista es más grande que la imagen, la reducimos manteniendo la proporción
    const escala = Math.min(1, limite.ancho / w, limite.alto / h);
    if (escala < 1) { x += (w - w * escala) / 2; y += (h - h * escala) / 2; w *= escala; h *= escala; }
    x = Math.min(Math.max(x, 0), limite.ancho - w);
    y = Math.min(Math.max(y, 0), limite.alto - h);
  }
  return { x, y, w, h };
}

const suavizar = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * @param {HTMLElement} elemento contenedor
 * @param {Array} entradas  las 5 entradas (con sus paradas)
 * @param {object} datos    datos-viaje.json
 * @param {object} opciones { mini: true } → versión pequeña sin interacción (pie de página)
 */
export function crearMapaIlustrado(elemento, entradas, datos, { mini = false } = {}) {
  const config = datos.mapa_ilustrado;
  if (!config) throw new Error('Falta "mapa_ilustrado" en datos-viaje.json');
  const proyectar = crearProyeccion(config.transformacion);
  const { ancho, alto } = config;

  // --- Puntos en píxeles de la imagen ---
  const ruta = (datos.ruta?.puntos || []).map(([lat, lng]) => proyectar(lat, lng));
  const paradas = entradas.flatMap((e) => e.paradas.map((p, i) => ({
    dia: e.numero, entrada: e, parada: p, orden: i, xy: proyectar(p.lat, p.lng),
  })));

  // --- Estructura ---
  elemento.innerHTML = '';
  elemento.classList.add('mapa-ilustrado');
  const svg = nodo('svg', {
    class: 'mapa-ilustrado__svg',
    viewBox: `0 0 ${ancho} ${alto}`,
    preserveAspectRatio: 'xMidYMid slice',
    role: mini ? 'img' : 'group',
    'aria-label': 'Mapa ilustrado de Islandia con la ruta del viaje',
  });
  svg.append(nodo('rect', { x: -2000, y: -2000, width: ancho + 4000, height: alto + 4000, fill: '#0b0f14' }));
  // Primero la imagen ligera; la de alta definición (3×) se carga al ir a hacer zoom
  const imagen = nodo('image', { href: config.imagen_webp || config.imagen, x: 0, y: 0, width: ancho, height: alto, preserveAspectRatio: 'none' });
  svg.append(imagen);
  const cargarHD = () => {
    if (!config.imagen_hd || mini) return;
    const hd = new Image();
    hd.onload = () => imagen.setAttribute('href', config.imagen_hd);
    hd.src = config.imagen_hd;
  };

  // Ruta: un halo ancho y difuso + la línea principal
  const d = ruta.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  // El grosor de las líneas se ajusta al zoom con la variable CSS --u (ver ponerVista)
  const halo = nodo('path', { d, class: 'mi-ruta mi-ruta--halo' });
  const linea = nodo('path', { d, class: 'mi-ruta' });
  svg.append(halo, linea);

  // Tramos de cada día (se iluminan al elegir un día)
  const capaTramos = nodo('g', { class: 'mi-tramos' });
  for (const e of entradas) {
    if (e.paradas.length < 2) continue;
    const pts = e.paradas.map((p) => proyectar(p.lat, p.lng));
    capaTramos.append(nodo('polyline', {
      points: pts.map((p) => p.join(',')).join(' '),
      class: 'mi-tramo', 'data-dia': e.numero, style: `--color:${COLOR_DIA[e.numero]}`,
    }));
  }
  svg.append(capaTramos);

  // Marcadores
  const capaMarcadores = nodo('g', { class: 'mi-marcadores' });
  paradas.forEach((p, i) => {
    const g = nodo('g', {
      class: `mi-marcador ${p.parada.confirmada === false ? 'mi-marcador--pendiente' : ''}`,
      transform: `translate(${p.xy[0].toFixed(1)} ${p.xy[1].toFixed(1)})`,
      'data-dia': p.dia,
      style: `--color:${COLOR_DIA[p.dia]}; --retraso:${(i * 0.12).toFixed(2)}s`,
    });
    if (!mini) {
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', `Día ${p.dia}: ${p.parada.nombre}${p.parada.confirmada === false ? ' (por confirmar)' : ''}`);
    }
    // El icono va en un grupo aparte que se re-escala con el zoom: así el punto
    // mide siempre lo mismo en pantalla (medidas de abajo en píxeles)
    const icono = nodo('g', { class: 'mi-marcador__icono' });
    icono.append(nodo('circle', { r: 15, class: 'mi-marcador__pulso' }));
    icono.append(nodo('circle', { r: mini ? 4 : 7, class: 'mi-marcador__nucleo' }));
    // Área táctil invisible más grande (el dedo necesita ~44 px)
    if (!mini) icono.append(nodo('circle', { r: 22, class: 'mi-marcador__toque' }));
    // Nombre del sitio (solo se ve al elegir un día). Si otra parada del mismo día
    // está casi en el mismo punto, no lo ponemos para que no se pisen.
    const pegada = paradas.slice(0, i).some((q) => q.dia === p.dia && Math.hypot(q.xy[0] - p.xy[0], q.xy[1] - p.xy[1]) < 8);
    if (!mini && !pegada) {
      const texto = nodo('text', { x: 13, y: 4, class: 'mi-marcador__nombre' });
      texto.textContent = p.parada.nombre;
      icono.append(texto);
    }
    g.append(icono);
    g._datos = p;
    capaMarcadores.append(g);
  });
  svg.append(capaMarcadores);
  elemento.append(svg);

  // --- Vistas: isla entera y zoom a la ruta ---
  const vistaIsla = { x: 0, y: 0, w: ancho, h: alto };
  const cajaRuta = caja([...ruta, ...paradas.map((p) => p.xy)], mini ? 22 : 60);
  const proporcion = () => elemento.clientWidth / Math.max(1, elemento.clientHeight);
  const vistaRuta = () => ajustarProporcion(cajaRuta, proporcion(), { ancho, alto });
  let vistaActual = vistaIsla;
  const iconos = [...capaMarcadores.querySelectorAll('.mi-marcador__icono')];
  const ponerVista = (v) => {
    vistaActual = v;
    svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
    // Unidades de la imagen por cada píxel de pantalla (con "slice" manda la mayor escala)
    const unidadesPorPx = Math.min(v.w / Math.max(1, elemento.clientWidth), v.h / Math.max(1, elemento.clientHeight));
    for (const icono of iconos) icono.setAttribute('transform', `scale(${unidadesPorPx.toFixed(4)})`);
    svg.style.setProperty('--u', unidadesPorPx.toFixed(4)); // CSS: stroke-width: calc(3px * var(--u))
  };

  function animarVista(destino, duracion = 1800) {
    if (movimientoReducido) return ponerVista(destino);
    const inicio = { ...vistaActual };
    const t0 = performance.now();
    return new Promise((resolver) => {
      (function paso(ahora) {
        const t = Math.min(1, (ahora - t0) / duracion);
        const k = suavizar(t);
        ponerVista({
          x: inicio.x + (destino.x - inicio.x) * k, y: inicio.y + (destino.y - inicio.y) * k,
          w: inicio.w + (destino.w - inicio.w) * k, h: inicio.h + (destino.h - inicio.h) * k,
        });
        if (t < 1) requestAnimationFrame(paso); else resolver();
      })(t0);
    });
  }

  ponerVista(vistaIsla);

  // Ruta oculta al principio (efecto trazo que avanza)
  const largo = linea.getTotalLength();
  for (const camino of [linea, halo]) {
    camino.style.strokeDasharray = `${largo} ${largo}`;
    camino.style.strokeDashoffset = mini || movimientoReducido ? 0 : largo;
  }

  if (mini) {
    ponerVista(vistaRuta());
    elemento.classList.add('mapa-ilustrado--listo');
    return;
  }

  // --- Interacción: tarjeta al tocar un marcador ---
  const tarjeta = document.createElement('div');
  tarjeta.className = 'mi-tarjeta';
  tarjeta.hidden = true;
  elemento.append(tarjeta);
  let marcadorActivo = null;

  function abrirTarjeta(g) {
    const { entrada, parada } = g._datos;
    marcadorActivo?.classList.remove('mi-marcador--activo');
    marcadorActivo = g;
    g.classList.add('mi-marcador--activo');
    tarjeta.style.setProperty('--color', COLOR_DIA[entrada.numero]);
    tarjeta.innerHTML = `
      <button type="button" class="mi-tarjeta__cerrar" aria-label="Cerrar">✕</button>
      <p class="tarjeta-mapa__dia">Día ${entrada.numero} · ${escaparHTML(formatearFecha(entrada.fecha, { day: 'numeric', month: 'long' }))}</p>
      <h3 class="tarjeta-mapa__titulo">${escaparHTML(parada.nombre)}</h3>
      ${parada.confirmada === false ? '<p class="tarjeta-mapa__nota">Parada por confirmar</p>' : ''}
      <a class="tarjeta-mapa__enlace" href="diario.html#dia-${entrada.numero}">Leer en el diario <span aria-hidden="true">→</span></a>`;
    tarjeta.hidden = false;
    colocarTarjeta();
    tarjeta.querySelector('.mi-tarjeta__cerrar').addEventListener('click', cerrarTarjeta);
  }
  function cerrarTarjeta() {
    tarjeta.hidden = true;
    marcadorActivo?.classList.remove('mi-marcador--activo');
    marcadorActivo?.focus?.();
    marcadorActivo = null;
  }
  // Coloca la tarjeta encima del marcador, sin salirse del mapa
  function colocarTarjeta() {
    if (!marcadorActivo || tarjeta.hidden) return;
    const caja = elemento.getBoundingClientRect();
    const punto = marcadorActivo.querySelector('.mi-marcador__nucleo').getBoundingClientRect();
    const cx = punto.left + punto.width / 2 - caja.left;
    const cy = punto.top - caja.top;
    const ancho = tarjeta.offsetWidth;
    const izquierda = Math.min(Math.max(8, cx - ancho / 2), caja.width - ancho - 8);
    const abajo = cy - tarjeta.offsetHeight - 14 < 8; // si no cabe arriba, va debajo
    tarjeta.style.left = `${izquierda}px`;
    tarjeta.style.top = `${abajo ? cy + punto.height + 14 : cy - tarjeta.offsetHeight - 14}px`;
  }

  // Al tocar, abrimos el punto MÁS CERCANO al dedo (en el móvil algunos están muy juntos)
  capaMarcadores.addEventListener('click', (e) => {
    if (!e.target.closest('.mi-marcador')) return;
    e.stopPropagation();
    let mejor = null;
    let distancia = Infinity;
    for (const g of capaMarcadores.querySelectorAll('.mi-marcador:not(.mi-marcador--atenuado)')) {
      const c = g.querySelector('.mi-marcador__nucleo').getBoundingClientRect();
      const dist = Math.hypot(c.left + c.width / 2 - e.clientX, c.top + c.height / 2 - e.clientY);
      if (dist < distancia) { distancia = dist; mejor = g; }
    }
    if (mejor) abrirTarjeta(mejor);
  });
  capaMarcadores.addEventListener('keydown', (e) => {
    const g = e.target.closest('.mi-marcador');
    if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirTarjeta(g); }
  });
  svg.addEventListener('click', cerrarTarjeta);
  elemento.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarTarjeta(); });

  // --- Botones: Ruta completa / Día 1…5 / Isla entera ---
  const controles = document.createElement('div');
  controles.className = 'mi-controles';
  controles.setAttribute('role', 'toolbar');
  controles.setAttribute('aria-label', 'Elegir qué ver en el mapa');
  controles.innerHTML = `
    <button type="button" class="mi-boton" data-ver="ruta" aria-pressed="true">Toda la ruta</button>
    ${entradas.map((e) => `<button type="button" class="mi-boton" data-ver="${e.numero}" aria-pressed="false" style="--color:${COLOR_DIA[e.numero]}">Día ${e.numero}</button>`).join('')}
    <button type="button" class="mi-boton mi-boton--isla" data-ver="isla" aria-pressed="false">Isla entera</button>`;
  elemento.after(controles);

  function ver(cual) {
    cerrarTarjeta();
    controles.querySelectorAll('.mi-boton').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ver === cual)));
    const dia = Number(cual) || 0;
    elemento.classList.toggle('mapa-ilustrado--dia', Boolean(dia));
    capaTramos.querySelectorAll('.mi-tramo').forEach((t) => t.classList.toggle('mi-tramo--activo', Number(t.dataset.dia) === dia));
    capaMarcadores.querySelectorAll('.mi-marcador').forEach((m) => {
      m.classList.toggle('mi-marcador--atenuado', Boolean(dia) && Number(m.dataset.dia) !== dia);
      m.classList.toggle('mi-marcador--con-nombre', Number(m.dataset.dia) === dia);
    });
    if (cual === 'isla') return animarVista(ajustarProporcion(vistaIsla, proporcion(), { ancho, alto }), 1200);
    if (dia) {
      const pts = paradas.filter((p) => p.dia === dia).map((p) => p.xy);
      return animarVista(ajustarProporcion(caja(pts, 110), proporcion(), { ancho, alto }), 1200);
    }
    return animarVista(vistaRuta(), 1200);
  }
  controles.addEventListener('click', (e) => {
    const b = e.target.closest('.mi-boton');
    if (b) ver(b.dataset.ver);
  });

  // --- Entrada en pantalla: zoom de la isla a la ruta y la ruta se dibuja ---
  const obs = new IntersectionObserver(async ([e]) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    cargarHD();
    elemento.classList.add('mapa-ilustrado--listo');
    await animarVista(vistaRuta(), 2200);
    for (const camino of [linea, halo]) {
      camino.style.transition = 'stroke-dashoffset 4.5s cubic-bezier(.65,.05,.36,1)';
      camino.style.strokeDashoffset = 0;
    }
    elemento.classList.add('mapa-ilustrado--marcadores');
  }, { threshold: 0.4 });
  obs.observe(elemento);

  // Si cambia el tamaño (girar el móvil), recolocamos vista y tarjeta
  addEventListener('resize', () => {
    const pulsado = controles.querySelector('[aria-pressed="true"]')?.dataset.ver;
    if (pulsado === 'ruta') ponerVista(vistaRuta());
    colocarTarjeta();
  });
}
