You are a senior creative developer who specializes in WebGL, Three.js and award-winning portfolio sites (Awwwards / FWA style). Turn my existing Django portfolio into an immersive, high-performance 3D experience. Keep all my real content and keep the Django template structure.

## Project context
- Django project at `yp/`. Base layout: `yp/templates/base.html`. Partials: `yp/templates/components/{head,navbar,footer}.html`. Main page: `yp/core/templates/index.html`.
- Static files: `yp/static/css/style.css`, `yp/static/css/animations.css`, `yp/core/static/js/script.js`, and images in `yp/core/static/assets/` (profile.png, item-1..8, logo.png).
- I am Yusuf Ali, an Operations & Financial Technologist: Python automation, IT infrastructure/security (CompTIA A+), cloud accounting and Canadian tax compliance (QuickBooks, CRA).
- Sections to keep, with all their copy: Hero (name + typed role phrases), About, Experience (Web & Databases / IT & Automation / Finance & Tax), Skills stats, Showcase (2 categories × 4 project cards), Technical Expertise, Certificates, Contact (email + phone), Footer.

## Tech constraints
- No bundler. Load Three.js (r16x+), its addons (OrbitControls, EffectComposer, UnrealBloomPass, RGBELoader if needed) and GSAP + ScrollTrigger as ES modules from a CDN, using an import map in `components/head.html`.
- Put the 3D code in new modules under `yp/core/static/js/three/` (scene.js, hero.js, sections.js, utils.js), loaded with `{% static %}`. Keep `script.js` for the existing UI logic.
- Every template keeps using `{% load static %}` / `{% static %}`.

## 3D concept: "The Data Engine"
The theme connects finance and automation: a dark, cinematic space where flowing data turns into structured systems.

1. **Persistent background canvas**: one fixed full-screen `<canvas>` behind all content (z-index -1) that drives the whole scroll story. Don't create a separate WebGL context per section.
2. **Hero**: a glowing, slowly rotating low-poly "core" (icosahedron with a custom shader: fresnel rim, animated noise displacement), circled by about 3,000 GPU-instanced particles shaped like tiny ledger cells or binary digits. The core leans toward the mouse (lerped parallax). There's subtle bloom. The name "Yusuf Ali" and the typed phrases stay as crisp HTML layered on top.
3. **Scroll-driven camera**: with GSAP ScrollTrigger, the camera flies along a CatmullRom spline through the scene as the user scrolls. Each section has its own "station":
   - About: the particles reorganize into a clean grid (chaos → order).
   - Experience: three floating glass panels (MeshPhysicalMaterial with transmission), one per skill group. Each has an icon-like emblem.
   - Skills stats: the numbers count up while bar-chart columns grow out of the grid floor.
   - Showcase: the 8 project images (item-1..8) as textured 3D cards on a curved carousel/arc. Hovering tilts a card and raises it; clicking scrolls to/opens the HTML card details.
   - Certificates: 3 rotating medal or coin meshes with metallic PBR material.
   - Contact: the camera pulls back to show the whole "engine" pulsing calmly. Put a magnetic CTA button on top.
4. **Micro-interactions**: a custom cursor that grows over links, magnetic buttons, 3D tilt on HTML cards (CSS perspective), a smooth scroll feel (Lenis via CDN), and a page-load intro: a counter from 0→100% while assets load, then the core "ignites."

## Visual style
- Dark-first palette: near-black navy background (#05070d), electric cyan (#22d3ee) and emerald (#10b981) accents (finance green meets tech blue), with soft white text.
- Typography: Space Grotesk for headings, Inter for body text (Google Fonts).
- Glassmorphism for the HTML content cards (backdrop-filter blur, 1px translucent borders), so the 3D scene shows through behind them.
- Keep the existing Remix Icons.

## Performance & accessibility (required)
- Target 60fps on a mid-range laptop. Cap devicePixelRatio at 2. Use InstancedMesh for particles. Dispose of geometries/materials you no longer use. Pause rendering when the tab is hidden.
- Mobile (<768px): lower the particle count by about 70%, turn off bloom, replace the camera spline with simpler per-section fades, and turn off the custom cursor.
- Respect `prefers-reduced-motion`: show a static, nicely lit hero render and no scroll-driven camera.
- Fallback: if WebGL isn't available, the page must still look polished using the existing CSS design.
- All content stays real, semantic HTML (SEO + screen readers). The canvas gets `aria-hidden="true"`.
- Lighthouse: Performance ≥ 85 on desktop, Accessibility ≥ 95.

## Deliverables
1. Updated `base.html`, `head.html` and `index.html`.
2. New JS modules in `yp/core/static/js/three/`.
3. Updated `style.css` / `animations.css`. Remove the CSS that the new system replaces.
4. A short README section explaining how the scene is structured and how to tune the particle count, colors and camera stations.

Work incrementally. Build the background canvas + hero first and verify it with `python manage.py runserver`, then add each scroll station one at a time. Check the browser console for errors after each step.
