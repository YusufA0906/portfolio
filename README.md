# Portfolio

Django portfolio site for Yusuf Ali.

```bash
python yp/manage.py runserver
```

## 3D scene

The home page renders one fixed, full-screen WebGL canvas (`#webgl`) behind all of the regular HTML content. Scrolling flies the camera through a series of "stations", one per page section. All content stays real, semantic HTML. The canvas is decorative (`aria-hidden`).

Dependencies load from jsDelivr as ES modules through the import map in `yp/templates/components/head.html`: Three.js, GSAP + ScrollTrigger and Lenis. There is no build step.

### Design concepts

Four interchangeable designs share the same runner:

| Concept | Look |
| --- | --- |
| `engine` (default) | "The Data Engine": a glowing core and ledger-cell particles that snap into a grid, then glass panels, bar charts, project cards and medals. Dark cyan/emerald theme. |
| `city` | "Ledger City": a low-poly city of bar-chart skyscrapers. Dusk turns to night as you scroll, windows light up by district, and there is traffic on the boulevard. |
| `glass` | "Liquid Glass": a light, minimal theme. One iridescent glass form morphs per section (sphere → cube → coin → capsule → twist → gem) over a pastel gradient. |
| `terminal` | "Retro Terminal": a CRT on a desk with your photo on screen. Scrolling dives through the glass into a green wireframe cyberspace. Monospace, scanline theme. |

**Switching:** pick a concept with the pill at the bottom left of the home page, or with `?concept=<name>`. The choice is remembered in `localStorage` and applies to every page. To make one permanent:
1. Set `DEFAULT_CONCEPT` in `utils.js` and the same default in the inline script in `components/head.html`.
2. Remove the `.concept-switcher` markup from `index.html`.
3. Delete the unused concept modules and their CSS blocks in `concepts.css`.

### Files (`yp/core/static/js/three/`)

| File | What it does |
| --- | --- |
| `main.js` | Generic runner. Loads the active concept, maps scroll position → station progress, and runs the loader/intro, render loop, pointer, card clicks, resize and visibility handling. |
| `scene.js` | Renderer, camera, environment lighting, and optional bloom/fog/tone mapping (configured by each concept's `theme`). |
| `shared.js` | Camera path, hero photo framing, project-card picking, project textures. |
| `concepts/*.js` | One module per design. Each exports `theme` and `create(ctx)`, which returns `{ stations, update, … }` (see the top of `main.js`). |
| `hero.js`, `sections.js` | Set pieces used by the `engine` concept. |
| `interactions.js` | Lenis smooth scroll, custom cursor, magnetic buttons. |
| `utils.js` | `CONFIG` tunables, concept selection, device capability flags, math helpers, GLSL noise. |

Concept-specific HTML styling lives in `yp/static/css/concepts.css`, scoped under `html.concept-<name>`.

### Tuning

- **Particle count, default colours, bloom, pixel-ratio cap, scroll smoothing:** edit `CONFIG` in `utils.js`.
- **Camera stations:** edit `STATIONS` in the concept module. Each entry has a `camera` position and a `target` to look at. The order must match the `data-station` attributes in `index.html`: hero, about, experience, skills, showcase, certificates, contact.
- **Section scroll mapping:** a station is reached exactly when its section is centred in the viewport.

### Adaptive behaviour

- **Phones (<768px):** lighter scenes (fewer particles, buildings and glyphs), no bloom, no glass transmission and no custom cursor. Per-section cross-fades replace the camera flight.
- **`prefers-reduced-motion`:** a single static frame, with no scroll camera, smooth scrolling or cursor. Add `?motion` to the URL to force the full experience while testing.
- **No WebGL (or a CDN failure):** the canvas is hidden and the concept's CSS theme stands on its own.
