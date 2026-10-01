// Concept: "Retro Terminal" — a beige CRT on a desk. The hero frames your
// photo on its screen; scrolling dives through the glass into a green
// wireframe cyberspace, and Contact pulls back out to the desk.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { V, createCardPicker, framePhoto, loadProjectTextures } from '../shared.js';
import { caps, mulberry32, proximity, smoothstep } from '../utils.js';

const PHOSPHOR = new THREE.Color(0x33ff88);
const BG = 0x040805;

export const theme = {
    background: BG,
    fog: 0.028,
    bloom: { strength: 0.45, radius: 0.35, threshold: 0.72 }, // only phosphor glows, not the beige plastic
};

const SCREEN = { w: 2.0, h: 1.5, center: V(0, 0.1, 0.52) };

const STATIONS = [
    { camera: V(0, 0.1, 6),     target: SCREEN.center.clone() }, // hero (reframed in onLayout)
    { camera: V(0, 0.6, -8),    target: V(0, 0.2, -16) },        // about: wireframe globe
    { camera: V(0, 0.8, -22),   target: V(0, 0.3, -30) },        // experience: three shapes
    { camera: V(2.4, 1.6, -38.5), target: V(0, -0.8, -46) },     // skills: wireframe bars
    { camera: V(0, 0.3, -56),   target: V(0, 0, -64) },          // showcase: terminal windows
    { camera: V(0, 0.3, -71),   target: V(0, 0, -78) },          // certificates: medals
    // contact: back at the desk, monitor sitting top-right beside the cards
    { camera: V(2.5, 1, 7.5),   target: V(-2.2, -1.4, 0) },
];

const wire = (opacity = 0.9) => new THREE.LineBasicMaterial({ color: PHOSPHOR, transparent: true, opacity });

// ---------------------------------------------------------------------------
// Terminal output drawn into a canvas and shown on the CRT
// ---------------------------------------------------------------------------
const SCRIPT = [
    'YUSUF-OS v1.0   (c) 2026',
    '',
    '> python portfolio.py',
    '[ok] loading ledgers ......... done',
    '[ok] syncing QuickBooks API .. done',
    '[ok] CRA compliance check .... PASS',
    '[ok] automation daemons ...... 24/7',
    '',
    '> whoami',
    'Operations & Financial Technologist',
    '',
    '> scroll --dive',
];

function createTerminalCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const total = SCRIPT.join('\n').length;
    let lastDrawn = -1;

    function draw(time) {
        // Type ~28 chars/second, hold, then loop
        const cycle = total / 28 + 4;
        const chars = Math.min(total, Math.floor((time % cycle) * 28));
        const cursorOn = Math.floor(time * 2) % 2 === 0;
        const key = chars * 2 + (cursorOn ? 1 : 0);
        if (key === lastDrawn) return;
        lastDrawn = key;

        ctx.fillStyle = '#031006';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = '22px "JetBrains Mono", ui-monospace, monospace';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#7dffb0';

        let remaining = chars;
        let y = 34;
        let cx = 40;
        for (const line of SCRIPT) {
            if (remaining <= 0) break;
            const shown = line.slice(0, remaining);
            ctx.fillText(shown, 40, y);
            cx = 40 + ctx.measureText(shown).width;
            remaining -= line.length + 1;
            if (remaining > 0) y += 32;
        }
        if (cursorOn) ctx.fillRect(cx + 4, y + 2, 12, 22);
        texture.needsUpdate = true;
    }

    draw(0);
    return { texture, draw };
}

