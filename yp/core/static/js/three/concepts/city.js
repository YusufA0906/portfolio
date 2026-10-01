// Concept: "Ledger City" — a low-poly city whose skyscrapers are bar charts.
// Scrolling flies over its districts while dusk turns to night and the
// windows light up.
import * as THREE from 'three';
import { V, createCardPicker, loadProjectTextures } from '../shared.js';
import { caps, lerp, mulberry32, proximity, smoothstep } from '../utils.js';

export const theme = {
    background: 0x0b1020,
    fog: 0.011,
    bloom: { strength: 0.45, radius: 0.45, threshold: 0.78 },
    exposure: 1.0,
};

const STATIONS = [
    { camera: V(16, 22, 24),  target: V(0, 0, -20) },  // hero: high aerial overview
    { camera: V(0, 1.6, -3),  target: V(0, 1.9, -18) }, // about: low glide down the boulevard
    { camera: V(0, 10, -16),  target: V(0, 0, -32) },   // experience: over the three districts
    { camera: V(5, 8.5, -37), target: V(0, 2.5, -47) }, // skills: looking down on the chart towers
    { camera: V(0, 5.5, -51), target: V(0, 5.2, -66) }, // showcase: rooftop billboards
    { camera: V(0, 3.4, -68), target: V(0, 2, -79) },   // certificates: monument plaza
    { camera: V(-20, 11, 6),  target: V(6, 2, -40) },   // contact: wide night skyline
];

// Open spaces kept free of buildings (x, z, radius)
const PLAZAS = [
    [0, -46.5, 6.5],  // skills
    [0, -61, 8.5],    // showcase
    [0, -79, 6],      // certificates
];
const BOULEVARD = 1.9; // half-width of the central street the camera glides down

// Experience districts: Web (cyan) | Automation (emerald) | Finance (amber)
const DISTRICT_COLORS = [
    new THREE.Color(1.0, 0.82, 0.55), // 0: everyday warm windows
    new THREE.Color(0x22d3ee),
    new THREE.Color(0x10b981),
    new THREE.Color(0xf59e0b),
];

const SKY = {
    duskTop: new THREE.Color(0x1d2b53), duskHorizon: new THREE.Color(0xf28c5a),
    nightTop: new THREE.Color(0x03050d), nightHorizon: new THREE.Color(0x1c1840),
};

