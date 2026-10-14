/* =====================================================================
   inicio.js · Lógica de la página principal (index.html)
   ---------------------------------------------------------------------
   1. Arranca los efectos comunes y el cielo animado.
   2. Detecta la foto de portada.
   3. Cuenta atrás / "Día X de 5".
   4. Lee los datos y pinta: mapa, itinerario, horas de luz, enlaces
      y mini mapa. (El diario y el resumen tienen su propia página.)
   ===================================================================== */

import {
  TOTAL_DIAS, cargarDatosViaje, cargarEntradas, escaparHTML,
  estadoViaje, formatearFecha, resolverImagen,
} from './datos.js';
import { alCargar, iniciarEfectosComunes, observarReveal } from './efectos.js';
import { iniciarCielo } from './cielo.js';
import { crearMapaRuta, crearMiniMapa, cuandoSeaVisible, COLOR_DIA } from './mapa.js';
import { pintarCredito, ponerFondo } from './galeria.js';

iniciarEfectosComunes();
// El cielo animado (aurora, estrellas y nieve) arranca cuando la página ya ha cargado (no compite con el primer pintado)
alCargar(() => iniciarCielo({
  aurora: document.querySelector('.aurora-canvas'),
  nieve: document.querySelector('.hero__nieve'),
  zona: document.querySelector('.hero'),
}), 1000); // 1 s después de cargar: no compite con el primer pintado
animarTituloLetraALetra(document.querySelector('[data-letras]'));

/* ---------------------------------------------------------------------
   Título del hero: cada letra en un <span> con su propio retraso
   --------------------------------------------------------------------- */
function animarTituloLetraALetra(titulo) {
  if (!titulo) return;
  let indice = 0;
  titulo.querySelectorAll('.hero__linea').forEach((linea) => {
    const palabras = linea.textContent.split(/\s+/);
    // aria-hidden: el lector de pantalla usa el aria-label del <h1>
    linea.setAttribute('aria-hidden', 'true');
    linea.innerHTML = palabras.map((palabra) =>
      `<span class="palabra">${[...palabra].map((letra) =>
        `<span class="letra" style="--i:${indice++}">${escaparHTML(letra)}</span>`).join('')}</span>`,
    ).join(' ');
  });
  titulo.classList.add('hero__titulo--listo');
}

/* ---------------------------------------------------------------------
   Foto de portada:
   1) si existe fotos/portada.jpg (tu foto), se usa esa;
   2) si no, la de "portada" en datos-viaje.json (foto de ejemplo);
   3) si tampoco, se queda el cielo generado con CSS.
   --------------------------------------------------------------------- */
async function detectarFotoPortada(sitio = {}) {
  const capa = document.querySelector('.hero__foto');
  const hero = document.querySelector('.hero');
  if (await ponerFondo(capa, 'fotos/portada.jpg')) {
    hero.classList.add('hero--con-foto');
    return;
  }
  const ejemplo = sitio.portada;
  if (ejemplo?.imagen && await ponerFondo(capa, resolverImagen(ejemplo.imagen, 'fotos', 2400))) {
    hero.classList.add('hero--con-foto');
    pintarCredito(document.querySelector('.hero .credito-foto'), ejemplo.credito, ejemplo.fuente);
  }
}

/* ---------------------------------------------------------------------
   Cuenta atrás
   --------------------------------------------------------------------- */
function iniciarCuentaAtras(sitio) {
  const caja = document.querySelector('.cuenta');
  const estado = estadoViaje(sitio);

  if (estado.fase === 'durante') {
    caja.innerHTML = `
      <p class="cuenta__etiqueta">Estamos en Islandia</p>
      <a class="cuenta__dia" href="diario.html#dia-${estado.dia}">Día <strong>${estado.dia}</strong> de ${TOTAL_DIAS}</a>`;
    return;
  }
  if (estado.fase === 'despues') {
    caja.innerHTML = `
      <p class="cuenta__etiqueta">Viaje completado</p>
      <a class="cuenta__dia" href="resumen.html">5 días · <strong>1</strong> isla</a>`;
    return;
  }

  const objetivo = estado.inicio.getTime();
  const campos = Object.fromEntries([...caja.querySelectorAll('[data-cuenta]')].map((el) => [el.dataset.cuenta, el]));
  const dosCifras = (n) => String(n).padStart(2, '0');

  function tic() {
    let resto = Math.max(0, objetivo - Date.now());
    if (resto === 0) { iniciarCuentaAtras(sitio); return; }
    const d = Math.floor(resto / 86400e3); resto -= d * 86400e3;
    const h = Math.floor(resto / 3600e3); resto -= h * 3600e3;
    const m = Math.floor(resto / 60e3); resto -= m * 60e3;
    const s = Math.floor(resto / 1e3);
    campos.d.textContent = d;
    campos.h.textContent = dosCifras(h);
    campos.m.textContent = dosCifras(m);
    campos.s.textContent = dosCifras(s);
    setTimeout(tic, 1000 - (Date.now() % 1000));
  }
  // Los segundos cambian cada segundo: no queremos que el lector de pantalla lo anuncie
  caja.removeAttribute('aria-live');
  tic();
}

