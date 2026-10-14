/* =====================================================================
   resumen.js · Pestaña "Resumen" (resumen.html)
   ---------------------------------------------------------------------
   Mientras "resumen.publicado" sea false en datos-viaje.json, solo se
   muestra un aviso: "lo escribiré al volver". Cuando lo pongas a true,
   se pinta lo que haya: introducción, lo mejor, costes, consejos y fotos.
   Las partes vacías no se muestran.
   ===================================================================== */

import { cargarDatosViaje, construirFoto, escaparHTML, formatearFecha } from './datos.js';
import { alCargar, iniciarEfectosComunes, observarReveal } from './efectos.js';
import { iniciarCielo } from './cielo.js';
import { pintarGaleria } from './galeria.js';

iniciarEfectosComunes();
alCargar(() => iniciarCielo({
  aurora: document.querySelector('.aurora-canvas'),
  nieve: document.querySelector('.hero__nieve'),
  zona: document.querySelector('.cabecera-pagina'),
}), 1000);

function htmlPendiente(sitio = {}) {
  const vuelta = sitio.fin ? formatearFecha(sitio.fin, { day: 'numeric', month: 'long' }) : 'la vuelta';
  return `
    <div class="resumen-pendiente vidrio" data-reveal>
      <p class="pronto__sello">A la vuelta</p>
      <h2 class="resumen-pendiente__titulo">El resumen lo escribiré al volver</h2>
      <p>Cuando termine el viaje (después del ${escaparHTML(vuelta)}) aquí estará lo mejor de los cinco días,
         lo que costó de verdad y los consejos que me habría gustado saber antes.</p>
      <a class="boton boton--claro" href="diario.html"><span>Mientras tanto, el diario</span>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h14m0 0-6-6m6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
    </div>`;
}

function htmlCostes(resumen) {
  const costes = resumen.costes || [];
  if (!costes.length) return '';
  const moneda = resumen.moneda || '€';
  const formato = (n) => (n == null ? '—' : `${new Intl.NumberFormat('es-ES').format(n)} ${moneda}`);
  // Se usa "real" si existe; si no, "previsto"
  const importe = (c) => (c.real ?? c.previsto ?? null);
  const total = costes.reduce((s, c) => s + (Number(importe(c)) || 0), 0);
  return `
    <article class="panel vidrio" data-reveal>
      <h2 class="subtitulo">Lo que costó</h2>
      <div class="tabla-envoltorio">
        <table class="tabla">
          <caption class="visualmente-oculto">Costes del viaje</caption>
          <thead><tr><th scope="col">Concepto</th><th scope="col">Importe</th></tr></thead>
          <tbody>
            ${costes.map((c) => `<tr><th scope="row">${escaparHTML(c.concepto)}</th><td>${formato(importe(c))}</td></tr>`).join('')}
          </tbody>
          <tfoot><tr><th scope="row">Total</th><td>${formato(total)}</td></tr></tfoot>
        </table>
      </div>
    </article>`;
}

async function iniciar() {
  const datos = await cargarDatosViaje();
  const resumen = datos.resumen || {};
  const contenedor = document.querySelector('[data-resumen]');

  if (!resumen.publicado) {
    contenedor.innerHTML = htmlPendiente(datos.sitio);
    observarReveal(contenedor);
    return;
  }

  const loMejor = resumen.lo_mejor || [];
  const consejos = resumen.consejos || [];
  contenedor.innerHTML = `
    ${resumen.intro ? `<p class="resumen__intro" data-reveal>${escaparHTML(resumen.intro)}</p>` : ''}
    ${loMejor.length ? `
      <h2 class="subtitulo" data-reveal>Lo mejor</h2>
      <div class="lo-mejor">
        ${loMejor.map((m, i) => `
          <article class="lo-mejor__item vidrio" data-reveal style="--i:${i}">
            <span class="lo-mejor__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
            <h3 class="lo-mejor__titulo">${escaparHTML(m.titulo)}</h3>
            <p>${escaparHTML(m.texto)}</p>
          </article>`).join('')}
      </div>` : ''}
    <div class="resumen-rejilla">
      ${htmlCostes(resumen)}
      ${consejos.length ? `
        <article class="panel vidrio" data-reveal>
          <h2 class="subtitulo">Consejos</h2>
          <ol class="consejos">${consejos.map((c) => `<li>${escaparHTML(c)}</li>`).join('')}</ol>
        </article>` : ''}
    </div>
    <div class="galeria" id="top-fotos"></div>`;

  const top = (resumen.top_fotos || []).filter((f) => f.src)
    .map((f) => construirFoto('fotos', String(f.src), f.pie, null, f.credito));
  if (top.length) {
    document.getElementById('top-fotos').insertAdjacentHTML('beforebegin', '<h2 class="subtitulo subtitulo--centro" data-reveal>Mis fotos favoritas</h2>');
    pintarGaleria(document.getElementById('top-fotos'), top, { titulo: 'Foto favorita' });
  }
  observarReveal(contenedor);
}

iniciar();