// ---------------------------------------------------------------------------
// Buildings: one InstancedMesh; windows and district tint added to the
// standard material in onBeforeCompile so they still get proper lighting.
// ---------------------------------------------------------------------------
function createBuildings(nightUniform, igniteUniform) {
    const rand = mulberry32(2026);
    const spacing = caps.isMobile ? 2.4 : 1.6;
    const lots = [];

    const noise = (x, z) => (Math.sin(x * 0.11 + z * 0.07) + Math.sin(x * 0.05 - z * 0.13) + Math.sin(z * 0.09 + 1.7)) / 3;

    for (let x = -30; x <= 30; x += spacing) {
        for (let z = 6; z >= -98; z -= spacing) {
            if (Math.abs(x) < BOULEVARD + 0.6) continue;
            const ix = Math.round(x / spacing), iz = Math.round(z / spacing);
            if (ix % 5 === 0 || iz % 6 === 0) continue; // street grid
            if (PLAZAS.some(([px, pz, r]) => Math.hypot(x - px, z - pz) < r)) continue;
            if (rand() < 0.12) continue; // the odd empty lot

            // Taller downtown around the experience districts, a few skyscraper spikes
            const downtown = Math.exp(-((z + 30) ** 2) / 300 - (x ** 2) / 260);
            let h = 0.5 + (noise(x, z) * 0.5 + 0.5) * 2.4 + downtown * 9;
            if (rand() < 0.06) h *= 2.4;
            h *= 0.7 + rand() * 0.6;

            let district = 0;
            if (z < -22 && z > -40) district = x < -4 ? 1 : x > 4 ? 3 : 2;

            lots.push({ x, z, h, w: spacing * (0.55 + rand() * 0.15), d: spacing * (0.55 + rand() * 0.15), district, seed: rand() });
        }
    }

    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const info = new Float32Array(lots.length * 3);
    lots.forEach((l, i) => info.set([l.h, l.district, l.seed], i * 3));
    geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 3));

    const material = new THREE.MeshStandardMaterial({ color: 0x1c2233, roughness: 0.8, metalness: 0.15, envMapIntensity: 0.2 });
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uNight = nightUniform;
        shader.uniforms.uIgnite = igniteUniform;
        shader.uniforms.uDistrict = { value: DISTRICT_COLORS };
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
                attribute vec3 aInfo;
                varying vec3 vInfo;
                varying vec3 vWPos;
                varying vec3 vObjNormal;`)
            .replace('#include <project_vertex>', `#include <project_vertex>
                vec4 wp = vec4(transformed, 1.0);
                #ifdef USE_INSTANCING
                    wp = instanceMatrix * wp;
                #endif
                vWPos = (modelMatrix * wp).xyz;
                vObjNormal = normal;
                vInfo = aInfo;`);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>
                uniform float uNight;
                uniform float uIgnite;
                uniform vec3 uDistrict[4];
                varying vec3 vInfo;
                varying vec3 vWPos;
                varying vec3 vObjNormal;
                float hash12(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
            .replace('#include <color_fragment>', `#include <color_fragment>
                int di = int(vInfo.y + 0.5);
                vec3 tint = di == 1 ? uDistrict[1] : di == 2 ? uDistrict[2] : di == 3 ? uDistrict[3] : vec3(1.0);
                diffuseColor.rgb *= mix(vec3(1.0), tint, di > 0 ? 0.35 : 0.0);
                diffuseColor.rgb *= mix(0.45, 1.0, smoothstep(0.0, 1.2, vWPos.y)); // fake AO at the base`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                // Window grid on the walls (not the roof)
                if (abs(vObjNormal.y) < 0.5) {
                    vec2 wc = vec2(abs(vObjNormal.x) > 0.5 ? vWPos.z : vWPos.x, vWPos.y);
                    vec2 cell = fract(wc * vec2(4.0, 3.2));
                    vec2 id = floor(wc * vec2(4.0, 3.2));
                    float win = step(0.28, cell.x) * step(cell.x, 0.72) * step(0.3, cell.y) * step(cell.y, 0.78);
                    float lit = step(hash12(id + vInfo.z * 91.0), 0.1 + 0.38 * uNight);
                    // City lights switch on in a wave spreading from the centre
                    float wave = step(length(vWPos.xz - vec2(0.0, -30.0)) / 90.0, uIgnite);
                    int dj = int(vInfo.y + 0.5);
                    vec3 wcol = dj == 1 ? uDistrict[1] : dj == 2 ? uDistrict[2] : dj == 3 ? uDistrict[3] : uDistrict[0];
                    float aboveGround = step(0.4, vWPos.y) * step(vWPos.y, vInfo.x - 0.15);
                    totalEmissiveRadiance += wcol * win * lit * wave * aboveGround * (0.25 + 0.7 * uNight);
                }`);
    };

    const mesh = new THREE.InstancedMesh(geo, material, lots.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    lots.forEach((l, i) => {
        m.compose(V(l.x, 0, l.z), q, V(l.w, l.h, l.d));
        mesh.setMatrixAt(i, m);
    });
    mesh.computeBoundingSphere();
    return mesh;
}

// Ground with glowing street grid
function createGround(nightUniform, fogColor) {
    const spacing = caps.isMobile ? 2.4 : 1.6;
    const uniforms = { uNight: nightUniform, uFog: { value: fogColor }, uSpacing: { value: spacing } };
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(140, 160).rotateX(-Math.PI / 2),
        new THREE.ShaderMaterial({
            uniforms,
            vertexShader: /* glsl */ `
                varying vec3 vW;
                varying float vDepth;
                void main() {
                    vec4 w = modelMatrix * vec4(position, 1.0);
                    vW = w.xyz;
                    vec4 mv = viewMatrix * w;
                    vDepth = -mv.z;
                    gl_Position = projectionMatrix * mv;
                }
            `,
            fragmentShader: /* glsl */ `
                uniform float uNight;
                uniform vec3 uFog;
                uniform float uSpacing;
                varying vec3 vW;
                varying float vDepth;
                float line(float coord, float period, float width) {
                    float d = abs(fract(coord / period + 0.5) - 0.5) * period;
                    return 1.0 - smoothstep(width * 0.5, width, d);
                }
                void main() {
                    vec3 col = vec3(0.05, 0.06, 0.09);
                    // Streets: every 5th column / 6th row of lots, plus the central boulevard
                    float streets = max(line(vW.x, uSpacing * 5.0, 0.12), line(vW.z, uSpacing * 6.0, 0.12));
                    streets = max(streets, 1.0 - smoothstep(0.05, 0.15, abs(abs(vW.x) - 1.2)));
                    col += vec3(1.0, 0.7, 0.35) * streets * (0.15 + 0.85 * uNight) * 0.9;
                    float fogF = 1.0 - exp(-pow(vDepth * 0.011, 2.0));
                    gl_FragColor = vec4(mix(col, uFog, fogF), 1.0);
                    #include <tonemapping_fragment>
                    #include <colorspace_fragment>
                }
            `,
        }),
    );
    mesh.position.z = -45;
    return mesh;
}

// Sky dome: dusk -> night gradient
function createSky(nightUniform) {
    const uniforms = {
        uNight: nightUniform,
        uDuskTop: { value: SKY.duskTop }, uDuskHorizon: { value: SKY.duskHorizon },
        uNightTop: { value: SKY.nightTop }, uNightHorizon: { value: SKY.nightHorizon },
    };
    return new THREE.Mesh(
        new THREE.SphereGeometry(160, 32, 16),
        new THREE.ShaderMaterial({
            uniforms,
            side: THREE.BackSide,
            depthWrite: false,
            vertexShader: /* glsl */ `
                varying vec3 vDir;
                void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
            `,
            fragmentShader: /* glsl */ `
                uniform float uNight;
                uniform vec3 uDuskTop, uDuskHorizon, uNightTop, uNightHorizon;
                varying vec3 vDir;
                void main() {
                    float t = smoothstep(-0.05, 0.45, vDir.y);
                    vec3 top = mix(uDuskTop, uNightTop, uNight);
                    vec3 hor = mix(uDuskHorizon, uNightHorizon, uNight);
                    vec3 col = mix(hor, top, t);
                    // A few stars once it's dark
                    vec2 sp = floor(vDir.xz / (vDir.y + 0.4) * 120.0);
                    float star = step(0.997, fract(sin(dot(sp, vec2(12.9898, 78.233))) * 43758.5453));
                    col += star * uNight * smoothstep(0.15, 0.5, vDir.y) * 0.8;
                    gl_FragColor = vec4(col, 1.0);
                    #include <tonemapping_fragment>
                    #include <colorspace_fragment>
                }
            `,
        }),
    );
}

// Light streaks: cars on the boulevard and two avenues
function createTraffic() {
    const rand = mulberry32(99);
    const count = caps.isMobile ? 40 : 120;
    const quad = new THREE.BoxGeometry(0.1, 0.05, 0.35);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.instanceCount = count;
    const car = new Float32Array(count * 4);
    const lanes = [-1.35, -1.05, 1.05, 1.35, -8, 8];
    for (let i = 0; i < count; i++) {
        const lane = lanes[Math.floor(rand() * lanes.length)];
        const dir = lane < 0 ? 1 : -1; // opposite directions per side
        car.set([lane, (3 + rand() * 4) * dir, rand() * 110, rand()], i * 4);
    }
    geo.setAttribute('aCar', new THREE.InstancedBufferAttribute(car, 4));
    const uniforms = { uTime: { value: 0 } };
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
            attribute vec4 aCar;
            uniform float uTime;
            varying vec3 vCol;
            void main() {
                float z = 6.0 - mod(aCar.z + uTime * aCar.y, 110.0);
                vec3 p = position + vec3(aCar.x, 0.06, z);
                vCol = aCar.y > 0.0 ? vec3(1.6, 0.25, 0.2) : vec3(1.6, 1.4, 1.1); // tail lights / headlights
                gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vCol;
            void main() {
                gl_FragColor = vec4(vCol, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `,
    }));
    mesh.frustumCulled = false;
    return { mesh, update(time) { uniforms.uTime.value = time; } };
}

