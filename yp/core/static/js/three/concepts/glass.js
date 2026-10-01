// Concept: "Liquid Glass" — a light, minimal page with one iridescent glass
// form that morphs into a new shape for each section and drifts into the
// free space beside the content. The camera barely moves.
import * as THREE from 'three';
import { V } from '../shared.js';
import { caps, clamp } from '../utils.js';

export const theme = {
    background: 0xf3f5fa,
    fog: null,
    bloom: null, // refraction does the work here
    exposure: 1.0,
    toneMapping: 'neutral', // keeps the pastels clean instead of greying them
};

// Camera is fixed; the form moves instead
const CAMERA = { camera: V(0, 0, 7), target: V(0, 0, 0) };

// Per-station placement in normalised screen space (-1..1) and size in world units.
// Station 0 (hero) is replaced at runtime so the form haloes the profile photo.
const KEYFRAMES = [
    { x: -0.45, y: 0, size: 1.6 },      // hero: behind the photo
    { x: -0.72, y: -0.05, size: 0.9 },  // about: rounded cube, left gutter
    { x: -0.55, y: 0.62, size: 0.7 },   // experience: coin, beside the heading
    { x: -0.62, y: -0.5, size: 1.0 },   // skills: capsule "bar", bottom left
    { x: 0.78, y: -0.05, size: 0.8 },   // showcase: twisted, right edge
    { x: 0.05, y: -0.62, size: 0.85 },  // certificates: gem, between the columns
    { x: 0.6, y: 0.45, size: 1.25 },    // contact: back to a sphere, top right
];

// ---------------------------------------------------------------------------
// Morph targets: each shape is the unit sphere's vertices projected onto it,
// so every target has the same vertex count and topology.
// ---------------------------------------------------------------------------
const superellipsoid = (d, n, sx = 1, sy = 1, sz = 1) => {
    const k = Math.pow(
        Math.pow(Math.abs(d.x), n) + Math.pow(Math.abs(d.y), n) + Math.pow(Math.abs(d.z), n),
        1 / n,
    );
    return V((d.x / k) * sx, (d.y / k) * sy, (d.z / k) * sz);
};

const SHAPES = [
    // 1 about: rounded cube
    (d) => superellipsoid(d, 6).multiplyScalar(0.82),
    // 2 experience: coin facing the camera
    (d) => {
        const r = Math.hypot(d.x, d.y);
        const k = Math.pow(Math.pow(r, 4) + Math.pow(Math.abs(d.z) / 0.3, 4), 0.25);
        return V(d.x / k, d.y / k, d.z / k);
    },
    // 3 skills: tall capsule, like a bar in a chart
    (d) => superellipsoid(d, 2.4, 0.55, 1.35, 0.55),
    // 4 showcase: twisted rounded cube
    (d) => {
        const p = superellipsoid(d, 4).multiplyScalar(0.85);
        const a = p.y * 1.6;
        const c = Math.cos(a), s = Math.sin(a);
        return V(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
    },
    // 5 certificates: faceted gem (rounded octahedron)
    (d) => superellipsoid(d, 1.15, 1.05, 1.25, 1.05),
];

function createMorphingForm() {
    const segs = caps.isMobile ? [64, 48] : [128, 96];
    const geometry = new THREE.SphereGeometry(1, segs[0], segs[1]);
    const base = geometry.attributes.position;
    const d = new THREE.Vector3();

    geometry.morphAttributes.position = [];
    geometry.morphAttributes.normal = [];
    for (const shape of SHAPES) {
        const target = geometry.clone();
        const pos = target.attributes.position;
        for (let i = 0; i < base.count; i++) {
            d.fromBufferAttribute(base, i).normalize();
            const p = shape(d);
            pos.setXYZ(i, p.x, p.y, p.z);
        }
        target.computeVertexNormals();
        geometry.morphAttributes.position.push(pos);
        geometry.morphAttributes.normal.push(target.attributes.normal);
    }

    const uniforms = { uTime: { value: 0 }, uWobble: { value: 1 } };
    const material = new THREE.MeshPhysicalMaterial({
        color: 0xf2f0ff, // faint lilac tint so edges read on the pastel backdrop
        roughness: 0.04,
        metalness: 0,
        iridescence: 1,
        iridescenceIOR: 1.35,
        iridescenceThicknessRange: [120, 720],
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.6,
        ...(caps.isMobile
            // No transmission on phones: a pearly, slightly see-through bubble instead
            ? { transparent: true, opacity: 0.82, sheen: 1, sheenColor: new THREE.Color(0xc7d2fe) }
            : { transmission: 1, thickness: 2.2, ior: 1.5, dispersion: 5, attenuationColor: new THREE.Color(0xeef0ff), attenuationDistance: 4 }),
    });

    // Liquid wobble on top of the morph, so the shapes never look rigid
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = uniforms.uTime;
        shader.uniforms.uWobble = uniforms.uWobble;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWobble;')
            .replace(
                '#include <morphtarget_vertex>',
                `#include <morphtarget_vertex>
                float wob = sin(transformed.y * 3.1 + uTime * 1.3) * sin(transformed.x * 2.7 + uTime * 0.9)
                          + 0.5 * sin(transformed.z * 4.3 - uTime * 1.7);
                transformed += objectNormal * wob * 0.028 * uWobble;`,
            );
    };

    const mesh = new THREE.Mesh(geometry, material);
    return { mesh, uniforms };
}

