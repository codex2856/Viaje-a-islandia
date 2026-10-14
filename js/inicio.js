/* =====================================================================
   inicio.js · Lógica de la página principal (index.html)
   ---------------------------------------------------------------------
   1. Arranca los efectos comunes y la nieve.
   2. Detecta la foto de portada.
   3. Cuenta atrás / "Día X de 5".
   4. Lee los datos y pinta: mapa, itinerario, horas de luz, maleta,
      enlaces, tarjetas de los días, resumen y mini mapa.
   ===================================================================== */

import {
  TOTAL_DIAS, cargarDatosViaje, cargarEntradas, cargarFotos, escaparHTML,
  estadoViaje, formatearFecha,
} from './datos.js';
import { alCargar, iniciarEfectosComunes, observarReveal, observarParallax, pintarNavegacionDias } from './efectos.js';
import { iniciarNieve } from './nieve.js';
import { crearMapaRuta, crearMiniMapa, cuandoSeaVisible, COLOR_DIA } from './mapa.js';
import { htmlImagen, htmlHuecos, pintarGaleria } from './galeria.js';

iniciarEfectosComunes();
// La nieve arranca cuando la página ya ha cargado (no compite con el primer pintado)
alCargar(() => iniciarNieve(document.querySelector('.hero__nieve')));
animarTituloLetraALetra(document.querySelector('[data-letras]'));
detectarFotoPortada();

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
   Foto de portada: si existe fotos/portada.jpg se usa como fondo
   --------------------------------------------------------------------- */
