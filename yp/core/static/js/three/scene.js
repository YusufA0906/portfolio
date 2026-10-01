// Renderer, camera, environment lighting and post-processing.
// One WebGL context drives the whole page.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CONFIG, caps } from './utils.js';

// `theme` comes from the active concept:
//   { background, fog: density | null, bloom: { strength, radius, threshold } | null,
//     exposure, toneMapping: 'aces' | 'neutral' }
export function createStage(canvas, theme = {}) {
    const background = theme.background ?? CONFIG.colors.background;
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !caps.isMobile,
        powerPreference: 'high-performance',
    });
    renderer.setClearColor(background, 1);
    renderer.toneMapping = theme.toneMapping === 'neutral' ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = theme.exposure ?? 1.05;

    const scene = new THREE.Scene();
    if (theme.fog) scene.fog = new THREE.FogExp2(background, theme.fog);

    // Procedural studio lighting for the metal + glass materials (no HDR download)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(CONFIG.fov, 1, 0.1, 200);
    camera.position.set(0, 0, 8);

    // Bloom only where the GPU can afford it, and only for concepts that want it
    const bloomCfg = theme.bloom === undefined ? CONFIG.bloom : theme.bloom;
    let composer = null;
    let bloom = null;
    if (!caps.isMobile && bloomCfg) {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        bloom = new UnrealBloomPass(
            new THREE.Vector2(1, 1),
            bloomCfg.strength,
            bloomCfg.radius,
            bloomCfg.threshold,
        );
        composer.addPass(bloom);
        composer.addPass(new OutputPass());
    }

    const size = { width: 1, height: 1, pixelRatio: 1 };

    function resize() {
        size.width = window.innerWidth;
        size.height = window.innerHeight;
        size.pixelRatio = Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio);

        renderer.setPixelRatio(size.pixelRatio);
        renderer.setSize(size.width, size.height, false);
        camera.aspect = size.width / size.height;
        camera.updateProjectionMatrix();

        if (composer) {
            composer.setPixelRatio(size.pixelRatio);
            composer.setSize(size.width, size.height);
        }
    }

    function render() {
        if (composer) composer.render();
        else renderer.render(scene, camera);
    }

    resize();

    return { THREE, renderer, scene, camera, size, resize, render, bloom };
}