/* ---------------------------------------------------------------------
   Utilidades de horas ("10:14" → minutos desde medianoche)
   --------------------------------------------------------------------- */
const aMinutos = (hora) => {
  const [h, m] = String(hora).split(':').map(Number);
  return h * 60 + (m || 0);
};
const duracion = (min) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;

/* ---------------------------------------------------------------------
   Antes del viaje
   --------------------------------------------------------------------- */
function pintarLineaTiempo(entradas) {
  document.getElementById('linea-tiempo').innerHTML = entradas.map((e) => `
    <li class="linea-tiempo__item" data-reveal style="--color:${COLOR_DIA[e.numero]}">
      <span class="linea-tiempo__punto" aria-hidden="true"></span>
      <p class="linea-tiempo__fecha">Día ${e.numero} · ${escaparHTML(formatearFecha(e.fecha))}</p>
      <h4 class="linea-tiempo__titulo"><a href="diario.html#dia-${e.numero}">${escaparHTML(e.lugar)}</a></h4>
      <p class="linea-tiempo__texto">${escaparHTML(e.resumen)}</p>
    </li>`).join('');
}

function pintarHorasLuz(entradas) {
  const conHoras = entradas.filter((e) => e.amanecer && e.atardecer);
  document.getElementById('horas-luz').innerHTML = conHoras.map((e) => {
    const ini = aMinutos(e.amanecer);
    const fin = aMinutos(e.atardecer);
    return `
      <div class="luz__fila" role="listitem">
        <span class="luz__dia">D${e.numero}</span>
        <div class="luz__pista" aria-hidden="true">
          <span class="luz__barra" style="--ini:${(ini / 1440) * 100}%; --ancho:${((fin - ini) / 1440) * 100}%"></span>
        </div>
        <span class="luz__datos">
          <span class="luz__horas"><span class="visualmente-oculto">Día ${e.numero}: amanecer </span>${e.amanecer}<span aria-hidden="true"> – </span><span class="visualmente-oculto">, atardecer </span>${e.atardecer}</span>
          <span class="luz__total">${duracion(fin - ini)}</span>
        </span>
      </div>`;
  }).join('') + `
      <div class="luz__escala" aria-hidden="true"><span>0 h</span><span>6</span><span>12</span><span>18</span><span>24 h</span></div>`;

  // Cifra "horas de luz" en el bloque de la ruta (total del viaje)
  const total = conHoras.reduce((suma, e) => suma + aMinutos(e.atardecer) - aMinutos(e.amanecer), 0);
  const celda = document.querySelector('[data-cifra="luz"]');
  if (celda && total) celda.textContent = `${Math.round(total / 60)} h`;
}

function pintarEnlaces(enlaces = []) {
  document.getElementById('enlaces').innerHTML = enlaces.map((e) => `
    <li>
      <a class="enlace-util" href="${escaparHTML(e.url)}" target="_blank" rel="noopener">
        <span class="enlace-util__nombre">${escaparHTML(e.nombre)}</span>
        <span class="enlace-util__desc">${escaparHTML(e.descripcion || '')}</span>
        <span class="enlace-util__flecha" aria-hidden="true">↗</span>
      </a>
    </li>`).join('');
}

/* ---------------------------------------------------------------------
   Arranque: cargar datos y pintar todo
   --------------------------------------------------------------------- */
async function iniciar() {
  const [datos, entradas] = await Promise.all([cargarDatosViaje(), cargarEntradas()]);

  detectarFotoPortada(datos.sitio);
  iniciarCuentaAtras(datos.sitio);
  pintarLineaTiempo(entradas);
  pintarHorasLuz(entradas);
  pintarEnlaces(datos.enlaces);
  observarReveal();

  const totalParadas = entradas.reduce((s, e) => s + e.paradas.length, 0);
  document.querySelector('[data-cifra="paradas"]').textContent = totalParadas;

  // Los mapas (y Leaflet) se cargan solo cuando van a verse
  const mapaRuta = document.getElementById('mapa-ruta');
  cuandoSeaVisible(mapaRuta, () => crearMapaRuta(mapaRuta, entradas, datos).catch(errorMapa(mapaRuta)));
  const miniMapa = document.getElementById('mini-mapa');
  cuandoSeaVisible(miniMapa, () => crearMiniMapa(miniMapa, entradas, datos).catch(errorMapa(miniMapa)));
}

function errorMapa(elemento) {
  return (error) => {
    console.error(error);
    elemento.innerHTML = '<p class="mapa__error">No se pudo cargar el mapa. Revisa tu conexión.</p>';
  };
}

iniciar();
