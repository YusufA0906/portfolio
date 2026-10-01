// Hero objects: the glowing "data core", the orbiting ledger-cell particles
// (which later reorganise into the About grid) and a distant star field.
import * as THREE from 'three';
import { CONFIG, GLSL_NOISE, mulberry32 } from './utils.js';

const cyan = new THREE.Color(CONFIG.colors.cyan);
const emerald = new THREE.Color(CONFIG.colors.emerald);

// ---------------------------------------------------------------------------
// Core: low-poly icosahedron with noise displacement + fresnel rim
// ---------------------------------------------------------------------------
export function createCore() {
    const group = new THREE.Group();
    const R = CONFIG.coreRadius;

    const uniforms = {
        uTime: { value: 0 },
        uIgnite: { value: 0 },
        uPulse: { value: 0 },
        uColorA: { value: cyan.clone() },
        uColorB: { value: emerald.clone() },
    };

    const shell = new THREE.Mesh(
        new THREE.IcosahedronGeometry(R, 3),
        new THREE.ShaderMaterial({
            uniforms,
            vertexShader: /* glsl */ `
                uniform float uTime;
                uniform float uIgnite;
                uniform float uPulse;
                varying vec3 vWorldPos;
                varying float vNoise;
                ${GLSL_NOISE}
                void main() {
                    float n = snoise(position * 0.85 + vec3(0.0, uTime * 0.22, uTime * 0.12));
                    vNoise = n;
                    float amp = 0.07 + 0.16 * uIgnite + 0.12 * uPulse;
                    vec3 displaced = position + normal * n * amp;
                    vec4 world = modelMatrix * vec4(displaced, 1.0);
                    vWorldPos = world.xyz;
                    gl_Position = projectionMatrix * viewMatrix * world;
                }
            `,
            fragmentShader: /* glsl */ `
                uniform float uIgnite;
                uniform float uPulse;
                uniform vec3 uColorA;
                uniform vec3 uColorB;
                varying vec3 vWorldPos;
                varying float vNoise;
                void main() {
                    // Faceted normal from screen-space derivatives: crisp low-poly look
                    vec3 N = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
                    vec3 V = normalize(cameraPosition - vWorldPos);
                    float facing = abs(dot(N, V));
                    float fres = pow(1.0 - facing, 2.0);
                    float t = vNoise * 0.5 + 0.5;
                    vec3 body = mix(uColorA, uColorB, t) * (0.02 + 0.06 * facing);
                    vec3 rim = mix(uColorA, uColorB, fres) * fres * (0.3 + 0.9 * uIgnite + 1.0 * uPulse);
                    gl_FragColor = vec4(body + rim, 1.0);
                    #include <tonemapping_fragment>
                    #include <colorspace_fragment>
                }
            `,
        }),
    );
    group.add(shell);

    // Wireframe cage — reads as "structure around the data"
    const cage = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(R * 1.32, 1)),
        new THREE.LineBasicMaterial({ color: CONFIG.colors.cyan, transparent: true, opacity: 0.22 }),
    );
    group.add(cage);

    // Hot inner heart that feeds the bloom pass
    const heart = new THREE.Mesh(
        new THREE.IcosahedronGeometry(R * 0.38, 1),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9ff3ff), transparent: true, opacity: 0 }),
    );
    group.add(heart);

    function update(time, pointer) {
        uniforms.uTime.value = time;
        shell.rotation.y = time * 0.12;
        shell.rotation.x = time * 0.05;
        cage.rotation.y = -time * 0.07;
        cage.rotation.z = time * 0.04;
        heart.material.opacity = 0.65 * uniforms.uIgnite.value;
        heart.scale.setScalar(1 + 0.15 * Math.sin(time * 2.2) * (0.3 + uniforms.uPulse.value));

        // Lean toward the mouse
        group.rotation.y += (pointer.x * 0.45 - group.rotation.y) * 0.06;
        group.rotation.x += (-pointer.y * 0.3 - group.rotation.x) * 0.06;
        group.scale.setScalar(1 + uniforms.uPulse.value * 0.08 * (0.5 + 0.5 * Math.sin(time * 2.4)));
    }

    return { group, uniforms, update };
}