// ---------------------------------------------------------------------------
// Station set pieces
// ---------------------------------------------------------------------------
function createChartTowers() {
    const group = new THREE.Group();
    const heights = [2.0, 3.2, 2.6, 4.4, 3.6, 5.2, 4.2, 6.0, 5.0, 7.0];
    const geo = new THREE.BoxGeometry(0.8, 1, 0.8).translate(0, 0.5, 0);
    const a = new THREE.Color(0x22d3ee), b = new THREE.Color(0x10b981);
    const towers = heights.map((h, i) => {
        const color = a.clone().lerp(b, i / (heights.length - 1));
        const t = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1b2333, emissive: color, emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.4 }));
        t.position.set((i - (heights.length - 1) / 2) * 1.05, 0, -47);
        t.scale.y = 0.001;
        group.add(t);
        return { t, h, delay: i * 0.05 };
    });
    return {
        group,
        update(s) {
            const grow = smoothstep(2.2, 3, s);
            towers.forEach(({ t, h, delay }) => { t.scale.y = Math.max(0.001, h * smoothstep(delay, delay + 0.5, grow)); });
        },
    };
}

function createBillboards(textures) {
    const group = new THREE.Group();
    const center = V(0, 0, -59.5);
    const R = 7;
    const geo = new THREE.PlaneGeometry(2.4, 1.5);
    const frameGeo = new THREE.EdgesGeometry(geo);
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 6).translate(0, 0.5, 0);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });
    const boards = textures.map((tex, i) => {
        const r = Math.floor(i / 4), c = i % 4;
        const angle = THREE.MathUtils.degToRad(-36 + c * 24);
        const y = r === 0 ? 6.35 : 4.45;
        const pivot = new THREE.Group();
        pivot.position.set(center.x + Math.sin(angle) * R, y, center.z - Math.cos(angle) * R);
        pivot.lookAt(center.x, y, center.z);
        const board = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, color: 0xb8c2d6 }));
        board.userData.index = i;
        const frame = new THREE.LineSegments(frameGeo, new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.5 }));
        board.add(frame);
        pivot.add(board);
        if (r === 1) {
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.scale.y = y - 0.75;
            pole.position.set(pivot.position.x, 0, pivot.position.z);
            group.add(pole);
        }
        group.add(pivot);
        return { board, frame };
    });
    const picker = createCardPicker(boards.map((b) => b.board));
    return {
        group,
        picker,
        update(s, time) {
            picker.update();
            boards.forEach(({ board, frame }, i) => {
                const hv = picker.hoverAmount(i);
                board.position.z = hv * 0.5;
                board.rotation.x = -hv * 0.1;
                frame.material.opacity = 0.4 + hv * 0.6 + 0.1 * Math.sin(time * 3 + i);
            });
        },
    };
}

