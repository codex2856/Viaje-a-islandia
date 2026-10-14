/* =====================================================================
   galeria.js · Galería en mosaico + visor a pantalla completa (lightbox)
   ---------------------------------------------------------------------
   - Las imágenes usan loading="lazy" y, si el script generar.js creó
     versiones WebP, un <picture> con srcset (el navegador elige el tamaño).
   - El visor usa <dialog>: gestiona el foco y la tecla Escape por nosotros.
   - En móvil: desliza a los lados para cambiar de foto, hacia abajo para cerrar.
   ===================================================================== */

import { escaparHTML } from './datos.js';

/** HTML de una imagen optimizada (WebP + JPG de respaldo). */
export function htmlImagen(foto, { sizes = '(min-width: 900px) 33vw, 50vw', clase = '', alt = '', carga = 'lazy' } = {}) {
  // width/height evitan saltos mientras carga. Si no sabemos el tamaño ponemos 4:3;
  // al cargar, la foto toma su proporción real (height: auto en CSS).
  const dims = foto.ancho && foto.alto ? ` width="${foto.ancho}" height="${foto.alto}"` : ' width="1600" height="1200"';
  const srcset = foto.srcset ? ` srcset="${escaparHTML(foto.srcset)}" sizes="${sizes}"` : '';
  const img = `<img src="${escaparHTML(foto.src)}"${srcset} alt="${escaparHTML(alt || foto.pie)}" loading="${carga}" decoding="async"${dims} class="${clase}">`;
  if (!foto.srcsetWebp) return img;
  return `<picture><source type="image/webp" srcset="${escaparHTML(foto.srcsetWebp)}" sizes="${sizes}">${img}</picture>`;
}

/**
 * Pone `url` como imagen de fondo de `elemento`, pero solo si la foto existe
 * (se precarga antes). Devuelve una promesa con true/false.
 */
export function ponerFondo(elemento, url) {
  return new Promise((resolver) => {
    if (!url || !elemento) return resolver(false);
    const img = new Image();
    img.onload = () => { elemento.style.backgroundImage = `url("${url}")`; resolver(true); };
    img.onerror = () => resolver(false);
    img.src = url;
  });
}

/** Muestra el crédito de una foto (autor y licencia); si hay fuente, como enlace. */
export function pintarCredito(elemento, credito, fuente) {
  if (!elemento || !credito) return;
  elemento.innerHTML = fuente
    ? `<a href="${escaparHTML(fuente)}" target="_blank" rel="noopener">${escaparHTML(credito)}</a>`
    : escaparHTML(credito);
  elemento.hidden = false;
}

/** Mosaico de huecos decorativos cuando aún no hay fotos. */
export function htmlHuecos(cantidad = 5, texto = 'Foto pendiente') {
  return Array.from({ length: cantidad }, (_, i) => `
    <div class="galeria__item galeria__item--hueco" style="--i:${i}" data-reveal>
      <span>${texto}</span>
    </div>`).join('');
}

/** Pinta la galería dentro de `contenedor` y conecta el visor. */
export function pintarGaleria(contenedor, fotos, { titulo = 'Foto' } = {}) {
  if (!fotos.length) {
    contenedor.innerHTML = htmlHuecos(5);
    contenedor.classList.add('galeria--vacia');
    return;
  }
  contenedor.innerHTML = fotos.map((foto, i) => `
    <button type="button" class="galeria__item" data-indice="${i}" data-reveal style="--i:${i % 6}"
            aria-label="Ampliar: ${escaparHTML(foto.pie || `${titulo} ${i + 1}`)}">
      ${htmlImagen(foto, { alt: foto.pie || `${titulo} ${i + 1}` })}
      ${foto.pie ? `<span class="galeria__pie">${escaparHTML(foto.pie)}</span>` : ''}
    </button>`).join('');

  // Si una foto no se puede cargar (nombre mal escrito…), quitamos su hueco del mosaico
  contenedor.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG') e.target.closest('.galeria__item')?.remove();
  }, true);

  contenedor.addEventListener('click', (e) => {
    const item = e.target.closest('[data-indice]');
    if (item) abrirVisor(fotos, Number(item.dataset.indice), item);
  });
}

/** Las fotos metidas dentro del texto (![pie](foto.jpg)) se amplían al tocarlas. */
export function activarFotosDelTexto(contenedor) {
  const imagenes = [...contenedor.querySelectorAll('.figura-texto img')];
  if (!imagenes.length) return;
  const fotos = imagenes.map((img) => ({ src: img.currentSrc || img.src, pie: img.alt }));
  imagenes.forEach((img, i) => {
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', `Ampliar foto${img.alt ? ': ' + img.alt : ''}`);
    const abrir = () => abrirVisor(fotos, i, img);
    img.addEventListener('click', abrir);
    img.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
    // Si una foto no existe (nombre mal escrito), quitamos su hueco
    img.addEventListener('error', () => img.closest('.figura-texto')?.remove());
  });
}

/* ---------------------------------------------------------------------
   Visor (lightbox)
   --------------------------------------------------------------------- */