// ---------------------------------------------------------------------------
// Particles: GPU-instanced ledger cells. Orbit the core, then morph into an
// ordered spreadsheet-like grid at the About station (chaos -> order).
// ---------------------------------------------------------------------------
export function createParticles(count, gridCenter) {
    const rand = mulberry32(906);
    const base = new THREE.BoxGeometry(0.06, 0.06, 0.012);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = base.index;
    geometry.setAttribute('position', base.getAttribute('position'));
    geometry.instanceCount = count;

    const orbit = new Float32Array(count * 4); // radius, tilt, node, speed
    const grid = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 4);

    // Grid sized to the particle count with a ~6:5 aspect ratio
    const cols = Math.ceil(Math.sqrt(count * 1.2));
    const rows = Math.ceil(count / cols);
    const spacing = 0.18;

    for (let i = 0; i < count; i++) {
        const r = CONFIG.coreRadius * (1.5 + Math.pow(rand(), 1.8) * 2.1);
        orbit.set([r, (rand() - 0.5) * 1.1, rand() * Math.PI * 2, (0.08 + rand() * 0.25) * (rand() < 0.5 ? 1 : -1) * (2.2 / r)], i * 4);

        const c = i % cols;
        const row = Math.floor(i / cols);
        grid.set([
            gridCenter.x + (c - (cols - 1) / 2) * spacing,
            gridCenter.y + ((rows - 1) / 2 - row) * spacing,
            gridCenter.z,
        ], i * 3);

        seeds.set([rand(), rand(), rand(), rand()], i * 4);
    }

    geometry.setAttribute('aOrbit', new THREE.InstancedBufferAttribute(orbit, 4));
    geometry.setAttribute('aGrid', new THREE.InstancedBufferAttribute(grid, 3));
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    base.dispose();

    const uniforms = {
        uTime: { value: 0 },
        uMorph: { value: 0 },
        uIgnite: { value: 0 },
        uColorA: { value: cyan.clone() },
        uColorB: { value: emerald.clone() },
    };

    const material = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
            attribute vec4 aOrbit;
            attribute vec3 aGrid;
            attribute vec4 aSeed;
            uniform float uTime;
            uniform float uMorph;
            uniform float uIgnite;
            varying float vGlow;
            varying float vTint;
            varying float vFade;

            mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
            mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }

            void main() {
                // Orbit around the core
                float ang = aSeed.x * 6.2831 + uTime * aOrbit.w;
                vec3 orbitPos = vec3(cos(ang), 0.0, sin(ang)) * aOrbit.x;
                orbitPos.y += sin(ang * 2.0 + aSeed.z * 6.2831) * 0.22;
                orbitPos = rotY(aOrbit.z) * rotX(aOrbit.y) * orbitPos;
                orbitPos *= mix(0.15, 1.0, uIgnite);

                // Grid cell with a gentle row wave
                vec3 gridPos = aGrid;
                gridPos.z += sin(aGrid.x * 0.55 + aGrid.y * 0.3 + uTime * 1.1) * 0.12;

                // Staggered morph with an arcing flight path between the two
                float m = smoothstep(aSeed.y * 0.45, aSeed.y * 0.45 + 0.55, uMorph);
                float e = m * m * (3.0 - 2.0 * m);
                vec3 center = mix(orbitPos, gridPos, e);
                center.y += sin(e * 3.14159) * (1.0 + aSeed.z * 2.5);
                center.x += sin(e * 3.14159) * (aSeed.w - 0.5) * 3.0;

                // Tiles tumble in the cloud and lie flat in the grid
                float spin = (uTime * (0.4 + aSeed.w) + aSeed.z * 6.2831) * (1.0 - e);
                vec3 p = rotY(spin) * rotX(spin * 0.7) * position * mix(1.0, 1.35, e);

                vec4 mv = modelViewMatrix * vec4(center + p, 1.0);
                gl_Position = projectionMatrix * mv;

                // Grid "processing" scan: rows light up as data flows through them
                float scan = sin(aGrid.y * 1.4 - uTime * 2.2 + aGrid.x * 0.12) * 0.5 + 0.5;
                scan = pow(scan, 10.0);
                float heat = step(0.88, fract(aSeed.w * 7.0 + floor(uTime * 0.6 + aSeed.x * 3.0) * 0.37));
                float cloudGlow = 0.18 + 0.42 * aSeed.w;
                float gridGlow = 0.07 + scan * 0.55 + heat * 0.22;
                vGlow = mix(cloudGlow, gridGlow, e) * uIgnite;
                vTint = mix(aSeed.w, scan, e * 0.6);
                vFade = smoothstep(70.0, 6.0, -mv.z);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uColorA;
            uniform vec3 uColorB;
            varying float vGlow;
            varying float vTint;
            varying float vFade;
            void main() {
                vec3 col = mix(uColorA, uColorB, vTint) * vGlow;
                gl_FragColor = vec4(col, 0.8 * vFade);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false; // positions are computed on the GPU

    return {
        mesh,
        uniforms,
        update(time) {
            uniforms.uTime.value = time;
        },
    };
}

// ---------------------------------------------------------------------------
// Star field for depth along the whole camera path
// ---------------------------------------------------------------------------
export function createStars(count) {
    const rand = mulberry32(42);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        positions[i * 3] = (rand() - 0.5) * 120;
        positions[i * 3 + 1] = (rand() - 0.5) * 80;
        positions[i * 3 + 2] = 30 - rand() * 150;
        seeds[i] = rand();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const uniforms = { uTime: { value: 0 }, uPixelRatio: { value: 1 } };
    const points = new THREE.Points(geometry, new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
            attribute float aSeed;
            uniform float uTime;
            uniform float uPixelRatio;
            varying float vAlpha;
            void main() {
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mv;
                gl_PointSize = (1.0 + aSeed * 2.2) * uPixelRatio * (24.0 / -mv.z);
                vAlpha = (0.35 + 0.65 * (sin(uTime * (0.6 + aSeed) + aSeed * 40.0) * 0.5 + 0.5)) * smoothstep(110.0, 10.0, -mv.z);
            }
        `,
        fragmentShader: /* glsl */ `
            varying float vAlpha;
            void main() {
                float d = length(gl_PointCoord - 0.5);
                float a = smoothstep(0.5, 0.0, d) * vAlpha;
                gl_FragColor = vec4(vec3(0.75, 0.9, 1.0) * a, a);
            }
        `,
    }));
    points.frustumCulled = false;

    return { points, uniforms, update(time) { uniforms.uTime.value = time; } };
}
