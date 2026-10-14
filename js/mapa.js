/* =====================================================================
   mapa.js · Mapas con Leaflet
   ---------------------------------------------------------------------
   Leaflet pesa ~40 KB, así que NO se descarga al abrir la web: se carga
   solo cuando un mapa está a punto de verse (mejora el rendimiento).
   Teselas oscuras: CartoDB Dark Matter, teñidas de azul con CSS.
   ===================================================================== */

import { escaparHTML, formatearFecha } from './datos.js';

const LEAFLET_VERSION = '1.9.4';
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
const TESELAS = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ATRIBUCION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Color de acento de cada día (el 3 es el día de la lava 🔥) */
export const COLOR_DIA = { 1: '#7fd1e8', 2: '#5cffb1', 3: '#ff9466', 4: '#8a6bff', 5: '#cfeefa' };

const movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esTactil = matchMedia('(pointer: coarse)').matches;

/* ---------- Carga diferida de Leaflet ---------- */
let promesaLeaflet;
export function cargarLeaflet() {
  promesaLeaflet ??= new Promise((resolver, rechazar) => {
    const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: LEAFLET_CSS });
    const js = Object.assign(document.createElement('script'), { src: LEAFLET_JS, async: true });
    js.onload = () => resolver(window.L);
    js.onerror = rechazar;
    document.head.append(css, js);
  });
  return promesaLeaflet;
}

/** Ejecuta `callback` cuando `elemento` esté cerca de entrar en pantalla. */
export function cuandoSeaVisible(elemento, callback, margen = '300px') {
  const obs = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { obs.disconnect(); callback(); }
  }, { rootMargin: margen });
  obs.observe(elemento);
}

/* ---------- Piezas comunes ---------- */
function mapaBase(L, elemento, { interactivo = true } = {}) {
  const mapa = L.map(elemento, {
    zoomControl: interactivo,
    attributionControl: true,
    scrollWheelZoom: false,               // la rueda sirve para hacer scroll de la página
    dragging: interactivo && !esTactil,   // en móvil un dedo = scroll de la página
    touchZoom: interactivo,
    doubleClickZoom: interactivo,
    boxZoom: false,
    keyboard: interactivo,
    tap: false,
    zoomSnap: 0.25,                       // permite encuadres más ajustados
  });
  L.tileLayer(TESELAS, { attribution: ATRIBUCION, subdomains: 'abcd', maxZoom: 18, detectRetina: true }).addTo(mapa);
  mapa.attributionControl.setPrefix(false);
  return mapa;
}

function iconoParada(L, dia, parada, indice, etiqueta = dia) {
  const pendiente = parada.confirmada === false;
  return L.divIcon({
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
    html: `<span class="marcador ${pendiente ? 'marcador--pendiente' : ''}"
                 style="--color:${COLOR_DIA[dia]}; --retraso:${(indice * 0.18).toFixed(2)}s">
             <span class="marcador__pulso"></span>
             <span class="marcador__nucleo">${etiqueta}</span>
           </span>`,
  });
}

function tarjetaPopup(entrada, parada) {
  const pendiente = parada.confirmada === false;
  return `
    <article class="tarjeta-mapa" style="--color:${COLOR_DIA[entrada.numero]}">
      <p class="tarjeta-mapa__dia">Día ${entrada.numero} · ${escaparHTML(formatearFecha(entrada.fecha, { day: 'numeric', month: 'long' }))}</p>
      <h3 class="tarjeta-mapa__titulo">${escaparHTML(parada.nombre)}</h3>
      ${pendiente ? '<p class="tarjeta-mapa__nota">Parada por confirmar</p>' : ''}
      <a class="tarjeta-mapa__enlace" href="dia.html?n=${entrada.numero}">
        ${entrada.publicado ? 'Leer la entrada' : 'Ver el día'} <span aria-hidden="true">→</span>
      </a>
    </article>`;
}

// numerarParadas: true → los marcadores muestran 1, 2, 3… (mapa de un día);
// false → muestran el número del día (mapa general)
function anadirParadas(L, mapa, entradas, { conPopup = true, numerarParadas = false } = {}) {
  let indice = 0;
  for (const entrada of entradas) {
    for (const [orden, parada] of entrada.paradas.entries()) {
      const etiqueta = numerarParadas ? orden + 1 : entrada.numero;
      const marcador = L.marker([parada.lat, parada.lng], {
        icon: iconoParada(L, entrada.numero, parada, indice++, etiqueta),
        title: `Día ${entrada.numero}: ${parada.nombre}`,
        alt: parada.nombre,
        riseOnHover: true,
        keyboard: conPopup,
        interactive: conPopup,
      }).addTo(mapa);
      if (conPopup) marcador.bindPopup(tarjetaPopup(entrada, parada), { className: 'popup-vidrio', maxWidth: 260 });
    }
  }
}

/** Dibuja la ruta con un resplandor debajo y devuelve la línea principal. */
function dibujarRuta(L, mapa, puntos, { color = '#7fd1e8', grosor = 3, opacidad = 1 } = {}) {
  L.polyline(puntos, { color, weight: grosor * 4, opacity: 0.12 * opacidad, lineCap: 'round', interactive: false, className: 'ruta-brillo' }).addTo(mapa);
  return L.polyline(puntos, { color, weight: grosor, opacity: opacidad, lineCap: 'round', lineJoin: 'round', interactive: false, className: 'ruta-linea' }).addTo(mapa);
}

