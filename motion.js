/* =====================================================================
   Motion layer for the portfolio.
   Story: a single red star opens the site, bursts into a field of star
   particles that drift with your scroll, travels down the right-hand guide,
   and re-appears at each section heading. Headlines fall from the top and
   land one by one as a stack (hero + contact); section titles, cards, rows
   and quotes arrange themselves as you reach them.
   Uses the Web Animations API + one <canvas>; no libraries.
   ===================================================================== */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('motion')) return;          // reduced motion / no WAAPI: static site

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var page = $('.page');
  var mqMobile = window.matchMedia('(max-width: 767px)');
  var zoom = function () { return parseFloat(page.style.zoom) || 1; };
  var visible = function (el) { return el && el.getClientRects().length > 0; };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  var EASE_OUT = 'cubic-bezier(.2,.8,.2,1)';
  var EASE_FALL = 'cubic-bezier(.55,0,.85,.35)';           // accelerate like gravity

  /* ---------------------------------------------------------------
     STAR PARTICLES (fixed canvas over the page, pointer-events none)
     --------------------------------------------------------------- */
  var Stars = (function () {
    var cv = $('.stars-canvas');
    var ctx = cv.getContext('2d');
    var W = 0, H = 0, dpr = 1, last = 0, scrollPrev = window.scrollY, scrollVel = 0;
    var mouse = { x: -9999, y: -9999 };
    var parts = [];
    var RED = '220,0,22', WHITE = '255,255,255';

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function rand(a, b) { return a + Math.random() * (b - a); }

    // The Figma star: 4 points, inner corners at 0.3408 of the radius
    function drawStar(x, y, r, rot, color, a) {
      var k = 0.3408 * r;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(k, -k); ctx.lineTo(r, 0); ctx.lineTo(k, k);
      ctx.lineTo(0, r); ctx.lineTo(-k, k); ctx.lineTo(-r, 0); ctx.lineTo(-k, -k);
      ctx.closePath();
      ctx.fillStyle = 'rgba(' + color + ',' + a + ')';
      ctx.fill();
      ctx.restore();
    }

    function ambient(fromCenter) {
      var depth = rand(0.25, 1);
      var p = {
        kind: 'amb',
        x: fromCenter ? W / 2 : rand(0, W), y: fromCenter ? H / 2 : rand(0, H),
        vx: rand(-0.12, 0.12) * depth, vy: rand(-0.18, -0.04) * depth,
        r: rand(1.1, 3.2) * depth + 0.6, rot: rand(0, Math.PI), vr: rand(-0.01, 0.01),
        depth: depth, color: Math.random() < 0.2 ? RED : WHITE,
        base: rand(0.18, 0.55) * depth + 0.08, phase: rand(0, 6.28), tw: rand(0.6, 1.8),
        fade: fromCenter ? 0 : 1
      };
      if (fromCenter) {                                        // flung out by the intro burst, then settles
        var ang = rand(0, 6.28), sp = rand(4, 14) * depth;
        p.vx2 = Math.cos(ang) * sp; p.vy2 = Math.sin(ang) * sp;
      }
      return p;
    }

    function seed(fromCenter) {
      var n = mqMobile.matches ? 26 : 56;
      for (var i = 0; i < n; i++) parts.push(ambient(fromCenter));
    }

    function burst(x, y, n, opt) {
      opt = opt || {};
      for (var i = 0; i < n; i++) {
        var ang = opt.up ? rand(Math.PI * 1.05, Math.PI * 1.95) : rand(0, 6.28);
        var sp = rand(opt.min || 1.5, opt.max || 6);
        parts.push({
          kind: 'burst', x: x, y: y,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          r: rand(opt.rmin || 1.2, opt.rmax || 3.6), rot: rand(0, 3.14), vr: rand(-0.08, 0.08),
          color: Math.random() < (opt.red == null ? 0.6 : opt.red) ? RED : WHITE,
          life: 1, decay: rand(0.012, 0.024), depth: 1
        });
      }
    }

    function tick(t) {
      requestAnimationFrame(tick);
      if (document.hidden) return;
      var dt = Math.min(2, (t - last) / 16.67 || 1); last = t;
      var sy = window.scrollY, dy = sy - scrollPrev; scrollPrev = sy;
      scrollVel += (dy - scrollVel) * 0.2;
      ctx.clearRect(0, 0, W, H);
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        if (p.kind === 'amb') {
          if (p.vx2 != null) {                                  // intro fling
            p.x += p.vx2 * dt; p.y += p.vy2 * dt; p.vx2 *= 0.93; p.vy2 *= 0.93;
            if (Math.abs(p.vx2) + Math.abs(p.vy2) < 0.05) { p.vx2 = null; }
          }
          p.x += p.vx * dt;
          p.y += (p.vy - scrollVel * 0.45 * p.depth) * dt;      // parallax against scroll
          p.rot += p.vr * dt + scrollVel * 0.002;
          var mx = p.x - mouse.x, my = p.y - mouse.y, d2 = mx * mx + my * my;
          if (d2 < 14400) { var f = (1 - d2 / 14400) * 1.6; p.x += (mx / Math.sqrt(d2 + 1)) * f; p.y += (my / Math.sqrt(d2 + 1)) * f; }
          if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
          if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
          if (p.fade < 1) p.fade = Math.min(1, p.fade + 0.02 * dt);
          var a = p.base * (0.55 + 0.45 * Math.sin(t / 1000 * p.tw + p.phase)) * p.fade;
          var stretch = 1 + Math.min(2.5, Math.abs(scrollVel) * 0.04 * p.depth);
          drawStar(p.x, p.y, p.r * stretch, p.rot, p.color, a);
        } else {
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.vx *= 0.95; p.vy = p.vy * 0.95 + 0.05 * dt;
          p.rot += p.vr * dt; p.life -= p.decay * dt;
          if (p.life <= 0) { parts.splice(i, 1); continue; }
          drawStar(p.x, p.y, p.r * (0.6 + 0.4 * p.life), p.rot, p.color, p.life * 0.9);
        }
      }
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; } }, { passive: true });
    document.addEventListener('pointerleave', function () { mouse.x = mouse.y = -9999; });
    requestAnimationFrame(tick);
    return { burst: burst, seed: seed, size: function () { return { W: W, H: H }; } };
  })();

  /* ---------------------------------------------------------------
     Building blocks
     --------------------------------------------------------------- */
  function done(el, anim) {
    var fin = function () { el.classList.add('is-in'); try { anim.cancel(); } catch (e) {} };
    anim.onfinish = fin;
    anim.oncancel = function () { el.classList.add('is-in'); };
    // Safety: never leave content hidden, even if the browser drops the animation
    var end = anim.effect && anim.effect.getComputedTiming ? anim.effect.getComputedTiming().endTime : 3000;
    setTimeout(function () { if (!el.classList.contains('is-in')) fin(); }, (end || 3000) + 400);
    return anim;
  }

  // Falls from above the viewport, lands with a small squash and bounce.
  function drop(el, delay, onLand) {
    if (!el) return 0;
    el.classList.add('m-drop');
    var r = el.getBoundingClientRect();
    var dist = Math.max(260, (r.bottom + 80) / zoom() * 1.15);   // start fully above the viewport
    var dur = 1150;
    done(el, el.animate([
      { translate: '0 ' + (-dist) + 'px', scale: '0.96 1.08', opacity: 0, easing: EASE_FALL },
      { opacity: 1, offset: 0.2, easing: EASE_FALL },
      { translate: '0 0', scale: '1 1', opacity: 1, offset: 0.56, easing: 'ease-out' },
      { translate: '0 0', scale: '1.04 0.93', offset: 0.66, easing: 'ease-out' },
      { translate: '0 -12px', scale: '0.99 1.02', offset: 0.8, easing: 'ease-in' },
      { translate: '0 0', scale: '1 1', opacity: 1 }
    ], { duration: dur, delay: delay, fill: 'backwards' }));
    if (onLand) setTimeout(function () { onLand(el); }, delay + dur * 0.56);
    return dur;
  }

  // Lands with a puff of star dust along the bottom edge of the word.
  function puff(el) {
    if (!visible(el)) return;
    var r = el.getBoundingClientRect();
    Stars.burst(r.left + r.width * 0.5, r.bottom - r.height * 0.12, mqMobile.matches ? 8 : 16,
      { up: true, min: 1.5, max: 5, rmin: 1, rmax: 2.6, red: 0.45 });
  }

  function pop(el, delay) {
    if (!el) return;
    el.classList.add('m-drop');
    done(el, el.animate([
      { scale: '0', rotate: '-30deg', opacity: 0 },
      { scale: '1.18', rotate: '6deg', opacity: 1, offset: 0.6 },
      { scale: '1', rotate: '0deg', opacity: 1 }
    ], { duration: 700, delay: delay, easing: EASE_OUT, fill: 'backwards' }));
  }

  function rise(el, delay, o) {
    if (!el) return;
    o = o || {};
    el.classList.add('m-rise');
    done(el, el.animate([
      { translate: (o.x || 0) + 'px ' + (o.y == null ? 48 : o.y) + 'px', opacity: 0, rotate: (o.rot || 0) + 'deg' },
      { translate: '0 0', opacity: 1, rotate: '0deg' }
    ], { duration: o.dur || 1000, delay: delay, easing: o.ease || EASE_OUT, fill: 'backwards' }));
  }

  function fade(el, delay, o) {
    if (!el) return;
    o = o || {};
    el.classList.add('m-fade');
    done(el, el.animate([
      { opacity: 0, scale: o.from || '1.12' },
      { opacity: 1, scale: '1' }
    ], { duration: o.dur || 1800, delay: delay, easing: EASE_OUT, fill: 'backwards' }));
  }

  // Run fn once when el scrolls into view.
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      var fn = e.target.__onView; e.target.__onView = null;
      if (fn) fn(e.target);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  var watched = [];
  function onView(el, fn) { if (!el) return; el.__onView = fn; io.observe(el); watched.push(el); }
  // Fast scrolls and jump links can skip past an element between frames: anything
  // already above the bottom of the screen is played straight away.
  function sweep() {
    if (!root.classList.contains('intro-done')) return;
    var vh = window.innerHeight;
    watched = watched.filter(function (el) {
      if (!el.__onView) return false;
      if (el.getBoundingClientRect().top < vh) { io.unobserve(el); var fn = el.__onView; el.__onView = null; fn(el); return false; }
      return true;
    });
  }

  /* ---------------------------------------------------------------
     Pre-hide everything that animates in (the intro veil covers this)
     --------------------------------------------------------------- */
  var heroDesk = ['.hero__design', '.hero__building', '.hero__im', '.hero__at'].map(function (s) { return $(s); });
  var heroMob = ['.hero-m__design', '.hero-m__building', '.hero-m__im', '.hero-m__at'].map(function (s) { return $(s); });
  var heroIcons = [$('.hero__stage .app-icon'), $('.app-icon--m')];
  var contactDesk = ['.contact__great', '.contact__something', '.contact__lets'].map(function (s) { return $(s); });
  var contactMob = ['.contact-m__great', '.contact-m__something', '.contact-m__lets'].map(function (s) { return $(s); });
  var contactEmail = [$('.contact__email'), $('.contact-m__email')];
  heroDesk.concat(heroMob, heroIcons, contactDesk, contactMob, contactEmail).forEach(function (el) { if (el) el.classList.add('m-drop'); });
  [$('.hero__watermark-rot'), $('.hero-m__wm'), $('.contact__watermark-rot'), $('.contact-m__wm'), $('.scroll'), $('.nav')].forEach(function (el) { if (el) el.classList.add('m-fade'); });
  $$('.sec-head__red, .sec-head__white, .sec-head__meta, .sec-head__title .star, .card, .job, .quote, .footer__link').forEach(function (el) { el.classList.add('m-rise'); });

  /* ---------------------------------------------------------------
     HERO: words fall and stack from the bottom up
     --------------------------------------------------------------- */
  function playHero() {
    var nav = $('.nav');
    nav.classList.add('m-fade');
    done(nav, nav.animate([{ translate: '0 -100%', opacity: 0 }, { translate: '0 0', opacity: 1 }],
      { duration: 900, delay: 150, easing: EASE_OUT, fill: 'backwards' }));
    fade($('.hero__watermark-rot'), 0, { from: '1.18', dur: 2200 });
    fade($('.hero-m__wm'), 0, { from: '1.18', dur: 2200 });

    var words = mqMobile.matches ? heroMob : heroDesk;
    var other = mqMobile.matches ? heroDesk : heroMob;
    other.concat(mqMobile.matches ? [heroIcons[0]] : [heroIcons[1]]).forEach(function (el) { if (el) el.classList.add('is-in'); });
    var t = 250;
    words.forEach(function (el, i) {
      drop(el, t, puff);
      t += i < 2 ? 330 : 260;
    });
    pop(mqMobile.matches ? heroIcons[1] : heroIcons[0], t + 380);
    var sc = $('.scroll');
    done(sc, sc.animate([{ opacity: 0, translate: '0 12px' }, { opacity: 1, translate: '0 0' }],
      { duration: 900, delay: t + 700, easing: EASE_OUT, fill: 'backwards' }));
  }

  /* ---------------------------------------------------------------
     CONTACT: same falling stack when the footer comes into view
     --------------------------------------------------------------- */
  onView($('.contact'), function () {
    var mob = mqMobile.matches;
    var words = mob ? contactMob : contactDesk;
    (mob ? contactDesk : contactMob).forEach(function (el) { if (el) el.classList.add('is-in'); });
    fade(mob ? $('.contact-m__wm') : $('.contact__watermark-rot'), 0, { from: '1.15', dur: 2000 });
    (mob ? $('.contact__watermark-rot') : $('.contact-m__wm')).classList.add('is-in');
    var t = 100;
    words.forEach(function (el, i) { drop(el, t, puff); t += i < 1 ? 330 : 280; });
    var em = mob ? contactEmail[1] : contactEmail[0];
    (mob ? contactEmail[0] : contactEmail[1]).classList.add('is-in');
    rise(em, t + 450, { y: 24, dur: 900 });
  });

  /* ---------------------------------------------------------------
     SECTION HEADINGS: white word rises, red word drops onto it,
     the star spins in and sheds a few particles
     --------------------------------------------------------------- */
  $$('.sec-head__title').forEach(function (title) {
    // On mobile the title box is display:contents (no box to observe), so watch its heading block
    onView(title.closest('.sec-head') || title.parentElement, function () {
      var white = $('.sec-head__white', title), red = $('.sec-head__red', title), star = $('.star', title);
      var meta = title.parentElement && $('.sec-head__meta', title.parentElement);
      rise(meta, 0, { x: -24, y: 0, dur: 900 });
      rise(white, 80, { y: 70, dur: 1000 });
      rise(red, 380, { y: -90, dur: 1100, ease: 'cubic-bezier(.3,1.35,.5,1)' });
      star.classList.add('m-rise');
      done(star, star.animate([
        { scale: '0', rotate: '-270deg', opacity: 0 },
        { scale: '1.35', rotate: '20deg', opacity: 1, offset: 0.7 },
        { scale: '1', rotate: '0deg', opacity: 1 }
      ], { duration: 1100, delay: 700, easing: EASE_OUT, fill: 'backwards' }));
      setTimeout(function () {
        if (!visible(star)) return;
        var r = star.getBoundingClientRect();
        Stars.burst(r.left + r.width / 2, r.top + r.height / 2, mqMobile.matches ? 12 : 22, { min: 1, max: 5, red: 0.8 });
      }, 700 + 770);
    });
  });

  /* ---------------------------------------------------------------
     CARDS, EXPERIENCE ROWS, QUOTES, FOOTER: staggered arrangement
     --------------------------------------------------------------- */
  function staggerGroup(items, opts) {
    var queue = [], timer = null;
    items.forEach(function (el) {
      onView(el, function () {
        queue.push(el);
        if (!timer) timer = setTimeout(function () {
          queue.forEach(function (q, i) { opts.play(q, i * opts.gap); });
          queue = []; timer = null;
        }, 30);
      });
    });
  }
  staggerGroup($$('.card'), {
    gap: 140,
    play: function (card, d) {
      rise(card, d, { y: 90, dur: 1100 });
      $$('.card__crop .crop', card).forEach(function (img) {
        img.animate([{ scale: '1.18' }, { scale: '1' }], { duration: 1600, delay: d, easing: EASE_OUT });
      });
    }
  });
  staggerGroup($$('.job'), {
    gap: 90,
    play: function (row, d) {
      if (row.classList.contains('job--current')) {
        row.classList.add('m-rise');
        done(row, row.animate([
          { clipPath: 'inset(0 100% 0 0)', opacity: 1 },
          { clipPath: 'inset(0 0% 0 0)', opacity: 1 }
        ], { duration: 1000, delay: d, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'backwards' }));
        $$('.job__left > *, .job__right-stack > *', row).forEach(function (c, i) {
          c.animate([{ translate: '0 30px', opacity: 0 }, { translate: '0 0', opacity: 1 }],
            { duration: 800, delay: d + 350 + i * 90, easing: EASE_OUT, fill: 'backwards' });
        });
      } else {
        rise(row, d, { y: 50, dur: 900 });
      }
    }
  });
  // Quotes live in a sideways row (some start off-screen), so the row triggers them all.
  onView($('.reco__row'), function (row) {
    var qs = $$('.quote', row).sort(function (a, b) { return a.getBoundingClientRect().left - b.getBoundingClientRect().left; });
    qs.forEach(function (q, i) { rise(q, i * 160, { x: 140, y: 0, dur: 1100, rot: 3 }); });
  });
  staggerGroup($$('.footer__link'), { gap: 90, play: function (a, d) { rise(a, d, { y: 20, dur: 700 }); } });

  /* ---------------------------------------------------------------
     SCROLL: parallax watermarks, guide star, its trail
     --------------------------------------------------------------- */
  var guide = $('.guide'), heroWm = $('.hero__watermark-rot'), heroWmM = $('.hero-m__wm');
  var cWm = $('.contact__watermark-rot'), cWmM = $('.contact-m__wm'), contact = $('.contact');
  var lastP = -1, ticking = false, trail = 0;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = window.scrollY, z = zoom(), vh = window.innerHeight;
      var max = Math.max(1, document.documentElement.scrollHeight - vh);
      var p = Math.min(1, Math.max(0, y / max));
      var off = Math.min(y, vh * 1.2) / z;
      if (heroWm) heroWm.style.translate = '0 ' + (off * 0.28).toFixed(1) + 'px';
      if (heroWmM) heroWmM.style.translate = '0 ' + (off * 0.28).toFixed(1) + 'px';
      var cr = contact.getBoundingClientRect();
      var drift = ((cr.top - vh * 0.4) / z) * -0.12;
      if (cWm) cWm.style.translate = drift.toFixed(1) + 'px 0';
      if (cWmM) cWmM.style.translate = drift.toFixed(1) + 'px 0';
      if (guide) {
        guide.style.setProperty('--p', p.toFixed(4));
        guide.style.setProperty('--spin', (p * 900).toFixed(1) + 'deg');
        if (lastP >= 0 && Math.abs(p - lastP) > 0.0006 && visible(guide) && (trail++ % 2 === 0)) {
          var gr = $('.guide__star', guide).getBoundingClientRect();
          Stars.burst(gr.left + gr.width / 2, gr.top + gr.height / 2, 1, { min: 0.3, max: 1.4, rmin: 1, rmax: 2.2, red: 0.85 });
        }
      }
      lastP = p;
      sweep();
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* ---------------------------------------------------------------
     INTRO: dark screen, the star appears, spins, and opens the site
     --------------------------------------------------------------- */
  var intro = $('.intro'), veil = $('.intro__veil'), istar = $('.intro__star'), iword = $('.intro__word');
  var skipped = false, finished = false;

  function openHole(dur) {
    return new Promise(function (res) {
      var end = Math.hypot(window.innerWidth, window.innerHeight) / 2 + 40, t0 = performance.now();
      (function step(now) {
        var k = Math.min(1, (now - t0) / dur);
        var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;   // easeInOutCubic
        veil.style.setProperty('--hole', (e * end).toFixed(1) + 'px');
        if (k < 1) requestAnimationFrame(step); else res();
      })(t0);
    });
  }

  function finishIntro() {
    if (finished) return; finished = true;
    root.classList.remove('intro-running');
    root.classList.add('intro-done');
    window.dispatchEvent(new Event('resize'));   // scrollbar is back: re-fit the page width
    onScroll();
  }

  async function runIntro() {
    var fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    istar.animate([
      { opacity: 0, scale: '0.2', rotate: '-180deg' },
      { opacity: 1, scale: '1', rotate: '0deg' }
    ], { duration: 900, easing: EASE_OUT, fill: 'forwards' });
    iword.animate([{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }],
      { duration: 700, delay: 250, easing: EASE_OUT, fill: 'forwards' });
    await wait(skipped ? 0 : 900);
    await fontsReady;
    if (!skipped) {
      istar.animate([
        { rotate: '0deg', scale: '1', filter: 'drop-shadow(0 0 0 rgba(220,0,22,0))' },
        { rotate: '200deg', scale: '1.28', filter: 'drop-shadow(0 0 28px rgba(220,0,22,.9))', offset: 0.55 },
        { rotate: '360deg', scale: '0.86', filter: 'drop-shadow(0 0 10px rgba(220,0,22,.6))' }
      ], { duration: 650, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' });
      await wait(620);
    }
    // Burst: the star becomes the particle field
    var c = Stars.size();
    Stars.burst(c.W / 2, c.H / 2, mqMobile.matches ? 40 : 80, { min: 3, max: 16, rmin: 1.5, rmax: 5, red: 0.7 });
    Stars.seed(true);
    iword.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
    istar.animate([
      { rotate: '360deg', scale: '0.86', opacity: 1 },
      { rotate: '540deg', scale: '16', opacity: 0 }
    ], { duration: 900, easing: 'cubic-bezier(.7,0,.84,0)', fill: 'forwards' });
    setTimeout(playHero, 180);
    await openHole(1000);
    finishIntro();
  }

  intro.addEventListener('click', function () { skipped = true; });
  // Navigating to an in-page anchor (e.g. #work) skips the intro
  if (location.hash && location.hash !== '#top') { skipped = true; }

  runIntro().catch(function () {
    finishIntro();
    $$('.m-drop, .m-rise, .m-fade').forEach(function (el) { el.classList.add('is-in'); });
  });
})();
