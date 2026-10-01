// Building blocks shared by every concept: the camera path, clickable project
// cards and project screenshot textures.
import * as THREE from 'three';
import { proximity } from './utils.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Station order must match the [data-station] attributes in index.html
export const STATION_NAMES = ['hero', 'about', 'experience', 'skills', 'showcase', 'certificates', 'contact'];
export const SHOWCASE_STATION = STATION_NAMES.indexOf('showcase');

// ---------------------------------------------------------------------------
// Camera path through a concept's stations ({ camera, target } per station)
// ---------------------------------------------------------------------------
export function createCameraPath(stations) {
    const camCurve = new THREE.CatmullRomCurve3(stations.map((s) => s.camera.clone()), false, 'catmullrom', 0.35);
    const lookCurve = new THREE.CatmullRomCurve3(stations.map((s) => s.target.clone()), false, 'catmullrom', 0.35);
    const last = stations.length - 1;

    return {
        // Move the hero pose (first control point) without rebuilding the curve
        setHeroPose(camera, target) {
            camCurve.points[0].copy(camera);
            lookCurve.points[0].copy(target);
        },
        sample(s, outPos, outTarget) {
            const t = Math.min(Math.max(s / last, 0), 1);
            camCurve.getPoint(t, outPos);
            lookCurve.getPoint(t, outTarget);
        },
    };
}

// ---------------------------------------------------------------------------
// Project screenshots from the HTML cards, loaded through the shared manager
// ---------------------------------------------------------------------------
export function loadProjectTextures(urls, manager) {
    const loader = new THREE.TextureLoader(manager);
    return urls.slice(0, 8).map((url) => {
        const tex = loader.load(url);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        return tex;
    });
}

// ---------------------------------------------------------------------------
// Hover picking for 3D project cards. Each mesh needs userData.index set to
// the matching .project-card index. Picking only runs near the Showcase station.
// ---------------------------------------------------------------------------
export function createCardPicker(meshes, station = SHOWCASE_STATION) {
    const raycaster = new THREE.Raycaster();
    const hover = meshes.map(() => 0);
    let hovered = null;

    return {
        get hovered() { return hovered; },
        // Smoothed 0..1 hover amount per card, for animation
        hoverAmount: (i) => hover[i],
        pick(ndc, camera, s) {
            hovered = null;
            if (ndc && proximity(s, station, 0.6) >= 0.35) {
                raycaster.setFromCamera(ndc, camera);
                const hit = raycaster.intersectObjects(meshes, false)[0];
                hovered = hit ? hit.object.userData.index : null;
            }
            return hovered;
        },
        update() {
            meshes.forEach((m, i) => {
                const target = hovered === m.userData.index ? 1 : 0;
                hover[i] += (target - hover[i]) * 0.12;
            });
        },
    };
}

// ---------------------------------------------------------------------------
// Hero framing: a straight-on camera pose that places `focus` (world) over the
// profile photo, with `worldRadius` matching the photo's on-screen radius.
// Measured for scrollY = 0, so it stays correct wherever the page is scrolled.
// ---------------------------------------------------------------------------
export function framePhoto(camera, focus, worldRadius, { minDist = 3, maxDist = 16 } = {}) {
    const pic = document.querySelector('#profile .section__pic-container');
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    let D = 8, ox = 0, oy = 0;
    if (pic && pic.offsetWidth) {
        const r = pic.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + window.scrollY + r.height / 2; // document coords
        const radiusPx = pic.offsetWidth / 2; // offsetWidth ignores reveal/float transforms
        D = Math.min(Math.max((worldRadius * innerHeight) / (radiusPx * 2 * tanHalf), minDist), maxDist);
        const worldPerPx = (2 * D * tanHalf) / innerHeight;
        ox = (cx - innerWidth / 2) * worldPerPx;
        oy = -(cy - innerHeight / 2) * worldPerPx;
    }
    return {
        camera: V(focus.x - ox, focus.y - oy, focus.z + D),
        target: V(focus.x - ox, focus.y - oy, focus.z),
    };
}
