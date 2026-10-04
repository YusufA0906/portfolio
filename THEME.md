# Theme reference

Everything that makes up the site's look: colours, fonts, buttons, the animated background and the effects. Each entry says which file to edit. Written 3 October 2026; line numbers aren't given because they drift, so search for the selector or name instead.

The theme is "warm editorial dark": warm charcoal background, paper-white text, serif headings and **one** burnt-orange accent used only on small elements. There are no gradients, glows or glass cards by design.

## Where things live

| File | What it holds |
| --- | --- |
| `yp/static/css/style.css` | Colour and font variables (`:root`), layout, buttons, every section's base styles |
| `yp/static/css/animations.css` | Background canvas, film grain, cursor, nav, scroll reveal, hover effects, reduced-motion rules |
| `yp/static/css/project_style.css` | `/projects` page (list, filter buttons) and blog pages |
| `yp/core/static/js/three/utils.js` | `CONFIG`: background colours and all background tunables |
| `yp/core/static/js/three/aurora.js` | The shader that draws the background glow |
| `yp/core/static/js/three/scene.js` | WebGL renderer setup |
| `yp/core/static/js/three/main.js` | Links scrolling to the background; render loop |
| `yp/core/static/js/three/interactions.js` | Smooth scrolling, custom cursor, magnetic buttons |
| `yp/core/static/js/script.js` | Scroll reveal, typing effect, card tilt, nav state, progress bar, back-to-top, project filter, copy email |
| `yp/templates/components/head.html` | Font loading, icon font, JS libraries, browser theme colour |

`animations.css` loads after `style.css`, so its rules win when both set the same property.

## Colours

All colours are CSS variables in `:root` at the top of `style.css`. Change a value there and it updates everywhere that uses the variable.

| Variable | Value | Used for |
| --- | --- | --- |
| `--bg` | `#11100e` | Page background |
| `--surface` | `#181613` | Cards (project cards, icon tiles) |
| `--surface-strong` | `#1d1b17` | Nav base |
| `--surface-hover` | `#211e1a` | Card hover |
| `--border` | `rgba(236, 230, 220, 0.09)` | Hairlines between rows, card borders |
| `--border-strong` | `rgba(236, 230, 220, 0.18)` | Hover borders, button outlines, profile photo ring |
| `--text` | `#ece6dc` | Headings, primary text |
| `--text-soft` | `#cfc8bc` | Body paragraphs |
| `--text-muted` | `#9a9285` | Secondary text |
| `--text-subtle` | `#6e675d` | Small labels, captions |
| `--accent` | `#d9773b` | Primary button, icons, small underlines, progress bar, cursor dot, separators |
| `--accent-hover` | `#e58a52` | Primary button hover |
| `--on-accent` | `#11100e` | Text on accent backgrounds |
| `--shadow` | `0 16px 40px rgba(0, 0, 0, 0.35)` | Card shadows |

### Colours written out by hand (not variables)

These repeat the palette as raw numbers, so **changing a variable does not change them**. Update them too when you change the palette.

| Colour it mirrors | Raw value | Where (file → selector) |
| --- | --- | --- |
| Text (`236, 230, 220`) | `rgba(236, 230, 220, 0.06)` | `style.css` → `.btn` background |
| Text | `rgba(236, 230, 220, 0.02)` | `style.css` → `.experience-row:hover` |
| Text | `rgba(236, 230, 220, 0.35)` | `animations.css` → `.cursor__ring` border |
| Accent (`217, 119, 59`) | `rgba(217, 119, 59, 0.08)` | `animations.css` → `.no-webgl body` (fallback glow) |
| Accent | `rgba(217, 119, 59, 0.12)` and `0.5` | `animations.css` → `.cursor.is-hover .cursor__ring::before` |
| Background (`17, 16, 14`) | `rgba(17, 16, 14, 0.72)` and `0.9` | `animations.css` → `nav` and `nav.nav--scrolled` |
| Background | `0x11100e` | `utils.js` → `CONFIG.colors.background` |
| Accent | `0xd9773b` | `utils.js` → `CONFIG.colors.accent` |
| Background | `#11100e` | `head.html` → `<meta name="theme-color">` (browser toolbar on phones) |

Neutral black shadows (`rgba(0, 0, 0, …)`) appear in a few hover rules and don't need changing with the palette.

## Fonts

| Role | Font | Variable | Used on |
| --- | --- | --- | --- |
| Headings | Fraunces (serif), weights 400/500/600 + italic 400 | `--font-heading` | `h1`–`h5`, `.title`, logo name, About lead, Experience labels, Contact links |
| Body | Inter (sans), weights 400–700 | `--font-body` | Everything else |

