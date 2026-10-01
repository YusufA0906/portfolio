// Entry point for the 3D background. One fixed canvas behind the page;
// scrolling flies the camera between "stations", one per page section.
// The scene itself comes from a pluggable concept module (see concepts/).
//
// A concept module exports:
//   theme            { background, fog, bloom, exposure, toneMapping } for createStage()
//   create(ctx)      ctx = { scene, camera, renderer, manager, textureUrls }, returns:
//     stations       7 × { camera: Vector3, target: Vector3 }, in [data-station] order
//     update(s, time, { pointer, dt, last, camera })   called every frame
//     picker?        createCardPicker() result for clickable 3D project cards
//     onLayout?({ path, camera })   re-frame the hero after resize / font load
//     adjustCamera?(camPos, camTarget, s, time)       tweak the pose before lookAt
//     ignite?(gsap) / igniteNow?()  intro animation / its end state
//     setPixelRatio?(pr), parallax?: { x, y }, introDolly?: number
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createStage } from './scene.js';
import { createCameraPath, STATION_NAMES } from './shared.js';
import { initSmoothScroll, initCursor, initMagnetic } from './interactions.js';
import { CONFIG, caps, clamp, damp, getConcept } from './utils.js';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const canvas = document.getElementById('webgl');

const lenis = initSmoothScroll();
const cursor = initCursor();
initMagnetic();
initConceptSwitcher();

if (canvas && root.classList.contains('has-webgl')) {
    try {
        const concept = await import(`./concepts/${getConcept()}.js`);
        start(concept);
    } catch (err) {
        console.error('3D scene failed to start, using CSS fallback.', err);
        fallback();
    }
} else {
    fallback();
}

function fallback() {
    root.classList.remove('is-loading', 'has-webgl');
    root.classList.add('no-webgl');
}

// Temporary pill for comparing concepts — reloads with ?concept= and remembers the choice
function initConceptSwitcher() {
    const current = getConcept();
    document.querySelectorAll('[data-concept]').forEach((btn) => {
        const active = btn.dataset.concept === current;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active);
        btn.addEventListener('click', () => {
            try { localStorage.setItem('concept', btn.dataset.concept); } catch (e) { /* storage blocked */ }
            const url = new URL(window.location.href);
            url.searchParams.set('concept', btn.dataset.concept);
            window.location.href = url.toString();
        });
    });
}

