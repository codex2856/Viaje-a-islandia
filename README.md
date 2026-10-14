# Islandia · 5 días de hielo y fuego

Blog estático del viaje a Islandia (30 de enero – 3 de febrero de 2027).
HTML, CSS y JavaScript puro: **sin frameworks y sin paso de build**.

🌐 Web: https://codex2856.github.io/Viaje-a-islandia/

---

## Estructura

```
/
├── index.html          Pestaña «El viaje»: portada, mapa y cómo va a ser el viaje
├── diario.html         Pestaña «Diario»: los 5 días seguidos, con texto y fotos
├── resumen.html        Pestaña «Resumen»: se escribe al volver
├── dia.html            Página de un día suelto (dia.html?n=1 … ?n=5) con mapa y galería
├── datos-viaje.json    Enlaces, resumen final (al volver) y trazado de la ruta
├── entradas/           Un Markdown por día (dia-1.md … dia-5.md)
├── fotos/
│   ├── portada.jpg     (opcional) fondo del hero
│   ├── og.jpg          imagen al compartir el enlace
│   └── dia-1/ … dia-5/ fotos de cada día + fotos.json
├── css/estilos.css     Todo el diseño (con índice al principio)
├── js/
│   ├── datos.js        Lee JSON y Markdown (parser de front matter y Markdown hecho a mano)
│   ├── efectos.js      Scroll, parallax, cursor, transiciones, menú inferior
│   ├── cielo.js        Aurora, estrellas y nieve en <canvas> (un solo bucle a 20 fps)
│   ├── mapa.js         Mapas Leaflet (se cargan solo cuando van a verse)
│   ├── galeria.js      Mosaico + visor con gestos
│   ├── inicio.js       Lógica de index.html
│   ├── diario.js       Lógica de diario.html
│   ├── resumen.js      Lógica de resumen.html
│   └── dia.js          Lógica de dia.html
├── generar.js          (opcional) comprime fotos, crea WebP y fotos.json
└── .nojekyll           Evita que GitHub Pages procese los .md con Jekyll
```

## 1. Probarlo en local

Los navegadores no dejan leer archivos con `fetch()` si abres `index.html` con doble clic
(`file://`), así que hace falta un servidor local. Cualquiera de estos vale:

```bash
# Opción A (Node)
npx http-server -c-1 -p 8080 .
# Opción B (Python)
python3 -m http.server 8080
# Opción C: extensión "Live Server" de VS Code → botón "Go Live"
```

Abre http://localhost:8080.

Trucos para probar:

- `dia.html?n=2&borrador=1` → enseña el texto aunque el día tenga `publicado: false`.
- `index.html?hoy=2027-01-31` → simula esa fecha (la cuenta atrás pasa a "Día 2 de 5").

## 2. Publicar en GitHub Pages

1. Sube el código a la rama `main` del repositorio `codex2856/Viaje-a-islandia`.
2. En GitHub: **Settings → Pages**.
3. En *Build and deployment*: **Source = Deploy from a branch**, **Branch = `main`**, carpeta **`/ (root)`** → *Save*.
4. Espera 1–2 minutos. La web queda en `https://codex2856.github.io/Viaje-a-islandia/`.

Cada vez que hagas un commit en `main`, GitHub vuelve a publicar solo (tarda ~1 minuto).

> Si cambias el nombre del repositorio, actualiza las URLs absolutas de `index.html`
> (`og:url`, `og:image`, `canonical`), `dia.html`, `robots.txt`, `sitemap.xml` y el bloque
> `"repositorio"` de `datos-viaje.json`.

## 3. Escribir una entrada cada noche desde el móvil

Todo se hace desde el navegador del móvil en **github.com** (no hace falta ordenador):

**Texto**

