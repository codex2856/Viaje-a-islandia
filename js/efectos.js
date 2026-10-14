/* =====================================================================
   efectos.js · Efectos compartidos por todas las páginas
   ---------------------------------------------------------------------
   - Barra de progreso de lectura (arriba)
   - Menú superior que se esconde al bajar y aparece al subir
   - Aparición suave de elementos al hacer scroll   [data-reveal]
   - Parallax                                       [data-parallax="0.2"]
   - Brillo que sigue al cursor en tarjetas         .vidrio
   - Transiciones entre páginas (View Transitions + alternativa)
   - Menú inferior del móvil con los 5 días
   ===================================================================== */

import { TOTAL_DIAS, escaparHTML } from './datos.js';

const movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esEscritorio = matchMedia('(hover: hover) and (pointer: fine)').matches;

/** Ejecuta `fn` cuando la página ha terminado de cargar y el navegador está libre. */
export function alCargar(fn, retraso = 0) {
  const lanzar = () => setTimeout(fn, retraso);
  const ejecutar = () => ('requestIdleCallback' in window ? requestIdleCallback(lanzar, { timeout: 2000 }) : setTimeout(lanzar, 600));
  if (document.readyState === 'complete') ejecutar();
  else addEventListener('load', ejecutar, { once: true });
}

/* ---------- Scroll: barra de progreso + menú que se esconde ---------- */
function iniciarScroll() {
  const barra = document.querySelector('.progreso-lectura');
  const cabecera = document.querySelector('.cabecera');
  let ultimoY = scrollY;
  let pendiente = false;

  function actualizar() {
    pendiente = false;
    const y = scrollY;
    const total = document.documentElement.scrollHeight - innerHeight;
    if (barra) barra.style.transform = `scaleX(${total > 0 ? y / total : 0})`;

    if (cabecera) {
      cabecera.classList.toggle('cabecera--solida', y > 40);
      // Solo escondemos si bajamos más de 8px (evita parpadeos) y no estamos arriba
      if (y > ultimoY + 8 && y > 160) cabecera.classList.add('cabecera--oculta');
      else if (y < ultimoY - 8 || y < 160) cabecera.classList.remove('cabecera--oculta');
    }
    if (Math.abs(y - ultimoY) > 8) ultimoY = y;
    actualizarParallax();
  }

  addEventListener('scroll', () => {
    if (!pendiente) { pendiente = true; requestAnimationFrame(actualizar); }
  }, { passive: true });
  actualizar();
}

/* ---------- Parallax ---------- */
const elementosParallax = new Set();
const hijosParallax = new Map();
const registradosParallax = new WeakSet();
let observadorParallax;

function actualizarParallax() {
  if (movimientoReducido) return;
  const mitad = innerHeight / 2;
  for (const el of elementosParallax) {
    // Medimos el PADRE: si midiéramos el propio elemento, su transform
    // alteraría la medida y el movimiento se retroalimentaría.
    const caja = el.parentElement.getBoundingClientRect();
    const desplazamiento = (caja.top + caja.height / 2 - mitad) * Number(el.dataset.parallax || 0.15);
    el.style.transform = `translate3d(0, ${desplazamiento.toFixed(1)}px, 0)`;
  }
}

/** Registra los elementos [data-parallax] dentro de `raiz`. Solo calcula los que están en pantalla. */
export function observarParallax(raiz = document) {
  if (movimientoReducido) return;
  observadorParallax ??= new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      for (const hijo of hijosParallax.get(e.target) || []) {
        if (e.isIntersecting) elementosParallax.add(hijo);
        else elementosParallax.delete(hijo);
      }
    }
    actualizarParallax();
  }, { rootMargin: '100px 0px' });
  raiz.querySelectorAll('[data-parallax]').forEach((el) => {
    if (registradosParallax.has(el)) return; // ya estaba registrado
    registradosParallax.add(el);
    // Observamos el padre (que no se mueve) y guardamos la relación padre → elemento
    hijosParallax.set(el.parentElement, [...(hijosParallax.get(el.parentElement) || []), el]);
    observadorParallax.observe(el.parentElement);
  });
}

/* ---------- Aparición al hacer scroll ---------- */
let observadorReveal;

/** Hace aparecer suavemente los elementos [data-reveal] cuando entran en pantalla. */
export function observarReveal(raiz = document) {
  const elementos = raiz.querySelectorAll('[data-reveal]:not(.revelado)');
  if (movimientoReducido || !('IntersectionObserver' in window)) {
    elementos.forEach((el) => el.classList.add('revelado'));
    return;
  }
  observadorReveal ??= new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (e.isIntersecting) {
        e.target.classList.add('revelado');
        observadorReveal.unobserve(e.target);
      }
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  elementos.forEach((el) => observadorReveal.observe(el));
}

