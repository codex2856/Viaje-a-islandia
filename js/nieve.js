/* =====================================================================
   nieve.js · Copos de nieve dibujados en un <canvas>
   ---------------------------------------------------------------------
   Optimizaciones:
   - Pocos copos (según el tamaño de pantalla) y dibujados como círculos
     simples: el canvas es mucho más ligero que cientos de <div>.
   - Se pausa si la pestaña está oculta o si el canvas no se ve
     (IntersectionObserver), así no gasta batería.
   - No se ejecuta si el usuario prefiere movimiento reducido.
   ===================================================================== */

export function iniciarNieve(canvas) {
  if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d');
  let copos = [];
  let ancho = 0;
  let alto = 0;
  let visible = true;
  let animando = false;
  let ultimo = 0;

  // Ajusta el canvas a su tamaño real (y a la densidad de píxeles, máx. 2)
  function redimensionar() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ancho = canvas.clientWidth;
    alto = canvas.clientHeight;
    canvas.width = ancho * dpr;
    canvas.height = alto * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ~1 copo por cada 9000 px² con un máximo de 140
    const cantidad = Math.min(140, Math.round((ancho * alto) / 9000));
    copos = Array.from({ length: cantidad }, () => nuevoCopo(true));
  }

  function nuevoCopo(enCualquierAltura) {
    const profundidad = Math.random(); // 0 = lejos, 1 = cerca
    return {
      x: Math.random() * ancho,
      y: enCualquierAltura ? Math.random() * alto : -10,
      r: 0.6 + profundidad * 2.2,
      vy: 18 + profundidad * 42,           // píxeles por segundo
      deriva: Math.random() * Math.PI * 2, // fase del balanceo lateral
      alfa: 0.25 + profundidad * 0.6,
    };
  }

  function fotograma(t) {
    if (!animando) return;
    const dt = Math.min((t - ultimo) / 1000, 0.05); // segundos desde el último frame
    ultimo = t;

    ctx.clearRect(0, 0, ancho, alto);
    ctx.fillStyle = '#f4fbff';
    for (const c of copos) {
      c.deriva += dt * 0.8;
      c.y += c.vy * dt;
      c.x += Math.sin(c.deriva) * 12 * dt + 6 * dt; // viento suave hacia la derecha
      if (c.y > alto + 10) Object.assign(c, nuevoCopo(false));
      if (c.x > ancho + 10) c.x = -10;

      ctx.globalAlpha = c.alfa;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(fotograma);
  }

  function actualizarEstado() {
    const debeAnimar = visible && document.visibilityState === 'visible';
    if (debeAnimar && !animando) {
      animando = true;
      ultimo = performance.now();
      requestAnimationFrame(fotograma);
    } else if (!debeAnimar) {
      animando = false;
    }
  }

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; actualizarEstado(); }).observe(canvas);
  document.addEventListener('visibilitychange', actualizarEstado);

  let temporizador;
  addEventListener('resize', () => {
    clearTimeout(temporizador);
    // En móvil, la barra del navegador cambia la altura al hacer scroll:
    // solo recalculamos si cambia el ANCHO o la altura de forma notable.
    temporizador = setTimeout(() => {
      if (canvas.clientWidth !== ancho || Math.abs(canvas.clientHeight - alto) > 150) redimensionar();
    }, 200);
  });

  redimensionar();
  actualizarEstado();
}