function createMonuments() {
    const group = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0xc9a25c, metalness: 1, roughness: 0.38, envMapIntensity: 0.6 });
    const rim = new THREE.MeshStandardMaterial({ color: 0x1b2333, emissive: 0xf59e0b, emissiveIntensity: 0.6 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x3a4256, roughness: 0.9 });
    const coin = new THREE.CylinderGeometry(0.75, 0.75, 0.14, 48).rotateX(Math.PI / 2);
    const ring = new THREE.TorusGeometry(0.75, 0.05, 8, 48);
    const pedestal = new THREE.BoxGeometry(1.2, 1.2, 1.2).translate(0, 0.6, 0);
    const medals = [-1, 0, 1].map((k) => {
        const base = new THREE.Mesh(pedestal, stone);
        base.position.set(k * 3, 0, -79 - Math.abs(k) * 0.6);
        group.add(base);
        const m = new THREE.Group();
        m.add(new THREE.Mesh(coin, metal), new THREE.Mesh(ring, rim));
        m.position.set(k * 3, 2.4 + (k === 0 ? 0.3 : 0), base.position.z);
        group.add(m);
        return m;
    });
    return {
        group,
        update(s, time) {
            medals.forEach((m, i) => {
                m.rotation.y = time * 0.6 + i * 1.3;
                m.position.y = 2.4 + (i === 1 ? 0.3 : 0) + Math.sin(time + i) * 0.1;
            });
        },
    };
}

