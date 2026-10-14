/* =====================================================================
   diario.js · Pestaña "Diario" (diario.html)
   ---------------------------------------------------------------------
   Pinta los 5 días uno detrás de otro, como un diario:
     Día 1 · fecha · título · lugar
     texto que escribiste, con las fotos donde las pusiste
     Día 2 …
   Los días con publicado: false salen como "Próximamente".
   Cada día también tiene su página propia (dia.html?n=1) con mapa y galería.
   ===================================================================== */

import {
  TOTAL_DIAS, cargarDatosViaje, cargarEntradas, escaparHTML, formatearFecha,
  markdownAHTML, resolverImagen,
} from './datos.js';
import { alCargar, iniciarEfectosComunes, observarReveal, observarParallax } from './efectos.js';
import { iniciarCielo } from './cielo.js';
import { COLOR_DIA } from './mapa.js';
import { activarFotosDelTexto } from './galeria.js';

iniciarEfectosComunes();
alCargar(() => iniciarCielo({
  aurora: document.querySelector('.aurora-canvas'),
  nieve: document.querySelector('.hero__nieve'),
  zona: document.querySelector('.cabecera-pagina'),
}), 1000);

/** Índice de etapas: una "pastilla" por día que salta a su entrada. */
function pintarEtapas(entradas) {
  document.querySelector('[data-etapas]').innerHTML = `
    <ol class="etapas__lista">
      ${entradas.map((e) => `
        <li>
          <a class="etapa ${e.publicado ? 'etapa--escrita' : ''}" href="#dia-${e.numero}" style="--color:${COLOR_DIA[e.numero]}">
            <span class="etapa__num">${e.numero}</span>
            <span class="etapa__texto">
              <span class="etapa__fecha">${escaparHTML(formatearFecha(e.fecha, { day: 'numeric', month: 'short' }))}</span>
              <span class="etapa__lugar">${escaparHTML(e.lugar)}</span>
            </span>
          </a>
        </li>`).join('')}
    </ol>
    <p class="etapas__progreso">${entradas.filter((e) => e.publicado).length} de ${TOTAL_DIAS} días escritos</p>`;
}

/** Un día del diario: cabecera con foto + texto (o "Próximamente"). */
function htmlCronica(e) {
  const fondo = e.portada ? resolverImagen(e.portada, `fotos/dia-${e.numero}`, 1600) : '';
  const fecha = formatearFecha(e.fecha);
  const cuerpo = e.publicado
    ? `<div class="articulo cronica__texto">${markdownAHTML(e.cuerpo, { carpeta: `fotos/dia-${e.numero}` })}</div>
       <a class="cronica__mas" href="dia.html?n=${e.numero}">Ver el día ${e.numero} con mapa y galería <span aria-hidden="true">→</span></a>`
    : `<div class="pronto vidrio">
         <div class="escarcha escarcha--estatica" aria-hidden="true"></div>
         <p class="pronto__sello">Próximamente</p>
         <p class="pronto__nota">Lo escribiré la noche del ${escaparHTML(formatearFecha(e.fecha, { day: 'numeric', month: 'long' }))}.</p>
       </div>`;

  return `
    <article class="cronica" id="dia-${e.numero}" style="--color:${COLOR_DIA[e.numero]}" aria-labelledby="titulo-dia-${e.numero}">
      <header class="cronica__cabecera" data-reveal>
        <div class="cronica__foto ${fondo ? '' : 'cronica__foto--vacia'}" aria-hidden="true">
          ${fondo ? `<span data-parallax="-0.1" style="background-image:url('${escaparHTML(fondo)}')"></span>` : ''}
          <span class="cronica__numero">${e.numero}</span>
        </div>
        <p class="cronica__fecha">Día ${e.numero} · ${escaparHTML(fecha)}</p>
        <h2 class="cronica__titulo" id="titulo-dia-${e.numero}">${escaparHTML(e.titulo)}</h2>
        <p class="cronica__lugar">${escaparHTML(e.lugar)}</p>
      </header>
      ${cuerpo}
    </article>`;
}

async function iniciar() {
  const [, entradas] = await Promise.all([cargarDatosViaje(), cargarEntradas()]);
  pintarEtapas(entradas);

  const contenedor = document.querySelector('[data-cronicas]');
  contenedor.innerHTML = entradas.map(htmlCronica).join('');

  // Cada bloque del texto aparece suavemente al hacer scroll
  contenedor.querySelectorAll('.cronica__texto > *, .pronto, .cronica__mas').forEach((el) => el.setAttribute('data-reveal', ''));
  observarReveal(contenedor);
  observarParallax(contenedor);
  contenedor.querySelectorAll('.cronica__texto').forEach(activarFotosDelTexto);

  // Si se llega con #dia-3 en la dirección, saltamos a ese día cuando ya está pintado
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
}

iniciar();