// ---------------------------------------------------------------------------
// Desk + CRT monitor + keyboard
// ---------------------------------------------------------------------------
function createDesk(terminal) {
    const group = new THREE.Group();
    const beige = new THREE.MeshStandardMaterial({ color: 0xb9ae90, roughness: 0.7, envMapIntensity: 0.25 });
    const darkBeige = new THREE.MeshStandardMaterial({ color: 0x8f8569, roughness: 0.75, envMapIntensity: 0.25 });

    // Desk
    const desk = new THREE.Mesh(new THREE.BoxGeometry(9, 0.18, 4.5), new THREE.MeshStandardMaterial({ color: 0x2b1d12, roughness: 0.75 }));
    desk.position.set(0, -1.35, 0);
    group.add(desk);

    // Monitor body, neck and base
    const body = new THREE.Mesh(new RoundedBoxGeometry(2.6, 2.15, 2.2, 4, 0.18), beige);
    body.position.set(0, 0.1, -0.6);
    group.add(body);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.8), darkBeige);
    neck.position.set(0, -1.1, -0.6);
    group.add(neck);
    const base = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.12, 1.3, 2, 0.05), beige);
    base.position.set(0, -1.21, -0.5);
    group.add(base);

    // Power LED
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshBasicMaterial({ color: PHOSPHOR }));
    led.position.set(1.05, -0.82, 0.51);
    group.add(led);

    // Slightly bulged CRT glass with scanlines, barrel distortion and phosphor glow
    const screenGeo = new THREE.PlaneGeometry(SCREEN.w, SCREEN.h, 24, 18);
    const p = screenGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) / (SCREEN.w / 2), y = p.getY(i) / (SCREEN.h / 2);
        p.setZ(i, 0.07 * (1 - 0.5 * (x * x + y * y)));
    }
    const screenUniforms = {
        uMap: { value: terminal.texture },
        uTime: { value: 0 },
        uPower: { value: caps.reducedMotion ? 1 : 0 },
        uDive: { value: 0 },
    };
    const screen = new THREE.Mesh(screenGeo, new THREE.ShaderMaterial({
        uniforms: screenUniforms,
        transparent: true,
        vertexShader: /* glsl */ `
            varying vec2 vUv;
            void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
            uniform sampler2D uMap;
            uniform float uTime;
            uniform float uPower;
            uniform float uDive;
            varying vec2 vUv;
            void main() {
                vec2 cc = vUv - 0.5;
                vec2 uv = vUv + cc * dot(cc, cc) * 0.22;          // barrel distortion
                float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
                vec3 col = texture2D(uMap, uv).rgb * inside;
                col *= 0.82 + 0.18 * sin(uv.y * 480.0 * 3.14159);   // scanlines
                col *= 0.97 + 0.03 * sin(uTime * 55.0);              // flicker
                col *= smoothstep(0.78, 0.25, length(cc));           // vignette
                col += vec3(0.01, 0.05, 0.02);
                // Power-on: a bright line that opens vertically
                float band = step(abs(vUv.y - 0.5), uPower * 0.5 + 0.002);
                col = col * band + vec3(0.6, 1.0, 0.75) * smoothstep(0.02, 0.0, abs(abs(vUv.y - 0.5) - uPower * 0.5)) * (1.0 - uPower);
                // Diving in: the glass floods with light, then clears so the camera passes through
                col = mix(col * 1.1, vec3(0.5, 1.0, 0.65) * 2.0, smoothstep(0.2, 0.7, uDive));
                gl_FragColor = vec4(col, 1.0 - smoothstep(0.7, 1.0, uDive));
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `,
    }));
    screen.position.set(SCREEN.center.x, SCREEN.center.y, 0.51); // just proud of the bezel
    group.add(screen);

    // Keyboard with instanced keys
    const kb = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.12, 0.9, 2, 0.04), beige);
    kb.position.set(0, -1.2, 1.15);
    kb.rotation.x = 0.06;
    group.add(kb);
    const cols = 14, rows = 4;
    const keys = new THREE.InstancedMesh(new RoundedBoxGeometry(0.15, 0.06, 0.15, 1, 0.02), darkBeige, cols * rows);
    const m = new THREE.Matrix4();
    for (let r = 0, n = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++, n++) {
            m.makeTranslation((c - (cols - 1) / 2) * 0.175, -1.11 - r * 0.012, 0.88 + r * 0.18);
            keys.setMatrixAt(n, m);
        }
    }
    group.add(keys);

    // Light: warm desk lamp + green spill from the screen
    const lamp = new THREE.PointLight(0xffc98a, 9, 14, 2);
    lamp.position.set(-3.2, 2.6, 2.2);
    const spill = new THREE.PointLight(0x33ff88, 1.2, 7, 2);
    spill.position.set(0, -0.4, 2.6); // aimed at the desk/keyboard, not the bezel
    group.add(lamp, spill, new THREE.AmbientLight(0x1a261c, 0.8));

    return { group, screenUniforms, spill };
}

