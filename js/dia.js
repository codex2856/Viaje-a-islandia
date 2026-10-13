/* =====================================================================
   dia.js · Página de un día (dia.html?n=3)
   ---------------------------------------------------------------------
   Lee el número de la URL, carga su entrada Markdown y pinta: cabecera,
   texto, mapa pequeño, galería con visor y navegación anterior/siguiente.
   Truco: dia.html?n=3&borrador=1 enseña el texto aunque publicado: false
   (para revisarlo antes de publicarlo).
   ===================================================================== */

import {
  TOTAL_DIAS, cargarDatosViaje, cargarEntradas, cargarFotos, escaparHTML,
  formatearFecha, markdownAHTML,
} from './datos.js';
import { alCargar, iniciarEfectosComunes, observarReveal, observarParallax, pintarNavegacionDias } from './efectos.js';
import { iniciarNieve } from './nieve.js';
import { crearMapaDia, cuandoSeaVisible, COLOR_DIA } from './mapa.js';
import { pintarGaleria } from './galeria.js';

iniciarEfectosComunes();
alCargar(() => iniciarNieve(document.querySelector('.hero__nieve')));

const parametros = new URLSearchParams(location.search);
const numero = Math.min(TOTAL_DIAS, Math.max(1, parseInt(parametros.get('n'), 10) || 1));
const verBorrador = parametros.has('borrador');

/** Atajo: rellena el elemento [data-nombre] */
const $ = (nombre) => document.querySelector(`[data-${nombre}]`);

function pintarCabecera(e) {
  document.title = `Día ${e.numero}: ${e.titulo} · Islandia`;
  document.querySelector('meta[name="description"]').content =
    `Día ${e.numero} del viaje a Islandia (${formatearFecha(e.fecha, { day: 'numeric', month: 'long', year: 'numeric' })}): ${e.resumen || e.lugar}`;
  document.querySelector('meta[property="og:title"]').content = `Día ${e.numero}: ${e.titulo}`;
  document.body.style.setProperty('--color', COLOR_DIA[e.numero]);

  const num = $('numero');
  num.textContent = e.numero;
  num.style.viewTransitionName = `numero-dia-${e.numero}`; // "vuela" desde la tarjeta de la portada
  $('fecha').textContent = `Día ${e.numero} de ${TOTAL_DIAS} · ${formatearFecha(e.fecha)}`;
  $('titulo').textContent = e.titulo;
  $('lugar').textContent = e.lugar;

  const chips = [];
  if (e.amanecer) chips.push(`<li class="chip"><span aria-hidden="true">☀︎</span> Amanecer ${escaparHTML(e.amanecer)}</li>`);
  if (e.atardecer) chips.push(`<li class="chip"><span aria-hidden="true">☾</span> Atardecer ${escaparHTML(e.atardecer)}</li>`);
  if (!e.publicado) chips.push('<li class="chip chip--pronto">Próximamente</li>');
  $('chips').innerHTML = chips.join('');
}

function pintarTexto(e) {
  const articulo = $('articulo');
  if (e.publicado || verBorrador) {
    articulo.innerHTML =
      (!e.publicado ? '<div class="etiqueta-borrador">Vista previa · este día aún no está publicado</div>' : '') +
      markdownAHTML(e.cuerpo);
  } else {
    // Día sin escribir: tarjeta con escarcha y el plan previsto
    articulo.innerHTML = `
      <div class="pronto vidrio">
        <div class="escarcha escarcha--estatica" aria-hidden="true"></div>
        <p class="pronto__sello">Próximamente</p>
        <h2 class="pronto__titulo">Este día aún no está escrito</h2>
        <p>${escaparHTML(e.resumen || 'Vuelve la noche del ' + formatearFecha(e.fecha, { day: 'numeric', month: 'long' }) + '.')}</p>
        <p class="pronto__nota">La entrada se publicará la noche del ${escaparHTML(formatearFecha(e.fecha, { day: 'numeric', month: 'long' }))}.</p>
      </div>`;
  }
  // Cada bloque del texto aparece suavemente al hacer scroll
  articulo.querySelectorAll(':scope > *').forEach((el) => el.setAttribute('data-reveal', ''));
  observarReveal(articulo);
}

function pintarLateral(e) {
  $('paradas').innerHTML = e.paradas.map((p) => `
    <li class="${p.confirmada === false ? 'parada--pendiente' : ''}">
      ${escaparHTML(p.nombre)}${p.confirmada === false ? ' <span class="parada__nota">por confirmar</span>' : ''}
    </li>`).join('');
  if (e.lo_mejor && (e.publicado || verBorrador)) {
    $('mejor').hidden = false;
    $('mejor-texto').textContent = `“${e.lo_mejor}”`;
  }
}

function pintarAnteriorSiguiente(entradas) {
  const enlace = (e, tipo) => !e ? '<span></span>' : `
    <a class="anterior-siguiente__enlace anterior-siguiente__enlace--${tipo} vidrio" href="dia.html?n=${e.numero}"
       style="--color:${COLOR_DIA[e.numero]}">
      <span class="anterior-siguiente__dir">${tipo === 'anterior' ? '← Día anterior' : 'Día siguiente →'}</span>
      <span class="anterior-siguiente__num" aria-hidden="true">${e.numero}</span>
      <span class="anterior-siguiente__titulo">${escaparHTML(e.titulo)}</span>
    </a>`;
  $('anterior-siguiente').innerHTML =
    enlace(entradas[numero - 2], 'anterior') + enlace(entradas[numero], 'siguiente');
}

async function iniciar() {
  const [datos, entradas] = await Promise.all([cargarDatosViaje(), cargarEntradas()]);
  const entrada = entradas[numero - 1];

  pintarCabecera(entrada);
  pintarTexto(entrada);
  pintarLateral(entrada);
  pintarAnteriorSiguiente(entradas);
  pintarNavegacionDias(entradas, numero);

  const mapa = document.getElementById('mapa-dia');
  cuandoSeaVisible(mapa, () => crearMapaDia(mapa, entrada, datos).catch((err) => {
    console.error(err);
    mapa.innerHTML = '<p class="mapa__error">No se pudo cargar el mapa.</p>';
  }));

  // Galería (solo si el día está publicado o en vista previa)
  const seccionGaleria = $('seccion-galeria');
  if (!entrada.publicado && !verBorrador) { seccionGaleria.hidden = true; return; }

  const fotos = await cargarFotos({ ...entrada, publicado: true }, datos);
  if (fotos.length) {
    pintarGaleria(document.getElementById('galeria'), fotos, { titulo: `Día ${numero}` });
    observarReveal(seccionGaleria);
  } else {
    seccionGaleria.hidden = true;
  }

  // Foto de cabecera: la indicada en "portada:" o la primera de la galería
  const portada = entrada.portada ? `fotos/dia-${numero}/${entrada.portada}` : fotos[0]?.src;
  if (portada) {
    const img = new Image();
    img.onload = () => {
      document.querySelector('.dia-hero__foto-img').style.backgroundImage = `url("${portada}")`;
      document.querySelector('.dia-hero').classList.add('dia-hero--con-foto');
      observarParallax();
    };
    img.src = portada;
  }
}

iniciar();