let visor;          // el <dialog>
let lista = [];     // fotos que se están mostrando
let actual = 0;     // índice de la foto visible
let origen = null;  // elemento que abrió el visor (para devolverle el foco)

function crearVisor() {
  visor = document.createElement('dialog');
  visor.className = 'visor';
  visor.setAttribute('aria-label', 'Visor de fotos');
  visor.innerHTML = `
    <div class="visor__escenario">
      <figure class="visor__figura">
        <img class="visor__img" alt="">
        <figcaption class="visor__pie"></figcaption>
        <p class="visor__credito"></p>
      </figure>
    </div>
    <p class="visor__contador" aria-live="polite"></p>
    <button type="button" class="visor__boton visor__cerrar" aria-label="Cerrar visor">✕</button>
    <button type="button" class="visor__boton visor__anterior" aria-label="Foto anterior">←</button>
    <button type="button" class="visor__boton visor__siguiente" aria-label="Foto siguiente">→</button>`;
  document.body.append(visor);

  visor.querySelector('.visor__cerrar').addEventListener('click', cerrarVisor);
  visor.querySelector('.visor__anterior').addEventListener('click', () => mostrar(actual - 1));
  visor.querySelector('.visor__siguiente').addEventListener('click', () => mostrar(actual + 1));
  visor.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') mostrar(actual - 1);
    if (e.key === 'ArrowRight') mostrar(actual + 1);
  });
  // Clic en el fondo (fuera de la foto) cierra
  visor.addEventListener('click', (e) => {
    if (e.target === visor || e.target.classList.contains('visor__escenario')) cerrarVisor();
  });
  visor.addEventListener('close', () => {
    document.documentElement.classList.remove('visor-abierto');
    origen?.focus({ preventScroll: true });
  });
  activarGestos(visor.querySelector('.visor__escenario'));
}

function mostrar(indice) {
  actual = (indice + lista.length) % lista.length; // da la vuelta al llegar al final
  const foto = lista[actual];
  const img = visor.querySelector('.visor__img');
  const figura = visor.querySelector('.visor__figura');

  figura.classList.remove('visor__figura--entra');
  void figura.offsetWidth; // reinicia la animación de entrada
  figura.classList.add('visor__figura--entra');

  img.src = foto.src;
  img.alt = foto.pie || `Foto ${actual + 1}`;
  visor.querySelector('.visor__pie').textContent = foto.pie || '';
  const credito = visor.querySelector('.visor__credito');
  credito.innerHTML = foto.credito
    ? (foto.fuente ? `<a href="${escaparHTML(foto.fuente)}" target="_blank" rel="noopener">${escaparHTML(foto.credito)}</a>` : escaparHTML(foto.credito))
    : '';
  visor.querySelector('.visor__contador').textContent = `${actual + 1} / ${lista.length}`;
  visor.classList.toggle('visor--una', lista.length < 2);

  // Precarga la siguiente y la anterior para que el cambio sea instantáneo
  [actual + 1, actual - 1].forEach((i) => { new Image().src = lista[(i + lista.length) % lista.length].src; });
}

export function abrirVisor(fotos, indice = 0, elementoOrigen = null) {
  if (!visor) crearVisor();
  lista = fotos;
  origen = elementoOrigen;
  mostrar(indice);
  document.documentElement.classList.add('visor-abierto');
  visor.showModal();
}

function cerrarVisor() {
  visor.classList.add('visor--cerrando');
  setTimeout(() => { visor.classList.remove('visor--cerrando'); visor.close(); }, 200);
}

/** Gestos táctiles: arrastrar a los lados = cambiar foto, hacia abajo = cerrar. */
function activarGestos(zona) {
  const figura = zona.querySelector('.visor__figura');
  let inicioX = 0, inicioY = 0, dx = 0, dy = 0, arrastrando = false;

  zona.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    arrastrando = true;
    inicioX = e.clientX; inicioY = e.clientY; dx = dy = 0;
    figura.style.transition = 'none';
  });
  zona.addEventListener('pointermove', (e) => {
    if (!arrastrando) return;
    dx = e.clientX - inicioX;
    dy = e.clientY - inicioY;
    const vertical = Math.abs(dy) > Math.abs(dx);
    figura.style.transform = vertical && dy > 0
      ? `translateY(${dy}px) scale(${1 - Math.min(dy / 1500, 0.15)})`
      : `translateX(${dx}px)`;
    visor.style.setProperty('--opacidad-fondo', vertical && dy > 0 ? String(1 - Math.min(dy / 400, 0.6)) : '1');
  });
  const soltar = () => {
    if (!arrastrando) return;
    arrastrando = false;
    figura.style.transition = '';
    figura.style.transform = '';
    visor.style.setProperty('--opacidad-fondo', '1');
    if (dy > 110 && Math.abs(dy) > Math.abs(dx)) cerrarVisor();
    else if (dx < -50) mostrar(actual + 1);
    else if (dx > 50) mostrar(actual - 1);
  };
  zona.addEventListener('pointerup', soltar);
  zona.addEventListener('pointercancel', soltar);
}