function start(conceptModule) {
    const stage = createStage(canvas, conceptModule.theme);
    const { scene, camera, renderer } = stage;
    const manager = new THREE.LoadingManager();
    let loadingStarted = false;
    manager.onStart = () => { loadingStarted = true; };

    // ---- Build the world ---------------------------------------------------
    const projectCards = [...document.querySelectorAll('.project-card')];
    const textureUrls = projectCards
        .map((card) => card.querySelector('.project-card__image'))
        .filter(Boolean)
        .map((img) => img.currentSrc || img.src);

    const concept = conceptModule.create({ scene, camera, renderer, manager, textureUrls });
    const path = createCameraPath(concept.stations);
    const parallax = concept.parallax || { x: 0.35, y: 0.22 };

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

    function layout() {
        if (concept.onLayout) concept.onLayout({ path, camera });
    }

    layout();
    computeAnchors();
    let targetS = scrollToStation(window.scrollY);
    let currentS = caps.isMobile ? Math.round(targetS) : targetS;

    // ---- Mobile: per-section cross-fades instead of the camera flight -------
    let fading = false;
    function fadeToStation(st) {
        fading = true;
        canvas.classList.add('is-faded');
        setTimeout(() => {
            currentS = st;
            canvas.classList.remove('is-faded');
            fading = false;
            const latest = Math.round(targetS);
            if (latest !== currentS) fadeToStation(latest);
        }, 380);
    }

    if (!caps.reducedMotion) {
        ScrollTrigger.create({
            start: 0,
            end: 'max',
            onUpdate(self) {
                targetS = scrollToStation(self.scroll());
                if (caps.isMobile && !fading && Math.round(targetS) !== currentS) fadeToStation(Math.round(targetS));
            },
        });
        ScrollTrigger.addEventListener('refresh', () => {
            layout();
            computeAnchors();
            targetS = scrollToStation(window.scrollY);
        });
    }

    // ---- Pointer ----------------------------------------------------------
    const pointer = { x: 0, y: 0 };
    const smoothPointer = { x: 0, y: 0 };
    const ndc = new THREE.Vector2(-10, -10);
    let pointerTarget = null;
    window.addEventListener('pointermove', (e) => {
        pointer.x = (e.clientX / innerWidth) * 2 - 1;
        pointer.y = -((e.clientY / innerHeight) * 2 - 1);
        ndc.set(pointer.x, pointer.y);
        pointerTarget = e.target;
    }, { passive: true });

    // Elements that already handle their own clicks keep priority over the WebGL cards
    const INTERACTIVE = 'a, button, input, textarea, .project-card, .details-container';
    const picker = concept.picker || null;
    window.addEventListener('click', (e) => {
        const idx = picker ? picker.hovered : null;
        if (idx === null || e.target.closest(INTERACTIVE)) return;
        const card = projectCards[idx];
        if (!card) return;
        if (lenis) lenis.scrollTo(card, { offset: -140 });
        else card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('is-highlighted');
        setTimeout(() => card.classList.remove('is-highlighted'), 1600);
    });

    // ---- Resize ------------------------------------------------------------
    function onResize() {
        stage.resize();
        if (concept.setPixelRatio) concept.setPixelRatio(stage.size.pixelRatio);
        layout();
        if (caps.reducedMotion) renderStatic();
    }
    window.addEventListener('resize', onResize);
    if (concept.setPixelRatio) concept.setPixelRatio(stage.size.pixelRatio);

    // Web fonts and images shift the hero layout after first paint — re-run layout
    function onLayoutChange() {
        layout();
        if (caps.reducedMotion) renderStatic();
        else ScrollTrigger.refresh();
    }
    const heroText = document.querySelector('#profile .section__text');
    if (heroText && 'ResizeObserver' in window) new ResizeObserver(onLayoutChange).observe(heroText);
    if (document.fonts) document.fonts.ready.then(onLayoutChange);

    // ---- Frame -------------------------------------------------------------
    const camPos = new THREE.Vector3();
    const camTarget = new THREE.Vector3();
    const back = new THREE.Vector3();
    const intro = { dolly: caps.reducedMotion ? 0 : 1 };
    const introDolly = concept.introDolly ?? 4;
    const clock = new THREE.Clock();
    const frameInfo = { pointer: smoothPointer, dt: 0, last, camera };

    function frame(time, dt) {
        if (!caps.isMobile) currentS = damp(currentS, targetS, CONFIG.scrollDamping, dt);
        smoothPointer.x = damp(smoothPointer.x, pointer.x, 3, dt);
        smoothPointer.y = damp(smoothPointer.y, pointer.y, 3, dt);

        path.sample(currentS, camPos, camTarget);
        camPos.x += smoothPointer.x * parallax.x;
        camPos.y += smoothPointer.y * parallax.y;
        // Intro: ease in from slightly behind the hero pose
        if (intro.dolly > 0) camPos.addScaledVector(back.subVectors(camPos, camTarget).normalize(), intro.dolly * introDolly);
        if (concept.adjustCamera) concept.adjustCamera(camPos, camTarget, currentS, time);
        camera.position.copy(camPos);
        camera.lookAt(camTarget);

        frameInfo.dt = dt;
        concept.update(currentS, time, frameInfo);

        if (picker && caps.finePointer) {
            const overHtml = pointerTarget && pointerTarget.closest && pointerTarget.closest(INTERACTIVE);
            const hit = picker.pick(overHtml ? null : ndc, camera, currentS);
            if (cursor) cursor.setLabel(hit !== null ? 'View' : null);
        }

        stage.render();
    }

    function tick() {
        const dt = Math.min(clock.getDelta(), 0.05);
        frame(clock.elapsedTime, dt);
    }

    function renderStatic() {
        frame(4, 0.016);
    }

    // ---- Load, then ignite --------------------------------------------------
    const ready = new Promise((resolve) => {
        manager.onLoad = resolve;
        if (!loadingStarted) resolve(); // concept requested no textures
    });

    if (caps.reducedMotion) {
        if (concept.igniteNow) concept.igniteNow();
        root.classList.remove('is-loading');
        renderStatic();
        ready.then(renderStatic);
        return;
    }

    const countEl = document.getElementById('loader-count');
    const barEl = document.getElementById('loader-bar');
    const loading = { shown: 0, target: 0 };
    manager.onProgress = (_url, loaded, total) => {
        loading.target = (loaded / total) * 90;
    };
    const updateLoader = () => {
        loading.shown += (loading.target - loading.shown) * 0.12;
        const v = Math.min(100, Math.round(loading.shown));
        if (countEl) countEl.textContent = v;
        if (barEl) barEl.style.transform = `scaleX(${v / 100})`;
    };
    gsap.ticker.add(updateLoader);

    const minDisplay = new Promise((r) => setTimeout(r, 900));
    Promise.all([ready, minDisplay]).then(() => {
        renderer.compile(scene, camera); // avoid first-scroll shader hitches
        loading.target = 100;
        setTimeout(() => {
            gsap.ticker.remove(updateLoader);
            if (countEl) countEl.textContent = 100;
            if (barEl) barEl.style.transform = 'scaleX(1)';
            root.classList.remove('is-loading');
            if (concept.ignite) concept.ignite(gsap);
            gsap.to(intro, { dolly: 0, duration: 2.6, ease: 'power3.out' });
        }, 450);
    });

    renderer.setAnimationLoop(tick);
    document.addEventListener('visibilitychange', () => {
        renderer.setAnimationLoop(document.hidden ? null : tick);
        if (!document.hidden) clock.getDelta(); // drop the paused gap
    });
}
