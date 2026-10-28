# Portfolio

Django portfolio site for Yusuf Ali, live at https://yusufali.dev.

## Local development

```bash
python -m venv venv
venv\Scripts\activate          # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
copy yp\.env.example yp\.env   # then set DJANGO_DEBUG=1 in it
python yp/manage.py migrate
python yp/manage.py runserver
```

Settings that differ between your machine and the live server (debug mode, secret key, allowed hosts) come from `yp/.env`, which is git-ignored. Debug is **off** unless `DJANGO_DEBUG=1` is set.

## Deployment (GitHub Pages, free)

The live site is a static copy in `docs/`, served free by GitHub Pages. Django only runs on your machine: you edit projects and posts in the local admin, then export.

To update the live site:

```bash
python yp/manage.py build_static   # renders every page, CSS, JS and image into docs/
git add docs
git commit -m "Update site"
git push
```

GitHub republishes within about a minute. `build_static` clears `docs/` each time but keeps the `CNAME` file, which holds the custom domain.

**One-time setup (already done):**
- GitHub repo → Settings → Pages: source *Deploy from a branch*, `main`, `/docs`; custom domain `yusufali.dev`; *Enforce HTTPS* ticked.
- Namecheap → Advanced DNS: four `A` records for `@` (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) and a `CNAME` for `www` → `yusufa0906.github.io.`

## Deployment (PythonAnywhere + Namecheap)

This was the original plan and isn't used now. It's kept for reference in case the site ever needs a live server (for example, a contact form that saves to the database).

The site would run on a paid PythonAnywhere account at `www.yusufali.dev`. PythonAnywhere attaches custom domains with a CNAME record, which only works on a subdomain like `www`. Replace `<username>` below with your PythonAnywhere username.

### First-time setup

1. **Get the code** — in a PythonAnywhere *Bash console*:
   ```bash
   git clone https://github.com/YusufA0906/Portfolio.git
   cd Portfolio
   mkvirtualenv --python=python3.13 portfolio
   pip install -r requirements.txt
   ```
   If the repository is private, GitHub will ask for a username and a personal access token instead of a password.
2. **Create `yp/.env`** on the server (never commit it):
   ```bash
   cp yp/.env.example yp/.env
   python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
   nano yp/.env      # paste the key into DJANGO_SECRET_KEY; leave DJANGO_DEBUG unset
   ```
3. **Set up the database, files and an admin login:**
   ```bash
   python yp/manage.py migrate
   python yp/manage.py collectstatic --noinput
   python yp/manage.py createsuperuser
   ```
4. **Web tab → Add a new web app** → domain `www.yusufali.dev` → **Manual configuration** → **Python 3.13**. Then on that web app's page:
   - **Virtualenv:** `/home/<username>/.virtualenvs/portfolio`
   - **WSGI configuration file:** replace its contents with
     ```python
     import os
     import sys

     path = "/home/<username>/Portfolio/yp"
     if path not in sys.path:
         sys.path.insert(0, path)

     os.environ["DJANGO_SETTINGS_MODULE"] = "portfolio.settings"

     from django.core.wsgi import get_wsgi_application
     application = get_wsgi_application()
     ```
   - **Static files:** add two mappings
     | URL | Directory |
     | --- | --- |
     | `/static/` | `/home/<username>/Portfolio/yp/staticfiles` |
     | `/media/` | `/home/<username>/Portfolio/yp/media` |
   - Click **Reload**.
5. **DNS on Cloudflare (free plan).** The domain stays registered at Namecheap, but its DNS moves to Cloudflare. Namecheap can only redirect the bare `yusufali.dev` over plain HTTP, and `.dev` domains require HTTPS.
   1. In Cloudflare, **Onboard a domain** → `yusufali.dev` → Free plan. Delete any imported records for `@` and `www` that point to Namecheap's parking page.
   2. Add these DNS records:
      | Type | Name | Content | Proxy status |
      | --- | --- | --- | --- |
      | CNAME | `www` | `webapp-XXXX.pythonanywhere.com` (from the Web tab) | **DNS only** (grey cloud) |
      | A | `@` | `192.0.2.1` | **Proxied** (orange cloud) |

      `www` must be *DNS only* so PythonAnywhere can issue and serve its own HTTPS certificate. The `@` record's address is a reserved placeholder that is never contacted: Cloudflare answers bare-domain requests itself and redirects them (next step).
   3. **Rules → Redirect Rules → Create rule** ("Redirect from root to WWW"):
      - When incoming requests match: wildcard pattern `https://yusufali.dev/*`
      - Then: target URL `https://www.yusufali.dev/${1}`, status **301**, **Preserve query string** on.
   4. In **Namecheap** → Domain List → yusufali.dev: if **DNSSEC** is on, turn it off first. Then under **Nameservers** choose **Custom DNS** and enter the two nameservers Cloudflare gave you. Activation can take up to 24 hours; Cloudflare emails you when the domain is *Active*.