// ---------------------------------------------------------------------------
// Cyberspace: a scrolling wireframe terrain and falling glyph columns
// ---------------------------------------------------------------------------
function createTerrain() {
    const geo = new THREE.PlaneGeometry(80, 100, caps.isMobile ? 40 : 80, caps.isMobile ? 50 : 100);
    geo.rotateX(-Math.PI / 2);
    const uniforms = { uTime: { value: 0 }, uColor: { value: PHOSPHOR.clone() } };
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */ `
            uniform float uTime;
            varying vec3 vWorld;
            varying float vFade;
            void main() {
                vec3 p = position;
                vec4 w = modelMatrix * vec4(p, 1.0);
                float z = w.z + uTime * 2.0;
                float h = sin(w.x * 0.35 + z * 0.22) * sin(z * 0.17) + 0.6 * sin(w.x * 0.8 - z * 0.31);
                w.y += h * 1.0 * smoothstep(4.0, 12.0, abs(w.x)); // flat valley along the camera path
                vWorld = vec3(w.x, w.y, z);
                vec4 mv = viewMatrix * w;
                vFade = smoothstep(55.0, 4.0, -mv.z) * smoothstep(2.0, 9.0, -mv.z); // fade far + right at the lens
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor;
            varying vec3 vWorld;
            varying float vFade;
            void main() {
                vec2 g = abs(fract(vWorld.xz) - 0.5) / fwidth(vWorld.xz);
                float line = 1.0 - min(min(g.x, g.y), 1.0);
                float a = (line * 0.55 + 0.03) * vFade;
                gl_FragColor = vec4(uColor * (0.4 + line), a);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `,
    }));
    mesh.position.set(0, -3, -48);
    return { mesh, update(time) { uniforms.uTime.value = time; } };
}

