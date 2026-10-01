// Concept: "The Data Engine" — a glowing core, orbiting ledger cells that
// snap into a grid, glass panels, bar charts, project cards and medals.
import { createCore, createParticles, createStars } from '../hero.js';
import { createSections, GRID_CENTER } from '../sections.js';
import { V, framePhoto } from '../shared.js';
import { CONFIG, caps, lerp, particleCount, proximity, smoothstep } from '../utils.js';

export const theme = {
    background: CONFIG.colors.background,
    fog: 0.018,
    bloom: CONFIG.bloom,
};

// Camera pose for each station. The hero pose is recalculated in onLayout()
// so the core frames the profile photo.
const STATIONS = [
    { camera: V(0, 0, 8),         target: V(0, 0, 0) },      // hero
    { camera: V(-2.6, 1.2, -9),   target: V(0.4, 0, -18) },  // about
    { camera: V(0, 0.4, -26.5),   target: V(0, 0, -34) },    // experience
    { camera: V(7.5, 4.2, -39.5), target: V(0, 0, -50) },    // skills
    { camera: V(0, 0.3, -66.5),   target: V(0, 0, -75) },    // showcase
    { camera: V(0, 0.3, -81),     target: V(0, 0, -88) },    // certificates
    // Pull back past the core: it pulses top-right while the engine trails off behind it
    { camera: V(-6, -3, 10),      target: V(3, 2, -40) },    // contact
];

export function create({ scene, manager, textureUrls }) {
    const core = createCore();
    const particles = createParticles(particleCount(), GRID_CENTER);
    const stars = createStars(Math.round(CONFIG.stars * (caps.isMobile ? 0.5 : 1)));
    scene.add(core.group, particles.mesh, stars.points);

    const sections = createSections(scene, {
        textureUrls,
        manager,
        streamTargets: STATIONS.slice(0, 6).map((st) => st.target),
    });
    const last = STATIONS.length - 1;
    const igniteUniforms = [core.uniforms.uIgnite, particles.uniforms.uIgnite];

    return {
        stations: STATIONS,
        picker: sections.parts.showcase.picker,
        introDolly: 4,

        // Frame the profile photo inside the core's halo at any viewport size
        onLayout({ path, camera }) {
            const pose = framePhoto(camera, V(0, 0, 0), CONFIG.coreRadius * 0.85, { minDist: 4.5 });
            path.setHeroPose(pose.camera, pose.target);
        },

        setPixelRatio(pr) {
            stars.uniforms.uPixelRatio.value = pr;
        },

        ignite(gsap) {
            gsap.to(igniteUniforms, { value: 1, duration: 2.4, ease: 'expo.out' });
        },
        igniteNow() {
            igniteUniforms.forEach((u) => { u.value = 1; });
        },

        update(s, time, { pointer }) {
            particles.uniforms.uMorph.value = smoothstep(0.08, 1, s);
            core.uniforms.uPulse.value = proximity(s, last, 0.7);
            scene.fog.density = lerp(0.018, 0.0055, smoothstep(last - 1, last, s));

            core.update(time, pointer);
            particles.update(time);
            stars.update(time);
            sections.update(s, time);
        },
    };
}