function detectarFotoPortada() {
  const ruta = 'fotos/portada.jpg';
  const img = new Image();
  img.onload = () => {
    const capa = document.querySelector('.hero__foto');
    capa.style.backgroundImage = `url("${ruta}")`;
    document.querySelector('.hero').classList.add('hero--con-foto');
  };
  img.src = ruta; // si no existe, onload no se dispara y se queda el cielo generado
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
      <a class="cuenta__dia" href="dia.html?n=${estado.dia}">Día <strong>${estado.dia}</strong> de ${TOTAL_DIAS}</a>`;
    return;
  }
  if (estado.fase === 'despues') {
    caja.innerHTML = `
      <p class="cuenta__etiqueta">Viaje completado</p>
      <a class="cuenta__dia" href="#resumen">5 días · <strong>1</strong> isla</a>`;
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
      <h4 class="linea-tiempo__titulo"><a href="dia.html?n=${e.numero}">${escaparHTML(e.lugar)}</a></h4>
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

const CLAVE_MALETA = 'islandia-maleta-v1';

function pintarMaleta(categorias = []) {
  let marcados = {};
  try { marcados = JSON.parse(localStorage.getItem(CLAVE_MALETA) || '{}'); } catch { marcados = {}; }

  // Identificador estable para cada casilla, a partir de su texto
  const id = (texto) => 'm-' + texto.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const contenedor = document.getElementById('maleta');
  contenedor.innerHTML = categorias.map((cat) => `
    <fieldset class="maleta__grupo">
      <legend>${escaparHTML(cat.categoria)}</legend>
      ${cat.items.map((item) => `
        <label class="casilla">
          <input type="checkbox" id="${id(item)}" ${marcados[id(item)] ? 'checked' : ''}>
          <span class="casilla__marca" aria-hidden="true"></span>
          <span class="casilla__texto">${escaparHTML(item)}</span>
        </label>`).join('')}
    </fieldset>`).join('');

  const contador = document.getElementById('contador-maleta');
  const actualizar = () => {
    const casillas = contenedor.querySelectorAll('input');
    const hechas = [...casillas].filter((c) => c.checked).length;
    contador.textContent = `${hechas}/${casillas.length}`;
    contador.classList.toggle('completo', hechas === casillas.length && hechas > 0);
  };
  contenedor.addEventListener('change', (e) => {
    marcados[e.target.id] = e.target.checked;
    try { localStorage.setItem(CLAVE_MALETA, JSON.stringify(marcados)); } catch { /* modo privado */ }
    actualizar();
  });
  actualizar();
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
   Tarjetas de los 5 días
   --------------------------------------------------------------------- */
function htmlTarjetaDia(e, fotos) {
  const miniaturas = fotos.slice(0, 3);
  const fecha = escaparHTML(formatearFecha(e.fecha));
  return `
    <article class="dia-tarjeta vidrio ${e.publicado ? '' : 'dia-tarjeta--pronto'}" id="dia-${e.numero}"
             style="--color:${COLOR_DIA[e.numero]}" data-reveal>
      <span class="dia-tarjeta__numero" data-parallax="0.12" aria-hidden="true"
            style="view-transition-name: numero-dia-${e.numero}">${e.numero}</span>
      <div class="dia-tarjeta__cuerpo">
        <p class="dia-tarjeta__fecha">Día ${e.numero} · ${fecha}</p>
        <h3 class="dia-tarjeta__titulo">
          <a href="dia.html?n=${e.numero}" class="enlace-tarjeta">${escaparHTML(e.titulo)}</a>
        </h3>
        <p class="dia-tarjeta__lugar">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>
          ${escaparHTML(e.lugar)}
        </p>
        ${e.lo_mejor ? `
        <blockquote class="dia-tarjeta__mejor">
          <span class="dia-tarjeta__etiqueta">Lo mejor del día</span>
          <p>${escaparHTML(e.lo_mejor)}</p>
        </blockquote>` : ''}
        <div class="dia-tarjeta__miniaturas" aria-hidden="true">
          ${miniaturas.length
            ? miniaturas.map((f) => `<span class="miniatura">${htmlImagen(f, { sizes: '160px', alt: '' })}</span>`).join('')
            : '<span class="miniatura miniatura--hueco"></span><span class="miniatura miniatura--hueco"></span><span class="miniatura miniatura--hueco"></span>'}
        </div>
        <span class="dia-tarjeta__leer" aria-hidden="true">${e.publicado ? 'Leer el día' : 'Ver el plan'} <span>→</span></span>
      </div>
      ${e.publicado ? '' : `
      <div class="escarcha" aria-hidden="true">
        <span class="escarcha__sello">Próximamente</span>
        <span class="escarcha__fecha">${fecha}</span>
      </div>`}
    </article>`;
}

async function pintarDias(entradas, datos) {
  const lista = document.getElementById('lista-dias');
  // Primero pintamos sin fotos (rápido) y luego, cuando lleguen, con miniaturas
  lista.innerHTML = entradas.map((e) => htmlTarjetaDia(e, [])).join('');
  observarReveal(lista);
  observarParallax(lista);

  const fotosPorDia = await Promise.all(entradas.map((e) => (e.publicado ? cargarFotos(e, datos) : [])));
  entradas.forEach((e, i) => {
    if (!fotosPorDia[i].length) return;
    const tarjeta = document.getElementById(`dia-${e.numero}`);
    tarjeta.querySelector('.dia-tarjeta__miniaturas').innerHTML = fotosPorDia[i].slice(0, 3)
      .map((f) => `<span class="miniatura">${htmlImagen(f, { sizes: '160px', alt: '' })}</span>`).join('');
  });
}

/* ---------------------------------------------------------------------
   Resumen final
   --------------------------------------------------------------------- */
function pintarResumen(resumen = {}) {
  const seccion = document.getElementById('resumen');
  seccion.classList.toggle('seccion--borrador', !resumen.publicado);
  document.getElementById('resumen-intro').textContent = resumen.intro || '';

  if (!resumen.publicado) {
    seccion.querySelector('.seccion__cabecera').insertAdjacentHTML('beforeend',
      '<p class="etiqueta-borrador">Borrador · se completará a la vuelta</p>');
  }

  document.getElementById('resumen-lo-mejor').innerHTML = (resumen.lo_mejor || []).map((m, i) => `
    <article class="lo-mejor__item vidrio" data-reveal style="--i:${i}">
      <span class="lo-mejor__num" aria-hidden="true">0${i + 1}</span>
      <h3 class="lo-mejor__titulo">${escaparHTML(m.titulo)}</h3>
      <p>${escaparHTML(m.texto)}</p>
    </article>`).join('');

  // Tabla de costes: "real" vacío → se muestra "—" y el total usa lo previsto
  const moneda = resumen.moneda || '€';
  const formato = (n) => (n == null ? '—' : `${new Intl.NumberFormat('es-ES').format(n)} ${moneda}`);
  const costes = resumen.costes || [];
  const totalPrevisto = costes.reduce((s, c) => s + (Number(c.previsto) || 0), 0);
  const conReal = costes.filter((c) => c.real != null);
  const totalReal = conReal.reduce((s, c) => s + Number(c.real), 0);
  document.getElementById('tabla-costes').innerHTML = `
    <table class="tabla">
      <caption class="visualmente-oculto">Costes previstos y reales del viaje</caption>
      <thead><tr><th scope="col">Concepto</th><th scope="col">Previsto</th><th scope="col">Real</th></tr></thead>
      <tbody>
        ${costes.map((c) => {
          const diferencia = c.real != null && c.previsto != null ? c.real - c.previsto : null;
          return `<tr>
            <th scope="row">${escaparHTML(c.concepto)}</th>
            <td>${formato(c.previsto)}</td>
            <td class="${diferencia > 0 ? 'mas' : diferencia < 0 ? 'menos' : ''}">${formato(c.real)}</td>
          </tr>`;
        }).join('')}
      </tbody>
      <tfoot><tr><th scope="row">Total</th><td>${formato(totalPrevisto)}</td><td>${conReal.length ? formato(totalReal) : '—'}</td></tr></tfoot>
    </table>`;

  document.getElementById('consejos').innerHTML = (resumen.consejos || [])
    .map((c) => `<li data-reveal>${escaparHTML(c)}</li>`).join('');

  const top = (resumen.top_fotos || []).map((f) => ({ src: f.src, pie: f.pie || '', srcsetWebp: '' }));
  const galeria = document.getElementById('top-fotos');
  if (top.length) pintarGaleria(galeria, top, { titulo: 'Top' });
  else galeria.innerHTML = htmlHuecos(6, 'Pronto');

  observarReveal(seccion);
}

/* ---------------------------------------------------------------------
   Arranque: cargar datos y pintar todo
   --------------------------------------------------------------------- */
async function iniciar() {
  const [datos, entradas] = await Promise.all([cargarDatosViaje(), cargarEntradas()]);

  iniciarCuentaAtras(datos.sitio);
  pintarNavegacionDias(entradas);
  pintarLineaTiempo(entradas);
  pintarHorasLuz(entradas);
  pintarMaleta(datos.que_llevar);
  pintarEnlaces(datos.enlaces);
  pintarResumen(datos.resumen);
  pintarDias(entradas, datos);
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
