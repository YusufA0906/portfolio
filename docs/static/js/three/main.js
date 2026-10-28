// Entry point for the background. One fixed canvas behind the page draws the
// aurora (see aurora.js); scrolling moves it through "stations", one per
// page section, so each section gets a slightly different colour mood.
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { gsap } from 'gsap';
import { createRenderer } from './scene.js';
import { createAurora } from './aurora.js';
import { initSmoothScroll, initCursor, initMagnetic } from './interactions.js';
import { CONFIG, caps, clamp, damp } from './utils.js';

gsap.registerPlugin(ScrollTrigger);

// Must match the data-station attributes in index.html
const STATION_NAMES = ['hero', 'about', 'experience', 'skills', 'showcase', 'certificates', 'contact'];

const root = document.documentElement;
const canvas = document.getElementById('webgl');

initSmoothScroll();
initCursor();
initMagnetic();

if (canvas && root.classList.contains('has-webgl')) {
    try {
        start();
    } catch (err) {
        console.error('Background failed to start, using CSS fallback.', err);
        fallback();
    }
} else {
    fallback();
}

function fallback() {
    root.classList.remove('is-loading', 'has-webgl');
    root.classList.add('no-webgl');
}

function start() {
    const { renderer, size, resize } = createRenderer(canvas);
    const aurora = createAurora(renderer);

    // ---- Scroll position -> station progress "s" (0 = hero ... 6 = contact)
    const stationEls = STATION_NAMES.map((name) => document.querySelector(`[data-station="${name}"]`));
    const last = STATION_NAMES.length - 1;
    let anchors = STATION_NAMES.map((_, i) => i);

    function computeAnchors() {
        const max = ScrollTrigger.maxScroll(window);
        anchors = stationEls.map((el, i) => {
            if (i === 0 || !el) return i === 0 ? 0 : null;
            if (i === last) return max;
            const top = el.getBoundingClientRect().top + window.scrollY;
            return clamp(top + el.offsetHeight / 2 - innerHeight / 2, 0, max);
        });
        // Fill gaps and keep strictly increasing
        for (let i = 1; i < anchors.length; i++) {
            if (anchors[i] === null) anchors[i] = anchors[i - 1];
            anchors[i] = Math.max(anchors[i], anchors[i - 1] + 1);
        }
    }

    function scrollToStation(y) {
        if (y <= anchors[0]) return 0;
        for (let i = 0; i < last; i++) {
            if (y < anchors[i + 1]) return i + (y - anchors[i]) / (anchors[i + 1] - anchors[i]);
        }
        return last;
    }

    computeAnchors();
    let targetS = scrollToStation(window.scrollY);
    let currentS = targetS;

    // ---- Pointer ----------------------------------------------------------
    const pointer = { x: 0, y: 0 };
    const smoothPointer = { x: 0, y: 0 };
    if (!caps.reducedMotion) {
        window.addEventListener('pointermove', (e) => {
            pointer.x = (e.clientX / innerWidth) * 2 - 1;
            pointer.y = -((e.clientY / innerHeight) * 2 - 1);
        }, { passive: true });
    }

    // ---- Frame -------------------------------------------------------------
    function onResize() {
        resize();
        aurora.resize(size.width * size.pixelRatio, size.height * size.pixelRatio);
    }
    onResize();

    function frame(time, dt) {
        currentS = damp(currentS, targetS, CONFIG.scrollDamping, dt);
        smoothPointer.x = damp(smoothPointer.x, pointer.x, 3, dt);
        smoothPointer.y = damp(smoothPointer.y, pointer.y, 3, dt);
        aurora.update(currentS, time, smoothPointer);
        aurora.render();
    }

    // Reduced motion: no drift, but the colours still follow the page
    if (caps.reducedMotion) {
        const renderStatic = () => {
            computeAnchors();
            currentS = targetS = scrollToStation(window.scrollY);
            aurora.update(currentS, 0, smoothPointer);
            aurora.render();
        };
        let queued = false;
        const queueRender = () => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => { queued = false; renderStatic(); });
        };
        window.addEventListener('scroll', queueRender, { passive: true });
        window.addEventListener('resize', () => { onResize(); queueRender(); });
        if (document.fonts) document.fonts.ready.then(queueRender);
        renderStatic();
        root.classList.remove('is-loading');
        return;
    }

    ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate(self) {
            targetS = scrollToStation(self.scroll());
        },
    });
    ScrollTrigger.addEventListener('refresh', () => {
        computeAnchors();
        targetS = scrollToStation(window.scrollY);
    });
    window.addEventListener('resize', onResize);
    // Web fonts shift section positions after first paint
    if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());

    let clockTime = 0;
    let lastNow = performance.now();
    function tick(now) {
        const dt = Math.min((now - lastNow) / 1000, 0.05);
        lastNow = now;
        clockTime += dt;
        frame(clockTime, dt);
    }

    renderer.setAnimationLoop(tick);
    document.addEventListener('visibilitychange', () => {
        renderer.setAnimationLoop(document.hidden ? null : tick);
        if (!document.hidden) lastNow = performance.now(); // drop the paused gap
    });

    // Reveal the hero once the first frame is on screen
    requestAnimationFrame(() => root.classList.remove('is-loading'));
}