export function create({ scene, camera, manager, textureUrls }) {
    camera.far = 400;
    camera.updateProjectionMatrix();

    const night = { value: 0 };
    const ignite = { value: caps.reducedMotion ? 1 : 0 };
    const fogColor = scene.fog.color;

    const sky = createSky(night);
    const buildings = createBuildings(night, ignite);
    const ground = createGround(night, fogColor);
    const traffic = createTraffic();
    const towers = createChartTowers();
    const billboards = createBillboards(loadProjectTextures(textureUrls, manager));
    const monuments = createMonuments();
    scene.add(sky, buildings, ground, traffic.mesh, towers.group, billboards.group, monuments.group);

    const hemi = new THREE.HemisphereLight(0xffb48a, 0x1a1f2e, 1.2);
    const sun = new THREE.DirectionalLight(0xffa36b, 1.6);
    sun.position.set(-40, 18, -20);
    scene.add(hemi, sun);

    const duskHemi = new THREE.Color(0xffb48a), nightHemi = new THREE.Color(0x3b4a7a);
    const duskSun = new THREE.Color(0xffa36b), nightSun = new THREE.Color(0x8fa8ff);
    const last = STATIONS.length - 1;

    return {
        stations: STATIONS,
        picker: billboards.picker,
        parallax: { x: 0.6, y: 0.35 },
        introDolly: 6,

        // Slow aerial drift over the city in the hero
        adjustCamera(camPos, camTarget, s, time) {
            const drift = 1 - smoothstep(0, 0.6, s);
            camPos.x += Math.sin(time * 0.08) * 3 * drift;
            camPos.z += Math.cos(time * 0.06) * 2 * drift;
        },

        ignite(gsap) {
            gsap.fromTo(ignite, { value: 0 }, { value: 1, duration: 2.8, ease: 'power2.out', delay: 0.2 });
        },
        igniteNow() { ignite.value = 1; },

        update(s, time) {
            // Dusk at the top of the page, full night by the showcase
            night.value = smoothstep(0.2, 4.2, s);
            sky.material.uniforms.uNight.value = night.value;
            hemi.color.copy(duskHemi).lerp(nightHemi, night.value);
            hemi.intensity = lerp(1.2, 0.35, night.value);
            sun.color.copy(duskSun).lerp(nightSun, night.value);
            sun.intensity = lerp(1.6, 0.35, night.value);
            // Fog sits between the horizon glow and the sky so silhouettes stay readable
            fogColor.copy(SKY.duskTop).lerp(SKY.duskHorizon, 0.3).lerp(SKY.nightHorizon, night.value).multiplyScalar(0.8);
            scene.fog.density = lerp(0.011, 0.007, proximity(s, last, 0.8));
            sky.position.copy(camera.position); // keep the dome centred on the viewer

            traffic.update(time);
            towers.update(s);
            billboards.update(s, time);
            monuments.update(s, time);
        },
    };
}
