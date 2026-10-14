/* =====================================================================
   datos.js · Todo lo relacionado con LEER contenido
   ---------------------------------------------------------------------
   - Lee datos-viaje.json (costes, lista de equipaje, ruta…)
   - Lee las entradas /entradas/dia-N.md y separa el "front matter"
     (los datos entre ---) del texto en Markdown.
   - Convierte ese Markdown a HTML (un conversor pequeño hecho a mano).
   - Busca las fotos de cada día.
   No hay librerías: todo es JavaScript del navegador.
   ===================================================================== */

export const TOTAL_DIAS = 5;

/* ---------------------------------------------------------------------
   1. Utilidades pequeñas
   --------------------------------------------------------------------- */

/** Escapa caracteres especiales para poder meter texto dentro de HTML sin riesgos. */
export function escaparHTML(texto = '') {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Pide un archivo de texto. Devuelve null si no existe (404) o falla la red. */
async function pedirTexto(url) {
  try {
    const respuesta = await fetch(url, { cache: 'no-cache' });
    return respuesta.ok ? await respuesta.text() : null;
  } catch {
    return null;
  }
}

/** Convierte "2027-01-30" en una fecha UTC (Islandia usa UTC todo el año). */
export function fechaUTC(texto) {
  const [a, m, d] = String(texto).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

/** "2027-01-30" → "sábado, 30 de enero" */
export function formatearFecha(texto, opciones = { weekday: 'long', day: 'numeric', month: 'long' }) {
  if (!texto) return '';
  return new Intl.DateTimeFormat('es-ES', { ...opciones, timeZone: 'UTC' }).format(fechaUTC(texto));
}

/* ---------------------------------------------------------------------
   2. Mini-parser de YAML (solo lo necesario para el front matter)
   ---------------------------------------------------------------------
   Soporta:
     clave: valor               (texto, número, true/false, null)
     clave: "texto con : o #"   (comillas dobles o simples)
     clave: [a, b, c]           (lista en una línea)
     clave:                     (lista de elementos con guion)
       - nombre: Gullfoss
         lat: 64.32
     # comentarios
   --------------------------------------------------------------------- */

/** Convierte un valor de texto YAML en su tipo de JavaScript. */
function valorYAML(crudo) {
  let v = crudo.trim();

  // Texto entre comillas: se respeta tal cual (permite ":" y "#")
  if (v.startsWith('"')) {
    const fin = v.lastIndexOf('"');
    try { return JSON.parse(v.slice(0, fin + 1)); } catch { return v.slice(1, fin); }
  }
  if (v.startsWith("'")) {
    return v.slice(1, v.lastIndexOf("'")).replace(/''/g, "'");
  }

  v = v.replace(/\s+#.*$/, '').trim(); // quita comentarios al final de la línea

  if (v.startsWith('[') && v.endsWith(']')) {
    const interior = v.slice(1, -1).trim();
    return interior ? interior.split(',').map(valorYAML) : [];
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === '' || v === 'null' || v === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

/** ¿La línea tiene forma "clave: valor"? */
const ES_CLAVE = /^([^\s"'#\-][^:]*?):(\s|$)/;

export function parsearYAML(texto) {
  // Guardamos cada línea útil con su sangría (número de espacios)
  const lineas = texto
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => ({ sangria: l.search(/\S/), texto: l.trim() }));

  let i = 0;

  // Lee un bloque (objeto o lista) cuyas líneas tienen exactamente `sangria` espacios
  function bloque(sangria) {
    const esLista = lineas[i].texto.startsWith('-');
    const resultado = esLista ? [] : {};

    while (i < lineas.length && lineas[i].sangria === sangria) {
      const linea = lineas[i];

      if (esLista) {
        if (!linea.texto.startsWith('-')) break;
        const contenido = linea.texto.slice(1).trim();
        if (!contenido) {
          i++; // "-" solo: el elemento está en las líneas siguientes
          resultado.push(i < lineas.length && lineas[i].sangria > sangria ? bloque(lineas[i].sangria) : null);
        } else if (ES_CLAVE.test(contenido)) {
          // "- nombre: x" → objeto. Reescribimos la línea como si el guion no estuviera.
          const nuevaSangria = sangria + linea.texto.indexOf(contenido);
          lineas[i] = { sangria: nuevaSangria, texto: contenido };
          resultado.push(bloque(nuevaSangria));
        } else {
          resultado.push(valorYAML(contenido));
          i++;
        }
      } else {
        const coincide = linea.texto.match(ES_CLAVE);
        if (!coincide) { i++; continue; }
        const clave = coincide[1].trim();
        const resto = linea.texto.slice(coincide[0].length);
        i++;
        if (resto.trim() === '' || resto.trim().startsWith('#')) {
          // Valor vacío: puede ser un bloque anidado (más sangría, o lista al mismo nivel)
          const sig = lineas[i];
          if (sig && (sig.sangria > sangria || (sig.sangria === sangria && sig.texto.startsWith('-')))) {
            resultado[clave] = bloque(sig.sangria);
          } else {
            resultado[clave] = null;
          }
        } else {
          resultado[clave] = valorYAML(resto);
        }
      }
    }
    return resultado;
  }

  return lineas.length ? bloque(lineas[0].sangria) : {};
}

/** Separa "---\nfront matter\n---\ntexto" en { datos, cuerpo } */
export function separarFrontMatter(texto) {
  const coincide = texto.match(/^﻿?---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)([\s\S]*)$/);
  if (!coincide) return { datos: {}, cuerpo: texto };
  return { datos: parsearYAML(coincide[1]), cuerpo: coincide[2] };
}

/* ---------------------------------------------------------------------
   3. Mini-conversor de Markdown → HTML
   ---------------------------------------------------------------------
   Soporta: # títulos, párrafos, **negrita**, *cursiva*, [enlaces](url),
   ![imágenes](ruta), listas con - o 1., > citas, --- separadores y `código`.
   El HTML que escribas se muestra como texto (por seguridad).
   --------------------------------------------------------------------- */

function enLinea(texto) {
  let t = escaparHTML(texto);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,
    '<img src="$2" alt="$1" loading="lazy" decoding="async">');
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, url) => {
    const externo = /^https?:\/\//.test(url);
    return `<a href="${url}"${externo ? ' target="_blank" rel="noopener"' : ''}>${txt}</a>`;
  });
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
  t = t.replace(/(^|\s)_([^_]+)_/g, '$1<em>$2</em>');
  return t;
}

export function markdownAHTML(md = '') {
  const lineas = md.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let parrafo = [];

  const cerrarParrafo = () => {
    if (parrafo.length) html.push(`<p>${enLinea(parrafo.join(' '))}</p>`);
    parrafo = [];
  };

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const limpia = linea.trim();

    if (!limpia) { cerrarParrafo(); continue; }

    // Bloque de código ```
    if (limpia.startsWith('```')) {
      cerrarParrafo();
      const codigo = [];
      while (++i < lineas.length && !lineas[i].trim().startsWith('```')) codigo.push(lineas[i]);
      html.push(`<pre><code>${escaparHTML(codigo.join('\n'))}</code></pre>`);
      continue;
    }

    // Títulos: # (se convierten en h2 como mínimo: el h1 es el título de la página)
    const titulo = limpia.match(/^(#{1,6})\s+(.*)$/);
    if (titulo) {
      cerrarParrafo();
      const nivel = Math.min(6, Math.max(2, titulo[1].length));
      html.push(`<h${nivel}>${enLinea(titulo[2])}</h${nivel}>`);
      continue;
    }

    // Separador
    if (/^(-{3,}|\*{3,})$/.test(limpia)) { cerrarParrafo(); html.push('<hr>'); continue; }

    // Cita: líneas seguidas que empiezan por >
    if (limpia.startsWith('>')) {
      cerrarParrafo();
      const cita = [];
      while (i < lineas.length && lineas[i].trim().startsWith('>')) {
        cita.push(lineas[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      i--;
      html.push(`<blockquote>${markdownAHTML(cita.join('\n'))}</blockquote>`);
      continue;
    }

    // Listas (con - * + o 1.)
    const esItem = (l) => /^([-*+]|\d+\.)\s+/.test(l.trim());
    if (esItem(limpia)) {
      cerrarParrafo();
      const ordenada = /^\d+\./.test(limpia);
      const items = [];
      while (i < lineas.length && esItem(lineas[i])) {
        items.push(`<li>${enLinea(lineas[i].trim().replace(/^([-*+]|\d+\.)\s+/, ''))}</li>`);
        i++;
      }
      i--;
      html.push(ordenada ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
      continue;
    }

    // Imagen sola en su línea → figura con pie de foto
    const imagen = limpia.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (imagen) {
      cerrarParrafo();
      html.push(`<figure class="figura-texto" data-reveal><img src="${escaparHTML(imagen[2])}" alt="${escaparHTML(imagen[1])}" loading="lazy" decoding="async">${imagen[1] ? `<figcaption>${enLinea(imagen[1])}</figcaption>` : ''}</figure>`);
      continue;
    }

    parrafo.push(limpia);
  }
  cerrarParrafo();
  return html.join('\n');
}

/* ---------------------------------------------------------------------
   4. Carga de datos del viaje y de las entradas
   --------------------------------------------------------------------- */

let promesaDatos = null;

/** Lee datos-viaje.json (solo una vez; las siguientes llamadas reutilizan el resultado). */
export function cargarDatosViaje() {
  if (!promesaDatos) {
    promesaDatos = pedirTexto('datos-viaje.json').then((t) => {
      try { return t ? JSON.parse(t) : {}; } catch (e) {
        console.error('datos-viaje.json tiene un error de formato:', e);
        return {};
      }
    });
  }
  return promesaDatos;
}

/** Lee una entrada (dia-N.md) y devuelve un objeto listo para usar. */
export async function cargarEntrada(n) {
  const texto = await pedirTexto(`entradas/dia-${n}.md`);
  const { datos, cuerpo } = separarFrontMatter(texto || '');
  return {
    numero: n,
    existe: Boolean(texto),
    titulo: datos.titulo || `Día ${n}`,
    fecha: datos.fecha ? String(datos.fecha) : '',
    lugar: datos.lugar || '',
    lat: Number(datos.lat) || null,
    lng: Number(datos.lng) || null,
    amanecer: datos.amanecer ? String(datos.amanecer) : '',
    atardecer: datos.atardecer ? String(datos.atardecer) : '',
    lo_mejor: datos.lo_mejor || '',
    resumen: datos.resumen || '',
    portada: datos.portada || '',
    publicado: datos.publicado === true,
    paradas: Array.isArray(datos.paradas) ? datos.paradas.filter((p) => p && p.lat && p.lng) : [],
    fotosFrontMatter: Array.isArray(datos.fotos) ? datos.fotos : null,
    cuerpo,
  };
}

/** Lee las 5 entradas a la vez. */
export function cargarEntradas() {
  return Promise.all(Array.from({ length: TOTAL_DIAS }, (_, i) => cargarEntrada(i + 1)));
}

/* ---------------------------------------------------------------------
   5. Fotos de cada día
   ---------------------------------------------------------------------
   Orden de búsqueda:
     a) La lista "fotos:" del front matter (tú decides orden y pies de foto).
     b) Si no hay lista: se pregunta a la API de GitHub qué archivos hay en
        fotos/dia-N/ (así basta con subir fotos desde el móvil).
     c) Si eso falla (o estás en local): fotos/dia-N/fotos.json, que genera
        el script "node generar.js".
   fotos.json además aporta ancho/alto y versiones WebP si las creó el script.
   --------------------------------------------------------------------- */

const ES_IMAGEN = /\.(jpe?g|png|webp|avif|gif)$/i;
const ES_VARIANTE = /-\d+\.webp$/i; // ej. foto-800.webp (generada por el script)

async function listarConGitHub(carpeta, repo) {
  const local = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  if (!repo || !repo.usuario || local) return null;

  const claveCache = `gh:${carpeta}`;
  try {
    const guardado = JSON.parse(sessionStorage.getItem(claveCache) || 'null');
    if (guardado && Date.now() - guardado.t < 10 * 60 * 1000) return guardado.lista;
  } catch { /* sessionStorage no disponible: seguimos */ }

  try {
    const url = `https://api.github.com/repos/${repo.usuario}/${repo.nombre}/contents/${carpeta}?ref=${repo.rama || 'main'}`;
    const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return null;
    const lista = (await r.json())
      .filter((f) => f.type === 'file' && ES_IMAGEN.test(f.name) && !ES_VARIANTE.test(f.name))
      .map((f) => f.name)
      .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    try { sessionStorage.setItem(claveCache, JSON.stringify({ t: Date.now(), lista })); } catch { /* nada */ }
    return lista;
  } catch {
    return null;
  }
}

/** Convierte un nombre de archivo + metadatos en el objeto foto que usa la galería. */
function construirFoto(carpeta, archivo, pie, meta) {
  const src = archivo.includes('/') ? archivo : `${carpeta}/${archivo}`;
  const foto = { src, pie: pie || '', ancho: meta?.ancho || null, alto: meta?.alto || null, srcsetWebp: '' };
  if (meta?.variantes?.length) {
    const base = src.replace(/\.[^.]+$/, '');
    foto.srcsetWebp = meta.variantes.map((w) => `${base}-${w}.webp ${w}w`).join(', ');
  }
  return foto;
}

export async function cargarFotos(entrada, datosViaje) {
  const carpeta = `fotos/dia-${entrada.numero}`;
  const textoJSON = await pedirTexto(`${carpeta}/fotos.json`);
  let generadas = [];
  try { generadas = textoJSON ? JSON.parse(textoJSON) : []; } catch { generadas = []; }
  const meta = Object.fromEntries(generadas.map((f) => [f.archivo, f]));

  // a) Front matter
  if (entrada.fotosFrontMatter) {
    return entrada.fotosFrontMatter
      .map((f) => (typeof f === 'string' ? { archivo: f } : f))
      .filter((f) => f && f.archivo)
      .map((f) => construirFoto(carpeta, String(f.archivo), f.pie, meta[f.archivo]));
  }

  // b) API de GitHub (solo para días publicados, para no gastar peticiones)
  if (entrada.publicado) {
    const lista = await listarConGitHub(carpeta, datosViaje.repositorio);
    if (lista) return lista.map((a) => construirFoto(carpeta, a, meta[a]?.pie, meta[a]));
  }

  // c) fotos.json
  return generadas.map((f) => construirFoto(carpeta, f.archivo, f.pie, f));
}

/* ---------------------------------------------------------------------
   6. ¿En qué momento del viaje estamos?
   --------------------------------------------------------------------- */

/**
 * Devuelve { fase: 'antes' | 'durante' | 'despues', dia, inicio }
 * Se puede simular otra fecha con ?hoy=2027-01-31 en la URL (útil para probar).
 */
export function estadoViaje(sitio) {
  const inicio = fechaUTC(sitio?.inicio || '2027-01-30');
  const fin = fechaUTC(sitio?.fin || '2027-02-03');
  const simulada = new URLSearchParams(location.search).get('hoy');
  const ahora = simulada ? fechaUTC(simulada).getTime() + 12 * 3600e3 : Date.now();
  const unDia = 86400e3;

  if (ahora < inicio.getTime()) return { fase: 'antes', dia: 0, inicio, ahora };
  if (ahora < fin.getTime() + unDia) {
    return { fase: 'durante', dia: Math.floor((ahora - inicio.getTime()) / unDia) + 1, inicio, ahora };
  }
  return { fase: 'despues', dia: TOTAL_DIAS, inicio, ahora };
}