function createGlyphAtlas() {
    const chars = '01$#%&*+=<>/{}[]()ABCDEFXYZ∑∆λπΩアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ';
    const size = 512, cell = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 46px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 64; i++) {
        ctx.fillText(chars[i % chars.length], (i % 8) * cell + cell / 2, Math.floor(i / 8) * cell + cell / 2 + 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return tex;
}

function createRain() {
    const rand = mulberry32(1337);
    const columns = caps.isMobile ? 40 : 110;
    const rows = 22;
    const count = columns * rows;

    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    geo.instanceCount = count;

    const col = new Float32Array(count * 4);
    const row = new Float32Array(count * 2);
    for (let c = 0, n = 0; c < columns; c++) {
        const side = rand() < 0.5 ? -1 : 1;
        const x = side * (3.5 + rand() * 13);
        const z = -4 - rand() * 86;
        const speed = 4 + rand() * 7;
        const offset = rand() * 40;
        const top = 4 + rand() * 4;
        for (let r = 0; r < rows; r++, n++) {
            col.set([x, z, speed, offset], n * 4);
            row.set([r, top + rand() * 0.001], n * 2);
        }
    }
    geo.setAttribute('aCol', new THREE.InstancedBufferAttribute(col, 4));
    geo.setAttribute('aRow', new THREE.InstancedBufferAttribute(row, 2));

    const uniforms = {
        uTime: { value: 0 },
        uAtlas: { value: createGlyphAtlas() },
        uColor: { value: PHOSPHOR.clone() },
        uCell: { value: 0.34 },
        uRows: { value: rows },
    };
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
            attribute vec4 aCol;
            attribute vec2 aRow;
            uniform float uTime;
            uniform float uCell;
            uniform float uRows;
            varying vec2 vUv;
            varying float vBright;
            varying float vHead;
            void main() {
                float head = mod(uTime * aCol.z + aCol.w, uRows + 14.0);
                float d = head - aRow.x;                  // rows behind the falling head
                vBright = d < 0.0 ? 0.0 : clamp(1.0 - d / 12.0, 0.0, 1.0);
                vHead = step(0.0, d) * step(d, 1.0);
                float glyph = mod(floor(aCol.w * 13.0 + aRow.x * 7.0 + floor(uTime * 4.0 + aRow.x) * 3.0), 64.0);
                vec2 cell = vec2(mod(glyph, 8.0), 7.0 - floor(glyph / 8.0));
                vUv = (cell + uv) / 8.0;
                vec3 p = vec3(aCol.x, aRow.y - aRow.x * uCell, aCol.y) + vec3(position.xy * uCell * 0.92, 0.0);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform sampler2D uAtlas;
            uniform vec3 uColor;
            varying vec2 vUv;
            varying float vBright;
            varying float vHead;
            void main() {
                if (vBright < 0.01) discard;
                float g = texture2D(uAtlas, vUv).r;
                vec3 c = mix(uColor * vBright, vec3(0.8, 1.0, 0.85) * 1.5, vHead);
                gl_FragColor = vec4(c * g, g * vBright);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `,
    }));
    mesh.frustumCulled = false;
    quad.dispose();
    return { mesh, update(time) { uniforms.uTime.value = time; } };
}

// ---------------------------------------------------------------------------
// Wireframe set pieces for each station
// ---------------------------------------------------------------------------
function createPieces(textures) {
    const group = new THREE.Group();

    // About: a big rotating wireframe globe
    const globe = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.2, 2)), wire(0.55));
    globe.position.set(0, 0.4, -16);
    group.add(globe);

    // Experience: one shape per skill group
    const shapes = [
        new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.3, 1.3, 1.3)), wire()),
        new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.OctahedronGeometry(0.95, 0)), wire()),
        new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.TorusGeometry(0.62, 0.22, 8, 20)), wire(0.7)),
    ];
    shapes.forEach((s, i) => {
        s.position.set((i - 1) * 2.8, 0.3, -30);
        group.add(s);
    });

    // Skills: wireframe bar chart on the terrain floor
    const barGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.5, 1, 0.5).translate(0, 0.5, 0));
    const heights = [1.2, 2.1, 1.6, 2.9, 2.3, 3.4, 2.7, 3.9, 3.1, 4.4];
    const bars = heights.map((h, i) => {
        const b = new THREE.LineSegments(barGeo, wire());
        b.position.set((i - (heights.length - 1) / 2) * 0.85, -2, -46);
        group.add(b);
        return { b, h, delay: i * 0.05 };
    });

    // Showcase: project screenshots as green-tinted terminal windows on an arc
    const center = V(0, 0, -57.5);
    const R = 7;
    const winGeo = new THREE.PlaneGeometry(2.4, 1.5);
    const winEdges = new THREE.EdgesGeometry(winGeo);
    const barGeoTitle = new THREE.PlaneGeometry(2.4, 0.16);
    const titleMat = new THREE.MeshBasicMaterial({ color: 0x1b7a44 });
    const windows = textures.map((tex, i) => {
        const r = Math.floor(i / 4), c = i % 4;
        const angle = THREE.MathUtils.degToRad(-36 + c * 24);
        const pivot = new THREE.Group();
        pivot.position.set(center.x + Math.sin(angle) * R, center.y + (r === 0 ? 1.05 : -0.95), center.z - Math.cos(angle) * R);
        pivot.lookAt(center.x, pivot.position.y, center.z);
        const win = new THREE.Mesh(winGeo, new THREE.MeshBasicMaterial({ map: tex, color: 0x7dffb0 }));
        win.userData.index = i;
        const frame = new THREE.LineSegments(winEdges, wire(0.6));
        const title = new THREE.Mesh(barGeoTitle, titleMat);
        title.position.y = 0.83;
        win.add(frame, title);
        pivot.add(win);
        group.add(pivot);
        return { win, frame };
    });
    const picker = createCardPicker(windows.map((w) => w.win));

    // Certificates: three spinning wireframe medals
    const medals = [-1, 0, 1].map((k) => {
        const m = new THREE.Group();
        m.add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.TorusGeometry(0.85, 0.08, 6, 32)), wire()));
        m.add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.OctahedronGeometry(0.4, 0)), wire()));
        m.position.set(k * 2.6, k === 0 ? 0.25 : -0.1, -78);
        group.add(m);
        return m;
    });

    return {
        group,
        picker,
        update(s, time) {
            globe.rotation.y = time * 0.15;
            globe.rotation.x = time * 0.05;
            shapes.forEach((sh, i) => {
                sh.rotation.y = time * (0.5 + i * 0.15);
                sh.rotation.x = time * 0.3;
                sh.position.y = 0.3 + Math.sin(time + i * 1.7) * 0.15;
            });
            const grow = smoothstep(2.2, 3, s);
            bars.forEach(({ b, h, delay }) => {
                b.scale.y = Math.max(0.001, h * smoothstep(delay, delay + 0.5, grow));
            });
            picker.update();
            windows.forEach(({ win, frame }, i) => {
                const hv = picker.hoverAmount(i);
                win.position.z = hv * 0.6;
                win.rotation.x = -hv * 0.12;
                frame.material.opacity = 0.5 + hv * 0.5;
            });
            medals.forEach((m, i) => { m.rotation.y = time * 0.7 + i * 1.3; });
        },
    };
}

export function create({ scene, camera, manager, textureUrls }) {
    const terminal = createTerminalCanvas();
    const desk = createDesk(terminal);
    const terrain = createTerrain();
    const rain = createRain();
    const pieces = createPieces(loadProjectTextures(textureUrls, manager));
    scene.add(desk.group, terrain.mesh, rain.mesh, pieces.group);

    // The canvas font may load after the first draw
    if (document.fonts) document.fonts.ready.then(() => terminal.draw(performance.now() / 1000 + 0.01));

    const last = STATIONS.length - 1;

    return {
        stations: STATIONS,
        picker: pieces.picker,
        parallax: { x: 0.15, y: 0.1 },
        introDolly: 1.5,

        // Your photo sits on the CRT screen in the hero
        onLayout({ path }) {
            const pose = framePhoto(camera, SCREEN.center, SCREEN.h * 0.5 * 0.9, { minDist: 2.5 });
            path.setHeroPose(pose.camera, pose.target);
        },

        ignite(gsap) {
            gsap.fromTo(desk.screenUniforms.uPower, { value: 0 }, { value: 1, duration: 1.1, ease: 'power2.inOut', delay: 0.2 });
        },
        igniteNow() { desk.screenUniforms.uPower.value = 1; },

        update(s, time) {
            terminal.draw(time);
            desk.screenUniforms.uTime.value = time;
            // Dive by distance to the glass: brighten as we approach, clear as we pass through
            const gap = camera.position.z - SCREEN.center.z;
            desk.screenUniforms.uDive.value = 1 - smoothstep(0.2, 2.6, gap);
            desk.spill.intensity = 1.2 + 3 * desk.screenUniforms.uDive.value;

            // Fog clears for the wide desk shot at the end
            scene.fog.density = 0.028 * (1 - 0.6 * proximity(s, last, 0.6));

            terrain.update(time);
            rain.update(time);
            pieces.update(s, time);
        },
    };
}
