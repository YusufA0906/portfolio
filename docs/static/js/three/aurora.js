// "Aurora": one soft, barely-there glow in the accent colour behind the page.
// One full-screen quad and a fragment shader — no meshes, textures or bloom.
// Scrolling swings the glow from side to side, section by section; the
// pointer adds a slight parallax. Film grain is a CSS overlay (animations.css).
import * as THREE from 'three';
import { CONFIG, GLSL_NOISE } from './utils.js';

// Colours stay in sRGB so the glow blends like the CSS colours it matches
const srgb = (hex) => new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uScroll;
uniform vec2 uPointer;
uniform vec2 uResolution;
uniform float uIntensity;
uniform float uScrollShift;
uniform float uPointerStrength;
uniform vec3 uBackground;
uniform vec3 uAccent;
varying vec2 vUv;

${GLSL_NOISE}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    float aspect = uResolution.x / uResolution.y;
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
    p -= uPointer * uPointerStrength;

    // A mild warp keeps the edge soft and irregular rather than a perfect circle
    float t = uTime;
    p += 0.08 * vec2(snoise(vec3(p * 0.9, t * 0.4)), snoise(vec3(p * 0.9 + 5.2, t * 0.4)));

    // Starts upper left, then swings between the sides as the page scrolls
    float s = uScroll * uScrollShift;
    vec2 c = vec2(-0.45 * aspect * cos(s), 0.3 - 0.1 * sin(s));
    c += 0.06 * vec2(sin(t * 0.7), cos(t * 0.5));

    vec2 d = p - c;
    float glow = exp(-dot(d, d) / (0.9 * 0.9));
    vec3 col = mix(uBackground, uAccent, glow * uIntensity);

    // Dither against gradient banding
    col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;

    gl_FragColor = vec4(col, 1.0);
}
`;

export function createAurora(renderer) {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const { colors, aurora } = CONFIG;

    const uniforms = {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uPointer: { value: new THREE.Vector2() },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uIntensity: { value: aurora.intensity },
        uScrollShift: { value: aurora.scrollShift },
        uPointerStrength: { value: aurora.pointerStrength },
        uBackground: { value: srgb(colors.background) },
        uAccent: { value: srgb(colors.accent) },
    };

    const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        depthTest: false,
        depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    scene.add(quad);

    return {
        update(s, time, pointer) {
            uniforms.uScroll.value = s;
            uniforms.uTime.value = time * aurora.speed;
            uniforms.uPointer.value.set(pointer.x, pointer.y);
        },
        resize(width, height) {
            uniforms.uResolution.value.set(width, height);
        },
        render() {
            renderer.render(scene, camera);
        },
    };
}
