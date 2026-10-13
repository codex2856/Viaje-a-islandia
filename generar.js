#!/usr/bin/env node
/* =====================================================================
   generar.js · Prepara las fotos para la web  (opcional)
   ---------------------------------------------------------------------
   Uso:
     npm install          (solo la primera vez: instala "sharp")
     node generar.js

   Para cada carpeta fotos/dia-N/:
     1. Si una foto es enorme (> 2400 px o > 1,5 MB), guarda una copia en
        fotos/originales/ (ignorada por git) y la reduce a 2000 px, JPG 82 %.
     2. Crea versiones WebP de 800 y 1600 px (foto-800.webp, foto-1600.webp)
        que la web usa con srcset: el móvil descarga la pequeña.
     3. Escribe fotos/dia-N/fotos.json con la lista de fotos, su tamaño y
        las versiones creadas. Los pies de foto ("pie") que hayas escrito a
        mano en fotos.json se conservan.
   También optimiza fotos/portada.jpg si existe.

   Sin "sharp" instalado, el script solo genera los fotos.json.
   ===================================================================== */

import { readdir, readFile, writeFile, stat, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const CARPETA_FOTOS = path.join(RAIZ, 'fotos');
const CARPETA_ORIGINALES = path.join(CARPETA_FOTOS, 'originales');
const ANCHOS = [800, 1600];
const MAX_LADO = 2000;
const ES_IMAGEN = /\.(jpe?g|png|webp)$/i;
const ES_VARIANTE = /-\d+\.webp$/i;

// "sharp" es opcional: si no está instalado seguimos sin comprimir
let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.log('ℹ️  "sharp" no está instalado: solo se generarán los fotos.json.');
  console.log('   Para comprimir y crear WebP ejecuta antes: npm install\n');
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

/** Reduce una foto grande (guardando una copia del original). */
async function reducirSiHaceFalta(ruta, carpetaDestinoCopia) {
  const info = await stat(ruta);
  const meta = await sharp(ruta).metadata();
  const ladoMayor = Math.max(meta.width, meta.height);
  if (ladoMayor <= 2400 && info.size <= 1.5 * 1024 * 1024) return;

  await mkdir(carpetaDestinoCopia, { recursive: true });
  const copia = path.join(carpetaDestinoCopia, path.basename(ruta));
  if (!existsSync(copia)) await copyFile(ruta, copia);

  const salida = await sharp(copia)
    .rotate() // respeta la orientación del móvil (EXIF)
    .resize({ width: MAX_LADO, height: MAX_LADO, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true, progressive: true })
    .toBuffer();
  await writeFile(ruta, salida);
  console.log(`   ↓ ${path.basename(ruta)}: ${kb(info.size)} → ${kb(salida.length)}`);
}

/** Crea foto-800.webp y foto-1600.webp. Devuelve los anchos creados. */
async function crearVariantes(ruta) {
  const base = ruta.replace(/\.[^.]+$/, '');
  const meta = await sharp(ruta).rotate().metadata();
  const creadas = [];
  for (const ancho of ANCHOS) {
    const destino = `${base}-${ancho}.webp`;
    if (!existsSync(destino)) {
      await sharp(ruta).rotate().resize({ width: ancho, withoutEnlargement: true }).webp({ quality: 78 }).toFile(destino);
    }
    creadas.push(ancho);
    if (meta.width <= ancho) break; // no tiene sentido una versión mayor que el original
  }
  return creadas;
}

async function procesarCarpeta(carpeta) {
  const nombre = path.basename(carpeta);
  const archivos = (await readdir(carpeta))
    .filter((a) => ES_IMAGEN.test(a) && !ES_VARIANTE.test(a))
    .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

  // Conservamos los pies de foto que ya hubiera en fotos.json
  const rutaJSON = path.join(carpeta, 'fotos.json');
  let anterior = [];
  try { anterior = JSON.parse(await readFile(rutaJSON, 'utf8')); } catch { /* no existía */ }
  const pies = Object.fromEntries(anterior.map((f) => [f.archivo, f.pie]));

  console.log(`📁 ${nombre}: ${archivos.length} foto(s)`);
  const lista = [];
  for (const archivo of archivos) {
    const ruta = path.join(carpeta, archivo);
    const entrada = { archivo };
    if (pies[archivo]) entrada.pie = pies[archivo];
    if (sharp) {
      await reducirSiHaceFalta(ruta, path.join(CARPETA_ORIGINALES, nombre));
      const meta = await sharp(ruta).rotate().metadata();
      // Con rotate() sin argumentos, metadata() sigue dando el tamaño sin rotar: lo corregimos
      const girada = (meta.orientation || 1) >= 5;
      entrada.ancho = girada ? meta.height : meta.width;
      entrada.alto = girada ? meta.width : meta.height;
      entrada.variantes = await crearVariantes(ruta);
    }
    lista.push(entrada);
  }
  await writeFile(rutaJSON, JSON.stringify(lista, null, 2) + '\n');
}

// --- Programa principal ---
const carpetas = (await readdir(CARPETA_FOTOS, { withFileTypes: true }))
  .filter((d) => d.isDirectory() && /^dia-\d+$/.test(d.name))
  .map((d) => path.join(CARPETA_FOTOS, d.name))
  .sort();

for (const carpeta of carpetas) await procesarCarpeta(carpeta);

const portada = path.join(CARPETA_FOTOS, 'portada.jpg');
if (sharp && existsSync(portada)) {
  console.log('🖼  portada.jpg');
  const info = await stat(portada);
  if (info.size > 600 * 1024) {
    await mkdir(CARPETA_ORIGINALES, { recursive: true });
    const copia = path.join(CARPETA_ORIGINALES, 'portada.jpg');
    if (!existsSync(copia)) await copyFile(portada, copia);
    const salida = await sharp(copia).rotate()
      .resize({ width: 2400, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true, progressive: true }).toBuffer();
    await writeFile(portada, salida);
    console.log(`   ↓ ${kb(info.size)} → ${kb(salida.length)}`);
  }
}

console.log('\n✅ Listo. Sube los cambios con git (o desde github.com).');