- Loaded from Google Fonts in `head.html`. To change a font, edit **both** the Google Fonts link there and the variable in `style.css`.
- Headings default to weight 500 with `letter-spacing: -0.01em` (set near the top of `animations.css`). The hero name and Contact headline use weight 400.
- Small uppercase labels (About facts, Skills headings, Contact labels) share one rule in `style.css`: `.about-facts dt, .skill h5, .contact__line dt` (Inter, 12px, weight 600, `letter-spacing: 0.12em`).
- Icons are Remix Icon 4.2.0 (`ri-…` classes), loaded from cdnjs in `head.html`.

## Buttons

Defined in `style.css`; the hover lift is in `animations.css`.

| Button | Class | Look | Hover |
| --- | --- | --- | --- |
| Default | `.btn` | Faint light fill, `--border-strong` outline, `--text` | Inverts to `--text` background with `--bg` text |
| Primary | `.btn.btn--secondary` | Solid `--accent`, `--on-accent` text, weight 600 | `--accent-hover` |
| Nav GitHub | `nav > a:not(.logo)` | `--text` background, `--bg` text, 8px radius | `--accent` background |
| Project card | `.project-card .btn` | Solid accent tab in the card's bottom-right corner; only shown when the project has a link | `--text` background |
| Filter pills | `.project-filter button` (`project_style.css`) | Outline pill, `--text-muted` | Active (`aria-pressed="true"`): `--text` background, `--bg` text |
| Copy email | `.contact__copy` | Small uppercase outline pill | Text brightens |
| Back to top | `.back-to-top` (`animations.css`) | 48px accent circle, bottom right; appears after scrolling 500px | Rises 4px |

All `.btn` buttons lift 2px on hover, and on desktop they are "magnetic" (see Effects). Hero buttons are fully rounded (`2rem`); other `.btn` use 10px.

## Shapes and spacing

- Corner radius: 10px (buttons), 14px (project cards), 16px (nav), 8px (nav button, project images), 999px (pills), 50% (profile photo, back-to-top).
- Sections use 60px side padding on desktop, 30px at ≤ 992px, 16–30px on phones.
- Breakpoints: 1230px, 992px, 768px (in `style.css`), 520px (nav, in `animations.css`).
- Layout pattern for content blocks: **thin hairline rows instead of boxes** (About facts, Experience, Skills, Contact, blog list). Only project cards and icon tiles use a filled surface.

## Background (the "3D" layer)

One fixed full-screen WebGL canvas (`#webgl`) sits behind the page. It draws a single soft glow in the accent colour on the background colour. There are no 3D objects.

All tunables are in `CONFIG` in `utils.js`:

