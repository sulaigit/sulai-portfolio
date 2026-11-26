/* =====================================================================
   Motion layer for the portfolio.
   - Intro: the red star fades in, breathes, then grows into a star-shaped
     window that opens onto the site.
   - Hero: words fall from the top and land one by one as a stack.
   - Contact: the same stack, falling from the top edge of its own red section.
   - Section headings stack in; work cards slide in from their own side;
     experience rows, quotes and footer links arrange themselves on scroll.
   Uses the Web Animations API only; no libraries, no particles.
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
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  var EASE_OUT = 'cubic-bezier(.16,1,.3,1)';                // easeOutExpo-like: soft landing
  var EASE_FALL = 'cubic-bezier(.55,0,.85,.35)';           // accelerate like gravity

  /* ---------------------------------------------------------------
     SOUND: synthesised block landings (Web Audio, no files).
     Browsers only allow sound after the visitor clicks/taps/presses a key,
     so the audio engine starts on the first such interaction.
     --------------------------------------------------------------- */
  var Sfx = (function () {
    var AC = window.AudioContext || window.webkitAudioContext;
    var ctx = null, master = null, noise = null;
    function init() {
      if (ctx || !AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
      var d = noise.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    }
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, function () { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }, { passive: true, capture: true });
    });
    // weight 0..1: heavier = lower, louder thud
    function land(weight) {
      if (!ctx || ctx.state !== 'running') return;
      var t = ctx.currentTime, w = weight == null ? 0.7 : weight, v = 0.85 + Math.random() * 0.3;
      // 1. body thud: a sine pitch-dropping like a heavy block hitting the floor
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime((95 + 40 * (1 - w)) * v, t);
      o.frequency.exponentialRampToValueAtTime((42 + 20 * (1 - w)) * v, t + 0.16);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9 * (0.5 + w * 0.5), t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3);
      // 2. wooden knock: short band-passed noise burst
      var n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
      n.buffer = noise;
      bp.type = 'bandpass'; bp.frequency.value = (900 + 900 * (1 - w)) * v; bp.Q.value = 1.4;
      ng.gain.setValueAtTime(0.5 * (0.6 + 0.4 * (1 - w)), t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      n.connect(bp); bp.connect(ng); ng.connect(master); n.start(t); n.stop(t + 0.1);
      // 3. settle: the small bounce taps again, softer
      var o2 = ctx.createOscillator(), g2 = ctx.createGain(), t2 = t + 0.19;
      o2.type = 'triangle';
      o2.frequency.setValueAtTime((180 + 60 * (1 - w)) * v, t2);
      o2.frequency.exponentialRampToValueAtTime(90 * v, t2 + 0.06);
      g2.gain.setValueAtTime(0.0001, t2);
      g2.gain.exponentialRampToValueAtTime(0.18, t2 + 0.005);
      g2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.09);
      o2.connect(g2); g2.connect(master); o2.start(t2); o2.stop(t2 + 0.12);
    }
    return { land: land, at: function (ms, weight) { setTimeout(function () { land(weight); }, ms); } };
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

  // Falls `dist` px, lands with a small squash and one soft bounce.
  function drop(el, delay, dist, weight) {
    if (!el) return;
    el.classList.add('m-drop');
    Sfx.at(delay + 1150 * 0.56, weight);                      // thud exactly on impact
    done(el, el.animate([
      { translate: '0 ' + (-dist) + 'px', scale: '0.97 1.06', opacity: 0, easing: EASE_FALL },
      { opacity: 1, offset: 0.18, easing: EASE_FALL },
      { translate: '0 0', scale: '1 1', opacity: 1, offset: 0.56, easing: 'ease-out' },
      { translate: '0 0', scale: '1.035 0.94', offset: 0.66, easing: 'ease-out' },
      { translate: '0 -10px', scale: '0.995 1.015', offset: 0.8, easing: 'ease-in' },
      { translate: '0 0', scale: '1 1', opacity: 1 }
    ], { duration: 1150, delay: delay, fill: 'backwards' }));
  }

  // Hero: start fully above the top of the screen
  function dropFromTop(el, delay, weight) {
    if (!el) return;
    var r = el.getBoundingClientRect();
    drop(el, delay, Math.max(260, (r.bottom + 80) / zoom() * 1.15), weight);
  }

  // Contact: start tucked behind the bottom edge of the testimonial cards and fall out from under them
  function dropFromSection(el, delay, weight) {
    if (!el) return;
    var r = el.getBoundingClientRect(), q = $('.reco__row .quote').getBoundingClientRect();
    drop(el, delay, Math.max(80, (r.bottom - q.bottom + 8) / zoom()), weight);
  }

  function pop(el, delay) {
    if (!el) return;
    el.classList.add('m-drop');
    done(el, el.animate([
      { scale: '0.4', opacity: 0 },
      { scale: '1.08', opacity: 1, offset: 0.6 },
      { scale: '1', opacity: 1 }
    ], { duration: 700, delay: delay, easing: EASE_OUT, fill: 'backwards' }));
  }

  function rise(el, delay, o) {
    if (!el) return;
    o = o || {};
    el.classList.add('m-rise');
    done(el, el.animate([
      { translate: (o.x || 0) + 'px ' + (o.y == null ? 48 : o.y) + 'px', opacity: 0 },
      { translate: '0 0', opacity: 1 }
    ], { duration: o.dur || 1000, delay: delay, easing: o.ease || EASE_OUT, fill: 'backwards' }));
  }

  function fade(el, delay, dur) {
    if (!el) return;
    el.classList.add('m-fade');
    done(el, el.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: dur || 1400, delay: delay, easing: 'ease-out', fill: 'backwards' }));
  }

  // Run fn once when el scrolls into view
  var watched = [];
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      var fn = e.target.__onView; e.target.__onView = null;
      if (fn) fn(e.target);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
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
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { ticking = false; sweep(); });
  }, { passive: true });

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
  [$('.hero__watermark-rot'), $('.hero-m__wm'), $('.contact__watermark-rot'), $('.contact-m__wm'), $('.nav')].forEach(function (el) { if (el) el.classList.add('m-fade'); });
  $$('.sec-head__red, .sec-head__white, .sec-head__meta, .sec-head__title .star, .card, .job, .quote, .footer__link').forEach(function (el) { el.classList.add('m-rise'); });

  /* ---------------------------------------------------------------
     HERO: words fall from the top and stack from the bottom up.
     The SULAI watermark stays put (fades in, never moves).
     --------------------------------------------------------------- */
  function playHero() {
    var nav = $('.nav');
    done(nav, nav.animate([{ translate: '0 -100%', opacity: 0 }, { translate: '0 0', opacity: 1 }],
      { duration: 1000, delay: 250, easing: EASE_OUT, fill: 'backwards' }));
    fade($('.hero__watermark-rot'), 0, 1800);
    fade($('.hero-m__wm'), 0, 1800);

    var mob = mqMobile.matches;
    var words = mob ? heroMob : heroDesk;
    (mob ? heroDesk.concat([heroIcons[0]]) : heroMob.concat([heroIcons[1]])).forEach(function (el) { if (el) el.classList.add('is-in'); });
    var t = 200;
    words.forEach(function (el, i) { dropFromTop(el, t, [1, 0.85, 0.65, 0.35][i]); t += i < 2 ? 320 : 260; });
    Sfx.at(t + 360 + 250, 0.2);                                // app icon pops in
    pop(mob ? heroIcons[1] : heroIcons[0], t + 360);
  }

  /* ---------------------------------------------------------------
     CONTACT: same falling stack, from the top of its red section
     --------------------------------------------------------------- */
  var contact = $('.contact');
  onView(contact, function () {
    var mob = mqMobile.matches;
    (mob ? contactDesk.concat([contactEmail[0]]) : contactMob.concat([contactEmail[1]])).forEach(function (el) { if (el) el.classList.add('is-in'); });
    (mob ? $('.contact__watermark-rot') : $('.contact-m__wm')).classList.add('is-in');
    fade(mob ? $('.contact-m__wm') : $('.contact__watermark-rot'), 0, 1600);
    var t = 150;
    (mob ? contactMob : contactDesk).forEach(function (el, i) { dropFromSection(el, t, [1, 0.85, 0.65][i]); t += i < 1 ? 320 : 280; });
    rise(mob ? contactEmail[1] : contactEmail[0], t + 450, { y: 24, dur: 900 });
  });

  /* ---------------------------------------------------------------
     SECTION HEADINGS: meta slides in, white word rises,
     red word drops onto it; the star simply fades in (no motion)
     --------------------------------------------------------------- */
  $$('.sec-head__title').forEach(function (title) {
    // On mobile the title box is display:contents (no box to observe), so watch its heading block
    onView(title.closest('.sec-head') || title.parentElement, function () {
      var meta = title.parentElement && $('.sec-head__meta', title.parentElement);
      rise(meta, 0, { x: -24, y: 0, dur: 900 });
      rise($('.sec-head__white', title), 80, { y: 70, dur: 1100 });
      rise($('.sec-head__red', title), 380, { y: -90, dur: 1150, ease: 'cubic-bezier(.3,1.3,.5,1)' });
      Sfx.at(80 + 420, 0.75);                                    // white word settles
      Sfx.at(380 + 430, 0.5);                                    // red word stacks on top
      fade($('.star', title), 900, 900);
    });
  });

  /* ---------------------------------------------------------------
     WORK CARDS: left-column cards slide in from the left, right-column
     cards from the right (on mobile they alternate)
     --------------------------------------------------------------- */
  function staggerGroup(items, gap, play) {
    var queue = [], timer = null;
    items.forEach(function (el) {
      onView(el, function () {
        queue.push(el);
        if (!timer) timer = setTimeout(function () {
          queue.forEach(function (q, i) { play(q, i * gap); });
          queue = []; timer = null;
        }, 30);
      });
    });
  }
  var cards = $$('.card');
  staggerGroup(cards, 150, function (card, d) {
    var mob = mqMobile.matches;
    var left = mob ? cards.indexOf(card) % 2 === 0
                   : Array.prototype.indexOf.call(card.parentElement.children, card) === 0;
    rise(card, d, { x: left ? -180 : 180, y: 0, dur: 1200 });
    $$('.card__crop .crop', card).forEach(function (img) {
      img.animate([{ scale: '1.12' }, { scale: '1' }], { duration: 1600, delay: d, easing: EASE_OUT });
    });
  });

  /* ---------------------------------------------------------------
     EXPERIENCE ROWS, QUOTES, FOOTER
     --------------------------------------------------------------- */
  staggerGroup($$('.job'), 90, function (row, d) {
    if (row.classList.contains('job--current')) {
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
  });
  // Quotes live in a sideways row (some start off-screen), so the row triggers them all
  onView($('.reco__row'), function (row) {
    $$('.quote', row).sort(function (a, b) { return a.getBoundingClientRect().left - b.getBoundingClientRect().left; })
      .forEach(function (q, i) { rise(q, i * 160, { x: 140, y: 0, dur: 1100 }); });
  });
  staggerGroup($$('.footer__link'), 90, function (a, d) { rise(a, d, { y: 20, dur: 700 }); });

  /* ---------------------------------------------------------------
     INTRO: dark screen → the star fades in and breathes →
     it grows into a star-shaped window that opens onto the site
     --------------------------------------------------------------- */
  var veil = $('.intro__veil'), istar = $('.intro__star'), iword = $('.intro__word');
  var skipped = false, finished = false;
  var smooth = function (k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };   // easeInOutCubic

  // One rAF timeline drives the star and the window together, so they stay in sync.
  function openStar(dur) {
    return new Promise(function (res) {
      var vmax = Math.max(window.innerWidth, window.innerHeight);
      var endSize = vmax * 7;                                 // star hole big enough to clear the corners
      var t0 = performance.now();
      (function step(now) {
        var k = Math.min(1, (now - t0) / dur);
        var e = smooth(k);
        var size = 86 + (endSize - 86) * Math.pow(e, 1.6);
        var s = size / 86;
        veil.style.setProperty('--hole', size.toFixed(1) + 'px');
        istar.style.transform = 'scale(' + s.toFixed(3) + ') rotate(' + (e * 45).toFixed(2) + 'deg)';
        istar.style.opacity = String(Math.max(0, 1 - e * 3.2));
        if (k < 1) requestAnimationFrame(step); else res();
      })(t0);
    });
  }

  function finishIntro() {
    if (finished) return; finished = true;
    root.classList.remove('intro-running');
    root.classList.add('intro-done');
    window.dispatchEvent(new Event('resize'));   // scrollbar is back: re-fit the page width
    sweep();
  }

  async function runIntro() {
    var fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    if (!skipped) {
      istar.animate([
        { opacity: 0, transform: 'scale(0.55) rotate(-60deg)' },
        { opacity: 1, transform: 'scale(1) rotate(0deg)' }
      ], { duration: 1100, easing: EASE_OUT, fill: 'forwards' });
      iword.animate([
        { opacity: 0, letterSpacing: '2px', textIndent: '2px' },
        { opacity: 1, letterSpacing: '6px', textIndent: '6px' }
      ], { duration: 1200, delay: 200, easing: EASE_OUT, fill: 'forwards' });
      await wait(1150);
      await fontsReady;
      // a single slow breath before opening
      await istar.animate([
        { transform: 'scale(1) rotate(0deg)' },
        { transform: 'scale(1.08) rotate(0deg)', offset: 0.5 },
        { transform: 'scale(1) rotate(0deg)' }
      ], { duration: 700, easing: 'ease-in-out' }).finished;
    } else {
      await fontsReady;
    }
    istar.getAnimations().forEach(function (a) { a.cancel(); });
    istar.style.opacity = '1';
    iword.getAnimations().forEach(function (a) { a.cancel(); });
    iword.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, fill: 'forwards' });
    setTimeout(playHero, skipped ? 100 : 520);
    await openStar(skipped ? 700 : 1500);
    finishIntro();
  }

  $('.intro').addEventListener('click', function () { skipped = true; });
  if (location.hash && location.hash !== '#top') { skipped = true; }   // jump links skip the intro

  runIntro().catch(function () {
    finishIntro();
    $$('.m-drop, .m-rise, .m-fade').forEach(function (el) { el.classList.add('is-in'); });
  });
})();