// ---------------------------------------------------------------------------
// Pastel mesh-gradient backdrop: soft drifting colour blobs on one OPAQUE plane.
// (Transmission only refracts opaque objects, so separate transparent sprites
// would leave the glass looking grey.)
// ---------------------------------------------------------------------------
function createBackdrop(baseColor) {
    const blobs = [0xa5b4fc, 0xf9a8d4, 0x99f6e4, 0xfde68a].map((c) => new THREE.Color(c));
    const uniforms = {
        uTime: { value: 0 },
        uBase: { value: new THREE.Color(baseColor) },
        uColors: { value: blobs },
        // Soft shadow under the glass form (xy centre, radius) — refracted by the glass too
        uShadow: { value: new THREE.Vector3(0, 0, 1) },
    };
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 36),
        new THREE.ShaderMaterial({
            uniforms,
            vertexShader: /* glsl */ `
                varying vec2 vPos;
                void main() { vPos = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
            `,
            fragmentShader: /* glsl */ `
                uniform float uTime;
                uniform vec3 uBase;
                uniform vec3 uColors[4];
                uniform vec3 uShadow;
                varying vec2 vPos;
                void main() {
                    vec3 col = uBase;
                    for (int i = 0; i < 4; i++) {
                        float fi = float(i);
                        vec2 c = vec2(cos(uTime * 0.07 + fi * 1.9) * (6.0 + fi), sin(uTime * 0.09 + fi * 2.3) * 3.5 + (mod(fi, 2.0) * 2.0 - 1.0) * 1.5);
                        float d = length(vPos - c) / (5.5 + fi * 0.6);
                        col = mix(col, uColors[i], exp(-d * d * 1.6) * 0.75);
                    }
                    float sd = length((vPos - uShadow.xy) * vec2(1.0, 1.6)) / uShadow.z;
                    col = mix(col, vec3(0.3, 0.32, 0.55), exp(-sd * sd * 2.0) * 0.22);
                    gl_FragColor = vec4(col, 1.0);
                    #include <tonemapping_fragment>
                    #include <colorspace_fragment>
                }
            `,
        }),
    );
    mesh.position.z = -6;
    return {
        mesh,
        update(time, formPos, formSize, cameraPos) {
            uniforms.uTime.value = time;
            // Project the form onto the backdrop plane, then drop it a little (light from above)
            const k = (mesh.position.z - cameraPos.z) / (formPos.z - cameraPos.z);
            uniforms.uShadow.value.set(
                cameraPos.x + (formPos.x - cameraPos.x) * k,
                cameraPos.y + (formPos.y - cameraPos.y) * k - formSize * 1.4,
                formSize * 2.2,
            );
        },
    };
}

