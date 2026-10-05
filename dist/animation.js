'use strict';

/** A single 240-column sheet. Every source frame retains its 16:9 composition. */
(() => {
  const config = Object.freeze({
    count: 240, width: 640, height: 360, idle: 87,
    followTime: 0.115, returnTime: 0.58,
    poses: [
      [0, 0, 0], [23, -1, 0], [36, -0.9, 1], [49, -1, 0],
      [64, -1, -1], [74, -0.6, -0.8], [87, 0, 0],
      [106, 1, 0], [126, 0.8, 1], [133, 0, 0.8],
      [144, 1, 0], [160, 0.85, -1], [169, 0, -0.9],
      [186, 0, 0], [239, 0, 0]
    ]
  });
  const hero = document.getElementById('hero');
  const canvas = document.getElementById('portrait');
  const ctx = canvas.getContext('2d', { alpha: false });
  const button = document.getElementById('motion-toggle');
  const label = document.getElementById('motion-label');
  const status = document.getElementById('portrait-status');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const sheet = new Image();
  let ready = false;
  let enabled = !media.matches;
  let explicitMotionPreference = false;
  let inside = false;
  let visible = true;
  let current = config.idle;
  let target = config.idle;
  let raf = 0;
  let previousTime = 0;
  let returning = null;
  let keyboard = { x: 0, y: 0 };
  let rect = hero.getBoundingClientRect();
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);

  // Map screen-space gaze to the clip's authored head poses. A neutral dead zone
  // prevents jitter. The original clip is a pose tour, not a linear left/right pan.
  function frameForPosition(x, y) {
    x = clamp(x, -1, 1);
    y = clamp(y, -1, 1);
    if (Math.hypot(x, y) < 0.055) return config.idle;
    let bestScore = Infinity;
    let result = config.idle;
    // Project the desired gaze onto the clip's calibrated pose path. This avoids
    // treating intermediate downward poses as an upward look when scrubbing time.
    for (let i = 0; i < config.poses.length - 1; i++) {
      const [frameA, ax, ay] = config.poses[i];
      const [frameB, bx, by] = config.poses[i + 1];
      const dx = bx - ax, dy = by - ay;
      const length = dx * dx + dy * dy;
      if (!length) continue;
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / length, 0, 1);
      const frame = mix(frameA, frameB, t);
      const distance = (x - mix(ax, bx, t)) ** 2 + (y - mix(ay, by, t)) ** 2;
      // Repeated poses favor the closest place in the clip, reducing needless tours.
      const score = distance + Math.abs(frame - current) * 0.000015;
      if (score < bestScore) { bestScore = score; result = frame; }
    }
    return clamp(result, 0, config.count - 1);
  }

  // Draw only the two neighboring cells, then blend their fractional contribution.
  // No enormous background element, timers, video seeking, or DOM frame updates.
  function draw(frame) {
    const value = clamp(frame, 0, config.count - 1);
    const lower = Math.floor(value);
    const upper = Math.min(lower + 1, config.count - 1);
    const fraction = value - lower;
    ctx.globalAlpha = 1;
    ctx.drawImage(sheet, lower * config.width, 0, config.width, config.height,
      0, 0, canvas.width, canvas.height);
    if (fraction > 0.001 && upper !== lower) {
      ctx.globalAlpha = fraction;
      ctx.drawImage(sheet, upper * config.width, 0, config.width, config.height,
        0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
  }

  function wake() {
    if (ready && visible && !document.hidden && !raf) {
      previousTime = 0;
      raf = requestAnimationFrame(tick);
    }
  }

  function tick(time) {
    raf = 0;
    const dt = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 1 / 60;
    previousTime = time;
    if (returning) {
      if (returning.start === null) returning.start = time;
      const elapsed = clamp((time - returning.start) / (config.returnTime * 1000), 0, 1);
      current = mix(returning.from, config.idle, smooth(elapsed));
      if (elapsed === 1) returning = null;
    } else {
      // Exponential damping is invariant to refresh rate (60, 120, or 144 Hz).
      current += (target - current) * (1 - Math.exp(-dt / config.followTime));
      if (Math.abs(current - target) < 0.004) current = target;
    }
    draw(current);
    if (returning || Math.abs(current - target) >= 0.004) raf = requestAnimationFrame(tick);
  }

  function rest() {
    inside = false;
    keyboard = { x: 0, y: 0 };
    target = config.idle;
    returning = { from: current, start: null };
    if (ready) status.textContent = enabled ? 'Ready when you are' : 'A quiet moment';
    wake();
  }

  function updateMotionControl() {
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', `Turn character motion ${enabled ? 'off' : 'on'}`);
    label.textContent = `Motion ${enabled ? 'on' : 'off'}`;
    if (ready) status.textContent = enabled ? 'Ready when you are' : 'A quiet moment';
  }

  function gaze(x, y) {
    if (!ready || !enabled) return;
    if (!inside) status.textContent = 'You have their attention';
    inside = true;
    returning = null;
    target = frameForPosition(x, y);
    wake();
  }

  hero.addEventListener('pointermove', event => {
    if (event.target.closest('button')) return;
    if (event.pointerType === 'touch' && event.buttons === 0) return;
    gaze((event.clientX - rect.left - rect.width / 2) / (rect.width * 0.43),
      (event.clientY - rect.top - rect.height * 0.54) / (rect.height * 0.40));
  }, { passive: true });
  hero.addEventListener('pointerdown', event => {
    if (event.target.closest('button')) return;
    gaze((event.clientX - rect.left - rect.width / 2) / (rect.width * 0.43),
      (event.clientY - rect.top - rect.height * 0.54) / (rect.height * 0.40));
  }, { passive: true });
  hero.addEventListener('pointerleave', rest);
  hero.addEventListener('pointercancel', rest);
  hero.addEventListener('pointerup', event => { if (event.pointerType !== 'mouse') rest(); });
  hero.addEventListener('keydown', event => {
    if (event.target !== hero) return;
    const directions = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.2], ArrowDown: [0, 0.2] };
    if (event.key === 'Escape') { event.preventDefault(); rest(); return; }
    if (!directions[event.key]) return;
    event.preventDefault();
    const [x, y] = directions[event.key];
    keyboard.x = clamp(keyboard.x + x, -1, 1);
    keyboard.y = clamp(keyboard.y + y, -1, 1);
    gaze(keyboard.x, keyboard.y);
  });
  hero.addEventListener('focusout', event => { if (!hero.contains(event.relatedTarget)) rest(); });
  button.addEventListener('pointerenter', rest);
  button.addEventListener('click', () => {
    explicitMotionPreference = true;
    enabled = !enabled;
    // Pausing, and reduced-motion mode, never introduce an automatic return animation.
    if (!enabled) {
      cancelAnimationFrame(raf); raf = 0; returning = null;
      inside = false; current = target = config.idle;
      if (ready) draw(current);
    }
    updateMotionControl();
  });
  media.addEventListener('change', () => {
    if (explicitMotionPreference) return;
    enabled = !media.matches;
    cancelAnimationFrame(raf); raf = 0; returning = null;
    inside = false; current = target = config.idle;
    if (ready) draw(current);
    updateMotionControl();
  });
  new ResizeObserver(() => { rect = hero.getBoundingClientRect(); }).observe(hero);
  window.addEventListener('scroll', () => { rect = hero.getBoundingClientRect(); }, { passive: true });
  window.addEventListener('blur', rest);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf); raf = 0;
      inside = false; returning = null; current = target = config.idle;
      if (ready) draw(current);
    } else wake();
  });
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible) { cancelAnimationFrame(raf); raf = 0; }
    else wake();
  }).observe(hero);

  updateMotionControl();
  sheet.onload = async () => {
    try {
      await sheet.decode();
      if (sheet.naturalWidth !== config.count * config.width || sheet.naturalHeight !== config.height) {
        throw new Error('Unexpected sprite dimensions');
      }
      ready = true;
      draw(config.idle);
      hero.dataset.ready = 'true';
      updateMotionControl();
    } catch (error) { fail(); }
  };
  function fail() {
    ready = false;
    button.disabled = true;
    label.textContent = 'Still portrait';
    status.textContent = 'Enjoy a quiet moment';
  }
  sheet.onerror = fail;
  sheet.src = new URL('assets/character-sprite.png', document.baseURI).href;
})();
