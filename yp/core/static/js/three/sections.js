// Data Engine set pieces: one 3D scene per page section.
import * as THREE from 'three';
import { CONFIG, caps, proximity, smoothstep } from './utils.js';
import { V, createCardPicker, loadProjectTextures } from './shared.js';

// Station poses for the Data Engine concept live in concepts/engine.js
export const GRID_CENTER = V(0, 0, -18);

const COLORS = {
    cyan: new THREE.Color(CONFIG.colors.cyan),
    emerald: new THREE.Color(CONFIG.colors.emerald),
};

// ---------------------------------------------------------------------------
// Experience: three floating glass panels, one per skill group
// ---------------------------------------------------------------------------
function createExperience() {
    const group = new THREE.Group();
    group.position.set(0, 0, -34);

    const glass = caps.isMobile
        ? new THREE.MeshStandardMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.16, roughness: 0.2, metalness: 0.1 })
        : new THREE.MeshPhysicalMaterial({
            color: 0xd8f6ff,
            transmission: 1,
            thickness: 0.6,
            roughness: 0.14,
            ior: 1.45,
            metalness: 0,
            clearcoat: 1,
            clearcoatRoughness: 0.1,
        });
    const edgeMat = new THREE.LineBasicMaterial({ color: CONFIG.colors.cyan, transparent: true, opacity: 0.55 });
    const glowMat = (c) => new THREE.MeshStandardMaterial({ color: 0x0b1220, emissive: c, emissiveIntensity: 0.75, roughness: 0.4 });

    const panelGeo = new THREE.BoxGeometry(2.2, 3, 0.12);
    const edgeGeo = new THREE.EdgesGeometry(panelGeo);

    // Emblems: database stack (Web & Databases), gear (IT & Automation), coin (Finance & Tax)
    function database() {
        const g = new THREE.Group();
        const disc = new THREE.CylinderGeometry(0.42, 0.42, 0.16, 32);
        for (let i = 0; i < 3; i++) {
            const m = new THREE.Mesh(disc, glowMat(COLORS.cyan));
            m.position.y = (i - 1) * 0.26;
            g.add(m);
        }
        return g;
    }
    function gear() {
        const g = new THREE.Group();
        const mat = glowMat(COLORS.emerald.clone().lerp(COLORS.cyan, 0.4));
        g.add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.1, 12, 32), mat));
        const tooth = new THREE.BoxGeometry(0.16, 0.18, 0.18);
        for (let i = 0; i < 8; i++) {
            const t = new THREE.Mesh(tooth, mat);
            const a = (i / 8) * Math.PI * 2;
            t.position.set(Math.cos(a) * 0.48, Math.sin(a) * 0.48, 0);
            t.rotation.z = a;
            g.add(t);
        }
        return g;
    }
    function coin() {
        const g = new THREE.Group();
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.1, 40), glowMat(COLORS.emerald));
        c.rotation.x = Math.PI / 2;
        g.add(c);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.035, 8, 40), glowMat(COLORS.cyan));
        g.add(ring);
        return g;
    }

    const panels = [database, gear, coin].map((makeEmblem, i) => {
        const panel = new THREE.Group();
        panel.position.x = (i - 1) * 2.75;
        panel.rotation.y = (1 - i) * 0.22;
        panel.add(new THREE.Mesh(panelGeo, glass));
        panel.add(new THREE.LineSegments(edgeGeo, edgeMat));
        const emblem = makeEmblem();
        emblem.position.z = 0.02;
        emblem.scale.setScalar(1.1);
        panel.add(emblem);
        group.add(panel);
        return { panel, emblem, baseY: 0, phase: i * 1.7 };
    });

    return {
        group,
        update(s, time) {
            const near = proximity(s, 2, 0.9);
            panels.forEach((p, i) => {
                p.panel.position.y = Math.sin(time * 0.8 + p.phase) * 0.18 + (1 - near) * -0.8;
                p.emblem.rotation.y = time * (0.6 + i * 0.15);
                p.panel.scale.setScalar(0.85 + 0.15 * near);
            });
            edgeMat.opacity = 0.2 + 0.5 * near;
        },
    };
}

// ---------------------------------------------------------------------------
// Skills: bar-chart columns grow out of a grid floor
// ---------------------------------------------------------------------------
function createSkills() {
    const group = new THREE.Group();
    group.position.set(0, -1.6, -50);

    const floor = new THREE.GridHelper(16, 32, CONFIG.colors.cyan, 0x12324a);
    floor.material.transparent = true;
    floor.material.opacity = 0.45;
    group.add(floor);

    const heights = [1.2, 2.1, 1.6, 2.9, 2.3, 3.4, 2.7, 3.9, 3.1, 4.4];
    const geo = new THREE.BoxGeometry(0.5, 1, 0.5);
    geo.translate(0, 0.5, 0); // grow from the floor up
    const bars = heights.map((h, i) => {
        const t = i / (heights.length - 1);
        const color = COLORS.cyan.clone().lerp(COLORS.emerald, t);
        const bar = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
            color: 0x0b1220,
            emissive: color,
            emissiveIntensity: 0.6,
            metalness: 0.3,
            roughness: 0.35,
        }));
        bar.position.set((i - (heights.length - 1) / 2) * 0.85, 0, 0);
        bar.scale.y = 0.001;
        group.add(bar);
        return { bar, h, delay: i * 0.05 };
    });

    return {
        group,
        update(s) {
            // Bars grow as the Skills station approaches and stay grown after it
            const grow = smoothstep(2.2, 3, s);
            bars.forEach(({ bar, h, delay }) => {
                const g = smoothstep(delay, delay + 0.5, grow);
                bar.scale.y = Math.max(0.001, h * g);
            });
        },
    };
}