6. **HTTPS.** Once `www.yusufali.dev` resolves, set up the free **Let's Encrypt** certificate in the web app's *Security* section on PythonAnywhere, then turn on **Force HTTPS**. `.dev` domains only load over HTTPS, so the site won't open in a browser until this is done.

### Updating the live site

After pushing changes to GitHub, in a PythonAnywhere Bash console:

```bash
cd ~/Portfolio
git pull
workon portfolio
pip install -r requirements.txt
python yp/manage.py migrate
python yp/manage.py collectstatic --noinput
```

Then click **Reload** on the Web tab. Blog posts, projects and uploaded images live only on the server (`db.sqlite3`, `yp/media/`), so edit them in the live site's `/admin`. Use the PythonAnywhere **Files** tab to download `db.sqlite3` and `media/` occasionally as a backup.

## Projects

Projects are stored in the database and managed in the Django admin under **Projects** (see the Blog section for creating an admin login).

- **Category** (Finance & Tax, or Automation & IT) groups the project on the home page and drives the filter on `/projects`. The filter state is kept in the URL, e.g. `/projects?category=finance`.
- **Order** sets the display order (lower first); you can edit it straight from the list view.
- **Link** is optional. The "View Live Demo" / "View project" button only appears when it is set.
- Uploaded images are saved to `yp/media/projects/` (git-ignored, like `db.sqlite3`). The 8 starting projects are created by migration `0004_seed_projects`.

## Blog

Posts live in the database and are written in the Django admin.

1. Create an admin login once: `python yp/manage.py createsuperuser`.
2. Run the server and open `/admin`, then **Posts → Add post**.
3. Give the post a title; the slug fills in automatically. Separate paragraphs in the body with a blank line.

Published posts appear at `/blog`, newest first, and each one has its own page at `/blog/<slug>`. Untick **Is published** to hide a post without deleting it. A sample post ("Welcome to the blog") is added by migration `0002_sample_post`; edit or delete it in the admin.

## Background

The home page draws one fixed, full-screen WebGL canvas (`#webgl`) behind the regular HTML content. It shows a single soft, barely-there glow in the accent colour on the warm charcoal background. As you scroll, the glow swings from side to side, section by section. A static film-grain overlay (CSS, in `animations.css`) sits over the whole page. There are no 3D objects, textures or post-processing. All content stays real, semantic HTML, and the canvas is decorative (`aria-hidden`).

Dependencies load from jsDelivr as ES modules through the import map in `yp/templates/components/head.html`: Three.js, GSAP + ScrollTrigger and Lenis. There is no build step.

### Files (`yp/core/static/js/three/`)

| File | What it does |
| --- | --- |
| `main.js` | Maps scroll position to section progress, and runs the render loop, pointer, resize and visibility handling. |
| `aurora.js` | The full-screen quad and fragment shader that draw the glow. |
| `scene.js` | The WebGL renderer, drawn below CSS resolution. |
| `interactions.js` | Lenis smooth scroll, custom cursor, magnetic buttons. |
| `utils.js` | `CONFIG` tunables, device capability flags, math helpers, GLSL noise. |

### Tuning

Edit `CONFIG` in `utils.js`:
- `colors`: the background and the accent. Keep these in sync with `--bg` and `--accent` in `style.css`.
- `aurora.intensity`: how strong the glow is (0-1).
- `aurora.speed`: how fast it drifts.
- `aurora.scrollShift`: how far it swings per section.
- `aurora.pointerStrength`: pointer parallax.
- `aurora.resolutionScale`: render size relative to the screen.
- `scrollDamping`: how quickly the background catches up with scrolling.

Section progress is driven by the `data-station` attributes in `index.html` (hero, about, experience, skills, showcase, certificates, contact). A section's value is reached when it is centred in the viewport.

### Adaptive behaviour

- **Phones (<768px):** the same background, which is cheap enough everywhere. No custom cursor.
- **`prefers-reduced-motion`:** no drift, smooth scrolling or cursor. The background redraws on scroll, so the colours still follow the page. Add `?motion` to the URL to force the full experience while testing.
- **No WebGL (or a CDN failure):** the canvas is hidden and a static CSS version of the glow takes its place.