1. Entra en el repositorio → carpeta `entradas` → `dia-N.md`.
2. Pulsa el lápiz ✏️ (*Edit this file*).
3. Escribe debajo del segundo `---`, como un diario: «Hoy el día empezó…». Puedes usar:
   - `## Título de apartado`
   - `**negrita**`, `*cursiva*`, `[enlace](https://…)`
   - `> cita destacada`
   - `- elemento de lista`
   - **Fotos dentro del texto**: en una línea sola, `![Lo que pone debajo de la foto](IMG_1234.jpg)`.
     Basta con el nombre del archivo: se busca solo en `fotos/dia-N/`. Ponla donde quieras
     que aparezca, entre párrafos. Al tocarla se ve a pantalla completa.
4. Cambia `publicado: false` → `publicado: true` y revisa `lo_mejor`.
5. Pulsa **Commit changes**. En un minuto está publicado.

**Fotos**

1. Ve a la carpeta `fotos/dia-N` → **Add file → Upload files** → elige las fotos → *Commit*.
2. Escribe en el texto `![pie](nombre-de-la-foto.jpg)` donde quieras que salga cada una.
3. Las fotos de la carpeta que no pongas en el texto aparecen en la galería de la página
   del día (dia.html?n=N), que la web encuentra sola (usa la API pública de GitHub).
3. *(Opcional)* si quieres decidir el orden y poner pies de foto, añádelas al front matter:

   ```yaml
   fotos:
     - archivo: "IMG_1234.jpg"
       pie: "Strokkur a punto de estallar"
     - archivo: "IMG_1240.jpg"
       pie: "Gullfoss medio congelada"
   portada: "IMG_1240.jpg"   # foto de cabecera del día (si no, usa la primera)
   ```

**Antes de publicar** puedes revisar el texto en `dia.html?n=N&borrador=1`.

> 📱 En iPhone, ve a *Ajustes → Cámara → Formatos → Más compatible* para que las fotos
> sean JPG y no HEIC (los navegadores no muestran HEIC).

### Campos del front matter

| Campo | Ejemplo | Para qué sirve |
|---|---|---|
| `titulo` | `"El Círculo Dorado"` | Título del día |
| `fecha` | `2027-01-31` | Fecha (AAAA-MM-DD) |
| `lugar` | `"Þingvellir · Geysir"` | Subtítulo con el lugar |
| `lat`, `lng` | `64.31`, `-20.30` | Punto principal del día |
| `amanecer`, `atardecer` | `"10:05"` | Gráfico de horas de luz |
| `lo_mejor` | `"Ver a Strokkur…"` | Cita destacada en la tarjeta |
| `resumen` | `"Dos placas…"` | Texto corto del itinerario |
| `publicado` | `true` / `false` | `false` = tarjeta "Próximamente" con escarcha |
| `paradas` | lista | Marcadores del mapa (`nombre`, `lat`, `lng`, `confirmada`) |
| `fotos` | lista (opcional) | Orden y pies de foto |
| `portada` | `"foto.jpg"` (opcional) | Foto de cabecera del día y fondo de su tarjeta |
| `portada_credito` | `"Foto: …"` (opcional) | Autor/licencia (solo para fotos que no son tuyas) |

Con `confirmada: false` la parada sale en el mapa con borde discontinuo y más transparente.

### Las tres pestañas

- **El viaje** (`index.html`): portada, mapa de la ruta, itinerario, horas de luz y enlaces.
- **Diario** (`diario.html`): los 5 días seguidos, con un índice arriba para saltar a cada uno.
  Los días con `publicado: false` salen como «Próximamente».
- **Resumen** (`resumen.html`): mientras `resumen.publicado` sea `false` en
  `datos-viaje.json` solo dice «lo escribiré al volver». Al volver se rellenan `intro`,
  `lo_mejor`, `costes` (`[{ "concepto": "Vuelos", "real": 160 }]`), `consejos` y
  `top_fotos`, y se pone `publicado: true`. Lo que esté vacío no se muestra.