/* ---------- Brillo que sigue al cursor ---------- */
function iniciarBrillo() {
  if (!esEscritorio) return;
  document.addEventListener('pointermove', (e) => {
    const tarjeta = e.target.closest?.('.vidrio, .boton');
    if (!tarjeta) return;
    const caja = tarjeta.getBoundingClientRect();
    tarjeta.style.setProperty('--mx', `${e.clientX - caja.left}px`);
    tarjeta.style.setProperty('--my', `${e.clientY - caja.top}px`);
  }, { passive: true });
}

/* ---------- Transiciones entre páginas ---------- */
function iniciarTransiciones() {
  // Chrome/Edge/Safari modernos: View Transitions entre documentos (definido en CSS
  // con @view-transition). Si el navegador lo soporta no hacemos nada más.
  if ('CSSViewTransitionRule' in window || movimientoReducido) return;

  // Alternativa: fundido manual al salir de la página
  document.addEventListener('click', (e) => {
    const enlace = e.target.closest('a[href]');
    if (!enlace || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || enlace.target) return;
    const url = new URL(enlace.href, location.href);
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
    e.preventDefault();
    document.body.classList.add('pagina-saliendo');
    setTimeout(() => { location.href = url.href; }, 260);
  });
  // Si el usuario vuelve atrás, la página puede venir de caché con la clase puesta
  addEventListener('pageshow', () => document.body.classList.remove('pagina-saliendo'));
}

/* ---------- Menú inferior (móvil): 5 puntos, uno por día ---------- */
export function pintarNavegacionDias(entradas, diaActivo = 0) {
  const nav = document.querySelector('.nav-dias');
  if (!nav) return;
  const publicados = entradas.filter((e) => e.publicado).length;
  // La línea se rellena hasta el último día publicado
  const ultimo = Math.max(0, ...entradas.filter((e) => e.publicado).map((e) => e.numero));
  const porcentaje = ultimo ? ((ultimo - 1) / (TOTAL_DIAS - 1)) * 100 : 0;

  nav.innerHTML = `
    <div class="nav-dias__pista" aria-hidden="true">
      <span class="nav-dias__relleno" style="width:${porcentaje}%"></span>
    </div>
    <ol class="nav-dias__lista">
      ${entradas.map((e) => `
        <li>
          <a href="dia.html?n=${e.numero}"
             class="nav-dias__punto ${e.publicado ? 'es-publicado' : ''} ${e.numero === diaActivo ? 'es-activo' : ''}"
             ${e.numero === diaActivo ? 'aria-current="page"' : ''}
             aria-label="Día ${e.numero}: ${escaparHTML(e.titulo)}${e.publicado ? '' : ' (próximamente)'}">
            <span class="nav-dias__circulo"></span>
            <span class="nav-dias__num">${e.numero}</span>
          </a>
        </li>`).join('')}
    </ol>
    <p class="nav-dias__texto">${publicados} de ${TOTAL_DIAS} días escritos</p>`;
}

/* ---------- Menú hamburguesa (para pantallas medianas) ---------- */
function iniciarMenu() {
  const boton = document.querySelector('.cabecera__menu-boton');
  const menu = document.getElementById('menu-principal');
  if (!boton || !menu) return;
  const cerrar = () => { boton.setAttribute('aria-expanded', 'false'); menu.classList.remove('abierto'); };
  boton.addEventListener('click', () => {
    const abierto = boton.getAttribute('aria-expanded') === 'true';
    boton.setAttribute('aria-expanded', String(!abierto));
    menu.classList.toggle('abierto', !abierto);
  });
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) cerrar(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
}

/* ---------- Pausar animaciones fuera de pantalla ---------- */
// La aurora, las estrellas, la niebla y los pulsos del mapa son animaciones
// infinitas. Cuando su zona no se ve, les ponemos .fuera-de-vista (en CSS:
// animation-play-state: paused) para que no gasten CPU.
function pausarFueraDeVista() {
  const obs = new IntersectionObserver((entradas) => {
    for (const e of entradas) e.target.classList.toggle('fuera-de-vista', !e.isIntersecting);
  });
  document.querySelectorAll('.hero, .dia-hero, .mapa').forEach((el) => obs.observe(el));
}

/** Arranca todo lo común. Se llama desde inicio.js y dia.js */
export function iniciarEfectosComunes() {
  document.documentElement.classList.add('js');
  iniciarScroll();
  iniciarBrillo();
  iniciarTransiciones();
  iniciarMenu();
  pausarFueraDeVista();
  observarReveal();
  observarParallax();
}
