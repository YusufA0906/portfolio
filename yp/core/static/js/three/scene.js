// Renderer for the background canvas. One WebGL context drives the whole page.
// The aurora is a soft blur, so it renders below CSS resolution and the
// browser stretches it — practically free, even on phones.
import * as THREE from 'three';
import { CONFIG } from './utils.js';

export function createRenderer(canvas) {
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        powerPreference: 'low-power',
    });
    renderer.setClearColor(CONFIG.colors.background, 1);

    const size = { width: 1, height: 1, pixelRatio: 1 };

    function resize() {
        size.width = window.innerWidth;
        size.height = window.innerHeight;
        size.pixelRatio = Math.min(window.devicePixelRatio || 1, 2) * CONFIG.aurora.resolutionScale;
        renderer.setPixelRatio(size.pixelRatio);
        renderer.setSize(size.width, size.height, false);
    }

    resize();
    return { renderer, size, resize };
}