// ---------------------------------------------------------------------------
// Showcase: project screenshots as 3D cards on a curved arc (2 rows of 4)
// ---------------------------------------------------------------------------
function createShowcase(textureUrls, manager) {
    const group = new THREE.Group();
    const center = V(0, 0, -68);
    const R = 7;
    const textures = loadProjectTextures(textureUrls, manager);
    const geo = new THREE.PlaneGeometry(2.4, 1.5);
    const frameGeo = new THREE.EdgesGeometry(geo);

    const cards = textures.map((tex, i) => {
        const row = Math.floor(i / 4);
        const col = i % 4;
        const angle = THREE.MathUtils.degToRad(-36 + col * 24);

        const pivot = new THREE.Group();
        pivot.position.set(center.x + Math.sin(angle) * R, center.y + (row === 0 ? 0.95 : -0.95), center.z - Math.cos(angle) * R);
        pivot.lookAt(center.x, pivot.position.y, center.z);

        const card = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, color: 0x8a96a8, transparent: true, opacity: 0.9 }));
        card.userData.index = i;
        const frame = new THREE.LineSegments(frameGeo, new THREE.LineBasicMaterial({ color: CONFIG.colors.cyan, transparent: true, opacity: 0.35 }));
        card.add(frame);
        pivot.add(card);
        group.add(pivot);
        return { card, frame };
    });

    const picker = createCardPicker(cards.map((c) => c.card));

    return {
        group,
        picker,
        update(s, time) {
            picker.update();
            cards.forEach((c, i) => {
                const h = picker.hoverAmount(i);
                c.card.position.z = h * 0.6 + Math.sin(time * 0.9 + i) * 0.05;
                c.card.rotation.x = -h * 0.12;
                c.card.rotation.y = Math.sin(time * 0.5 + i * 0.8) * 0.04 + h * 0.1;
                c.frame.material.opacity = 0.3 + h * 0.7;
            });
        },
    };
}

// ---------------------------------------------------------------------------
// Certificates: three rotating metallic medals
// ---------------------------------------------------------------------------
function createCertificates() {
    const group = new THREE.Group();
    group.position.set(0, 0, -88);

    const metal = new THREE.MeshStandardMaterial({ color: 0xbfeffa, metalness: 1, roughness: 0.28 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x0b1220, emissive: COLORS.emerald, emissiveIntensity: 0.8 });
    const coinGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.16, 64);
    coinGeo.rotateX(Math.PI / 2);
    const rimGeo = new THREE.TorusGeometry(0.9, 0.05, 10, 64);
    const starGeo = new THREE.OctahedronGeometry(0.32, 0);

    const medals = [-1, 0, 1].map((k, i) => {
        const medal = new THREE.Group();
        medal.position.set(k * 2.6, k === 0 ? 0.25 : -0.1, 0);
        medal.add(new THREE.Mesh(coinGeo, metal));
        medal.add(new THREE.Mesh(rimGeo, rimMat));
        const star = new THREE.Mesh(starGeo, rimMat);
        star.position.z = 0.12;
        star.scale.set(1, 1, 0.3);
        medal.add(star);
        group.add(medal);
        return { medal, phase: i * 1.3 };
    });

    return {
        group,
        update(s, time) {
            medals.forEach(({ medal, phase }) => {
                medal.rotation.y = time * 0.7 + phase;
                medal.position.y += (Math.sin(time + phase) * 0.15 - medal.position.y) * 0.05;
            });
        },
    };
}

// ---------------------------------------------------------------------------
// Data streams: thin glowing lines linking the stations into one "engine"
// (most visible from the pulled-back Contact view)
// ---------------------------------------------------------------------------
function createStreams(stationTargets) {
    // Runs just below the stations like a conduit, so it never cuts through them
    const pts = stationTargets.map((t) => t.clone().add(V(0, -2.6, 0)));
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 240, 0.012, 6, false);
    const mat = new THREE.MeshBasicMaterial({ color: CONFIG.colors.cyan, transparent: true, opacity: 0.0 });
    const mesh = new THREE.Mesh(geo, mat);
    return {
        mesh,
        update(s, time) {
            mat.opacity = (0.08 + 0.6 * proximity(s, 6, 0.8)) * (0.75 + 0.25 * Math.sin(time * 2));
        },
    };
}

export function createSections(scene, { textureUrls, manager, streamTargets }) {
    const parts = {
        experience: createExperience(),
        skills: createSkills(),
        showcase: createShowcase(textureUrls, manager),
        certificates: createCertificates(),
        streams: createStreams(streamTargets),
    };
    scene.add(parts.experience.group, parts.skills.group, parts.showcase.group, parts.certificates.group, parts.streams.mesh);

    // A little rim light so the metal reads well against the dark background
    const key = new THREE.DirectionalLight(0xbfefff, 1.2);
    key.position.set(5, 8, 6);
    scene.add(key, new THREE.AmbientLight(0x1b2a3a, 0.6));

    return {
        parts,
        update(s, time) {
            parts.experience.update(s, time);
            parts.skills.update(s, time);
            parts.showcase.update(s, time);
            parts.certificates.update(s, time);
            parts.streams.update(s, time);
        },
    };
}