// Studio environment with soft gradient + bright softboxes for crisp glass highlights
function createEnvironment(renderer) {
    const env = new THREE.Scene();
    const dome = new THREE.Mesh(
        new THREE.SphereGeometry(10, 32, 16),
        new THREE.ShaderMaterial({
            side: THREE.BackSide,
            vertexShader: /* glsl */ `
                varying vec3 vDir;
                void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
            `,
            fragmentShader: /* glsl */ `
                varying vec3 vDir;
                void main() {
                    float t = vDir.y * 0.5 + 0.5;
                    vec3 low = mix(vec3(0.98, 0.78, 0.9), vec3(0.72, 0.95, 0.9), vDir.x * 0.5 + 0.5);
                    vec3 high = vec3(0.92, 0.94, 1.0);
                    gl_FragColor = vec4(mix(low, high, smoothstep(0.2, 0.9, t)), 1.0);
                }
            `,
        }),
    );
    env.add(dome);

    const box = (w, h, pos, intensity) => {
        const m = new THREE.Mesh(
            new THREE.PlaneGeometry(w, h),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(intensity), side: THREE.DoubleSide }),
        );
        m.position.copy(pos);
        m.lookAt(0, 0, 0);
        env.add(m);
    };
    box(6, 2, V(0, 6, 3), 4);
    box(2, 5, V(-7, 1, 2), 2.5);
    box(2, 5, V(7, 0, -2), 2);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const texture = pmrem.fromScene(env, 0.02).texture;
    pmrem.dispose();
    env.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
    });
    return texture;
}

export function create({ scene, camera, renderer }) {
    if (scene.environment) scene.environment.dispose();
    scene.environment = createEnvironment(renderer);

    const form = createMorphingForm();
    const backdrop = createBackdrop(theme.background);
    scene.add(form.mesh, backdrop.mesh);

    const keyframes = KEYFRAMES.map((k) => ({ ...k }));
    const appear = { value: caps.reducedMotion ? 1 : 0 };
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = CAMERA.camera.z;
    const pos = new THREE.Vector3();

    // Smooth interpolation between neighbouring keyframes
    function sampleKeyframes(s) {
        const i = clamp(Math.floor(s), 0, keyframes.length - 1);
        const j = Math.min(i + 1, keyframes.length - 1);
        let t = s - i;
        t = t * t * (3 - 2 * t);
        const a = keyframes[i], b = keyframes[j];
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, size: a.size + (b.size - a.size) * t };
    }

    return {
        stations: Array.from({ length: 7 }, () => CAMERA),
        parallax: { x: 0.25, y: 0.15 },
        introDolly: 1.5,

        // Hero: halo the profile photo (in normalised screen space)
        onLayout() {
            const pic = document.querySelector('#profile .section__pic-container');
            if (!pic || !pic.offsetWidth) return;
            const r = pic.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + window.scrollY + r.height / 2;
            keyframes[0].x = (cx / innerWidth) * 2 - 1;
            keyframes[0].y = -((cy / innerHeight) * 2 - 1);
            const worldPerPx = (2 * dist * tanHalf) / innerHeight;
            keyframes[0].size = (pic.offsetWidth / 2) * worldPerPx * 1.28;

            // Phones: content fills the width, so keep the form centred-ish and smaller
            if (caps.isMobile) {
                for (let i = 1; i < keyframes.length; i++) {
                    keyframes[i].x = KEYFRAMES[i].x * 0.55;
                    keyframes[i].size = KEYFRAMES[i].size * 0.7;
                }
            }
        },

        ignite(gsap) {
            gsap.fromTo(appear, { value: 0 }, { value: 1, duration: 2, ease: 'elastic.out(1, 0.6)' });
        },
        igniteNow() { appear.value = 1; },

        update(s, time) {
            // Morph: a "tent" weight per target peaking at its station
            const influences = form.mesh.morphTargetInfluences;
            for (let k = 0; k < influences.length; k++) {
                influences[k] = clamp(1 - Math.abs(s - (k + 1)), 0, 1);
            }

            // Place the form in screen space so it lands in the same spot at any aspect ratio
            const k = sampleKeyframes(s);
            const halfH = dist * tanHalf;
            const halfW = halfH * camera.aspect;
            pos.set(k.x * halfW, k.y * halfH, 0);
            form.mesh.position.copy(pos);
            form.mesh.position.y += Math.sin(time * 0.8) * 0.06;
            form.mesh.scale.setScalar(k.size * appear.value * (1 + Math.sin(time * 1.1) * 0.015));

            form.mesh.rotation.y = time * 0.25 + s * 0.6;
            form.mesh.rotation.x = Math.sin(time * 0.3) * 0.25;
            form.uniforms.uTime.value = time;

            backdrop.update(time, form.mesh.position, form.mesh.scale.x, camera.position);
        },
    };
}