| Setting | Value | Effect |
| --- | --- | --- |
| `colors.background` | `0x11100e` | Canvas base colour. Keep equal to `--bg`. |
| `colors.accent` | `0xd9773b` | Glow colour. Keep equal to `--accent`. |
| `aurora.intensity` | `0.1` | How strong the glow is (0–1). Raise for a more visible glow. |
| `aurora.speed` | `0.08` | How fast the glow drifts on its own |
| `aurora.scrollShift` | `0.5` | How far the glow swings from side to side per page section |
| `aurora.pointerStrength` | `0.03` | How much the glow follows the mouse |
| `aurora.resolutionScale` | `0.5` | Render size relative to the screen (it's a blur, so half is enough) |
| `scrollDamping` | `4.5` | How quickly the glow catches up with scrolling |

In `aurora.js` (the shader), if you want to change the shape rather than the numbers:
- Glow size: the `0.9 * 0.9` radius in `float glow = exp(…)`.
- Glow path: the line `vec2 c = vec2(-0.45 * aspect * cos(s), 0.3 - 0.1 * sin(s));` (starts upper left, swings between sides).
- Edge wobble: the `0.08 *` noise warp.

Related pieces:
- **Film grain:** a static noise texture over the whole page, `body::after` in `animations.css`. Strength is its `opacity: 0.06`; grain size is `baseFrequency='0.85'` inside the SVG.
- **No-WebGL fallback:** `.no-webgl body` in `animations.css` shows a still CSS version of the glow.
- **Section mapping:** the glow's position follows the `data-station` attributes in `index.html` (hero, about, experience, skills, showcase, certificates, contact). The list in `main.js` (`STATION_NAMES`) must match.

## Effects

| Effect | What it does | Where | Key values |
| --- | --- | --- | --- |
| Smooth scrolling | Eased wheel scrolling; in-page links glide | `interactions.js` → `initSmoothScroll` (Lenis) | `lerp: 0.1`; anchor offset `-100` |
| Scroll reveal | Elements with `data-reveal` fade and slide in when they enter the screen | CSS in `animations.css` ("Reveal on scroll"); trigger in `script.js` | 0.7s; variants `left`, `right`, `zoom`; `data-stagger` on a parent delays children by 0.12s each |
| Hero fade-in | Hero text and photo rise in once the background has drawn | `animations.css` (`.is-loading #profile …`) | 1.2s |
| Typing effect | Cycles the role phrases under the name | `script.js`; phrases in `index.html` (`#typed[data-phrases]`) | 70ms per letter typing, 35ms deleting, 2.2s pause |
| Floating photo | Profile photo bobs gently | `animations.css` → `@keyframes float` | 14px over 6s |
| Custom cursor | Orange dot plus a trailing ring; ring fills on hover | `interactions.js` → `initCursor`; styles in `animations.css` | Dot 6px, ring 36px; desktop with a mouse only |
| Magnetic buttons | `.btn` buttons lean toward the mouse | `interactions.js` → `initMagnetic` | Strength 0.25 (0.35 for primary) |
| Card tilt | Project cards tilt in 3D under the mouse | `script.js` ("Subtle 3D tilt") | Up to 6° |
| Card hover | Border brightens, shadow deepens, image zooms 4% | `animations.css` ("Cards & micro-interactions") | |
| Nav | Fixed pill, slightly see-through with a light blur; darkens after scrolling 10px | `animations.css` ("Navbar") | `blur(10px)`; link underline in accent |
| Scroll progress bar | 2px accent line across the top | `animations.css` → `.scroll-progress`; updated in `script.js` | |
| Icon tiles | Job/certificate icons turn accent and tip on hover | `animations.css` → `.job:hover i` | `rotate(-6deg) scale(1.08)` |
| Link arrows | Contact link arrows nudge up-right on hover | `style.css` → `.contact__line dd a:hover i` | |

### Reduced motion and small screens
- If the visitor's device asks for reduced motion: no smooth scrolling, cursor, magnetic buttons, tilt or typing animation; reveals show immediately; the background stops drifting but still follows scrolling. Rules are at the bottom of `animations.css` and in `caps.reducedMotion` (`utils.js`).
- Add `?motion` to the URL to force full motion while testing.
- Phones: no custom cursor, tilt or magnetic buttons.

## Libraries

Loaded from CDNs in `head.html` (no build step):

| Library | Version | Used for |
| --- | --- | --- |
| Three.js | 0.169.0 | Background canvas |
| GSAP + ScrollTrigger | 3.12.5 | Scroll position tracking, animation ticker |
| Lenis | 1.1.13 | Smooth scrolling |
| Remix Icon | 4.2.0 | Icons |
| Google Fonts | – | Fraunces, Inter |

## How to change common things

- **Accent colour:** `--accent` and `--accent-hover` in `style.css`; `CONFIG.colors.accent` in `utils.js`; the three `rgba(217, 119, 59, …)` values in `animations.css`.
- **Background colour:** `--bg` and the three `--surface…` shades in `style.css`; `CONFIG.colors.background` in `utils.js`; the two `rgba(17, 16, 14, …)` nav values in `animations.css`; `theme-color` in `head.html`. Also set `--on-accent` if it should match the background.
- **Text colour:** the four `--text…` variables, the two `--border…` variables and the three `rgba(236, 230, 220, …)` values listed above.
- **Make the background glow stronger or calmer:** `CONFIG.aurora.intensity` and `CONFIG.aurora.speed`.
- **Remove the film grain:** delete the `body::after` rule in `animations.css`, or set its `opacity` to 0.
- **Turn off the background glow:** set `CONFIG.aurora.intensity` to `0` in `utils.js`. The page keeps its flat background colour and the film grain.
- **Turn off the custom cursor:** remove the `initCursor()` call in `main.js`.
- **Switch to a light theme:** change the variables, set `color-scheme: light`, and review the nav logo rule `nav .logo img { filter: invert(1) … }` in `style.css`, which flips the dark logo for the dark nav.
- **Change the heading font:** the Google Fonts link in `head.html` and `--font-heading` in `style.css`.

After changing colours, search the CSS for any remaining raw `rgba(` values to make sure nothing was missed.