/**
 * Efecto "trazo que avanza": se usa stroke-dasharray / stroke-dashoffset de SVG.
 * 1) ocultar(): la línea se "tapa" con un hueco tan largo como ella misma.
 * 2) animar(): el hueco se reduce a 0 con una transición CSS → la línea se dibuja.
 */
function ocultarTrazo(caminos) {
  for (const c of caminos) {
    const largo = c.getTotalLength();
    c.style.strokeDasharray = `${largo} ${largo}`;
    c.style.strokeDashoffset = largo;
  }
}

function animarTrazo(caminos, duracion = 5200) {
  const limpiar = () => caminos.forEach((c) => {
    c.style.strokeDasharray = c.style.strokeDashoffset = c.style.transition = '';
  });
  if (movimientoReducido) return limpiar();
  for (const c of caminos) {
    c.getBoundingClientRect(); // fuerza al navegador a aplicar el estado inicial
    c.style.transition = `stroke-dashoffset ${duracion}ms cubic-bezier(.65,.05,.36,1)`;
    c.style.strokeDashoffset = 0;
  }
  // Al terminar quitamos el truco para que el zoom no corte la línea
  setTimeout(limpiar, duracion + 100);
  return limpiar;
}

function todasLasParadas(entradas) {
  return entradas.flatMap((e) => e.paradas.map((p) => [p.lat, p.lng]));
}

/* =====================================================================
   Mapa grande de la ruta (sección "La ruta" de la portada)
   ===================================================================== */
export async function crearMapaRuta(elemento, entradas, datosViaje) {
  const L = await cargarLeaflet();
  const mapa = mapaBase(L, elemento);
  const puntos = datosViaje.ruta?.puntos?.length ? datosViaje.ruta.puntos : todasLasParadas(entradas);
  mapa.fitBounds(L.latLngBounds(puntos), { padding: [30, 30] });

  dibujarRuta(L, mapa, puntos);
  elemento.classList.add('mapa--preparado');

  // La línea empieza oculta; se dibuja (y aparecen las paradas) al entrar en pantalla
  const caminos = [...elemento.querySelectorAll('.ruta-linea, .ruta-brillo')];
  if (!movimientoReducido) ocultarTrazo(caminos);

  const obs = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    elemento.classList.add('mapa--animado');
    const limpiar = animarTrazo(caminos);
    anadirParadas(L, mapa, entradas);
    mapa.once('zoomstart', () => limpiar?.());
  }, { threshold: 0.35 });
  obs.observe(elemento);

  return mapa;
}

/* =====================================================================
   Mapa pequeño de un día (página dia.html)
   ===================================================================== */
export async function crearMapaDia(elemento, entrada, datosViaje) {
  const L = await cargarLeaflet();
  const mapa = mapaBase(L, elemento);
  const color = COLOR_DIA[entrada.numero];

  // La ruta completa, muy tenue, como contexto
  if (datosViaje.ruta?.puntos?.length) dibujarRuta(L, mapa, datosViaje.ruta.puntos, { color: '#cfeefa', grosor: 1.5, opacidad: 0.25 });

  const puntos = entrada.paradas.map((p) => [p.lat, p.lng]);
  if (puntos.length > 1) {
    const linea = dibujarRuta(L, mapa, puntos, { color, grosor: 3 });
    linea.getElement()?.classList.add('ruta-linea--dia');
  }
  anadirParadas(L, mapa, [entrada], { numerarParadas: true });

  if (puntos.length) mapa.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 11 });
  else mapa.setView([entrada.lat || 64.1, entrada.lng || -21.9], 9);
  elemento.classList.add('mapa--preparado', 'mapa--animado');
  return mapa;
}

/* =====================================================================
   Mini mapa del pie de página (sin interacción): ruta recorrida
   Solo se resalta la parte de la ruta de los días ya publicados.
   ===================================================================== */
export async function crearMiniMapa(elemento, entradas, datosViaje) {
  const L = await cargarLeaflet();
  const mapa = mapaBase(L, elemento, { interactivo: false });
  const puntos = datosViaje.ruta?.puntos?.length ? datosViaje.ruta.puntos : todasLasParadas(entradas);
  mapa.fitBounds(L.latLngBounds(puntos), { padding: [12, 12] });

  dibujarRuta(L, mapa, puntos, { color: '#cfeefa', grosor: 1.5, opacidad: 0.3 });
  const recorridas = entradas.filter((e) => e.publicado);
  for (const e of recorridas) {
    if (e.paradas.length > 1) dibujarRuta(L, mapa, e.paradas.map((p) => [p.lat, p.lng]), { color: COLOR_DIA[e.numero], grosor: 2.5 });
  }
  anadirParadas(L, mapa, recorridas.length ? recorridas : [], { conPopup: false });
  elemento.classList.add('mapa--preparado', 'mapa--animado');
  return mapa;
}
