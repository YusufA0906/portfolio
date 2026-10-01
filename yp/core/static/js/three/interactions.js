// Page-level micro-interactions: smooth scroll, custom cursor, magnetic buttons.
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { caps } from './utils.js';

gsap.registerPlugin(ScrollTrigger);

export function initSmoothScroll() {
    if (caps.reducedMotion) return null;

    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);

    // In-page anchors (including "/#about" while on "/") glide instead of jumping
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href*="#"]');
        if (!link || link.hash.length < 2) return;
        if (link.origin !== location.origin || link.pathname !== location.pathname) return;
        const target = document.getElementById(link.hash.slice(1));
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -100 });
    });

    // Shared with script.js (back-to-top)
    window.lenis = lenis;
    return lenis;
}

const HOVERABLE = 'a, button, .project-card, .icon, [data-cursor]';

export function initCursor() {
    if (caps.reducedMotion || !caps.finePointer || caps.isMobile) return;

    const el = document.querySelector('.cursor');
    if (!el) return;
    document.documentElement.classList.add('has-cursor');

    const dot = el.querySelector('.cursor__dot');
    const ring = el.querySelector('.cursor__ring');
    const pos = { x: innerWidth / 2, y: innerHeight / 2 };
    const ringPos = { ...pos };

    window.addEventListener('pointermove', (e) => {
        pos.x = e.clientX;
        pos.y = e.clientY;
        el.classList.add('is-visible');
    }, { passive: true });
    document.addEventListener('pointerleave', () => el.classList.remove('is-visible'));
    document.addEventListener('pointerdown', () => el.classList.add('is-down'));
    document.addEventListener('pointerup', () => el.classList.remove('is-down'));

    document.addEventListener('pointerover', (e) => {
        el.classList.toggle('is-hover', !!e.target.closest(HOVERABLE));
    });

    gsap.ticker.add(() => {
        ringPos.x += (pos.x - ringPos.x) * 0.18;
        ringPos.y += (pos.y - ringPos.y) * 0.18;
        dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
        ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
    });
}

export function initMagnetic() {
    if (caps.reducedMotion || !caps.finePointer) return;

    const active = new Set();

    document.querySelectorAll('.btn, #socials-container .icon').forEach((btn) => {
        const strength = btn.classList.contains('btn--secondary') ? 0.35 : 0.25;
        const state = { btn, x: 0, y: 0, tx: 0, ty: 0 };

        btn.addEventListener('pointermove', (e) => {
            // Measure without the current magnetic offset so the pull doesn't feed back
            const r = btn.getBoundingClientRect();
            state.tx = (e.clientX - (r.left - state.x + r.width / 2)) * strength;
            state.ty = (e.clientY - (r.top - state.y + r.height / 2)) * strength;
            active.add(state);
        });
        btn.addEventListener('pointerleave', () => {
            state.tx = 0;
            state.ty = 0;
            active.add(state);
        });
    });

    // The CSS `translate` property is independent of `transform`, so the pull
    // composes with the existing hover lift instead of overriding it.
    gsap.ticker.add(() => {
        active.forEach((s) => {
            s.x += (s.tx - s.x) * 0.2;
            s.y += (s.ty - s.y) * 0.2;
            if (Math.abs(s.tx - s.x) < 0.05 && Math.abs(s.ty - s.y) < 0.05) {
                s.x = s.tx;
                s.y = s.ty;
                if (s.tx === 0 && s.ty === 0) active.delete(s);
            }
            s.btn.style.translate = `${s.x.toFixed(2)}px ${s.y.toFixed(2)}px`;
        });
    });
}