Cuidado con las comas en `datos-viaje.json`: si tiene un error, la consola del navegador lo indica.

## Fotos de ejemplo (Wikimedia Commons)

Hasta que tengas tus fotos, la portada y la cabecera de cada día
usan fotos con licencia libre de [Wikimedia Commons](https://commons.wikimedia.org),
enlazadas directamente y con su crédito (autor y licencia), como piden sus licencias.

En cualquier campo de foto puedes escribir `commons:Nombre del archivo.jpg` (el nombre
que aparece en la página del archivo en Commons) y la web la carga a la medida justa.

Para usar **tus** fotos:

- Portada: sube `fotos/portada.jpg` (tiene prioridad sobre la de ejemplo).
- Cada día: cambia `portada: "commons:…"` por `portada: "IMG_1234.jpg"` y borra `portada_credito`.
- Fotos favoritas del resumen: en `datos-viaje.json`, en `top_fotos`.

Si un nombre de Commons está mal escrito, la foto simplemente no aparece (no se rompe nada).

## Diseño mixto: noche → día → noche

La portada, el mapa y el pie son "de noche" (fondo oscuro con aurora). Las secciones
de lectura llevan la clase `tema-claro` (fondo blanco nieve) y se enlazan con degradados
de amanecer (`amanecer`) y anochecer (`anochecer`). Para cambiar una sección de tema,
basta con añadir o quitar esa clase en el HTML: los colores se ajustan solos
(sección 15 de `css/estilos.css`).

## Rendimiento: por qué el cielo va en canvas

Las animaciones CSS infinitas (aurora, estrellas, niebla…) obligan al navegador a
redibujar la pantalla 60 veces por segundo y disparan el uso de CPU. Por eso todo el
cielo animado se dibuja en `js/cielo.js` con un solo bucle a 20 fotogramas/s, la aurora
en un canvas diminuto que el navegador amplía (y suaviza) gratis, y todo se pausa cuando
no está en pantalla o la pestaña está oculta. Los pulsos del mapa se repiten 3 veces y paran.

## 4. Fotos: optimizarlas (opcional, desde un ordenador)

```bash
npm install        # instala sharp (solo la primera vez)
node generar.js
```

Reduce las fotos enormes del móvil a 2000 px (guardando el original en `fotos/originales/`,
que git ignora), crea versiones WebP de 800 y 1600 px y escribe `fotos/dia-N/fotos.json`
con tamaños y versiones. La web usa entonces `<picture>` + `srcset`, así el móvil descarga
la versión pequeña. Sin este paso todo funciona igual, solo que con las fotos originales.

## Fotos que conviene tener preparadas

| Foto | Tamaño recomendado | Notas |
|---|---|---|
| `fotos/portada.jpg` | 2400 × 1600 px (horizontal 3:2), < 600 KB | Paisaje amplio con cielo; el título va encima, mejor con zona central limpia y oscura |
| Una por día (`portada:` en el front matter) | 2000 × 1333 px (3:2) | Se recorta en horizontal en la cabecera del día |
| Galería | lado mayor 2000 px | Mezcla verticales y horizontales para que el mosaico luzca |
| `fotos/og.jpg` | 1200 × 630 px | Ya incluida (generada a partir del hero); cámbiala por una foto real si quieres |

Ideas: día 1 la carretera de lava hacia Reikiavik, día 2 Strokkur o Gullfoss, día 3
Skógafoss o la lava del show, día 4 las columnas de basalto de Reynisfjara, día 5 Reikiavik
desde Hallgrímskirkja.

## Accesibilidad y rendimiento

- `prefers-reduced-motion`: sin nieve, sin parallax y sin animaciones.
- Contraste AA, foco visible, enlace "saltar al contenido", visor con `<dialog>`.
- Leaflet y las teselas se cargan solo cuando el mapa está a punto de verse.
- La nieve se pausa si la pestaña está oculta o el hero no se ve.
