# Future plan: putting yusufali.dev online

Written 3 October 2026. Prices and free-tier limits were checked on 1 October 2026 and change often, so re-check them before acting.

## Where things stand

- The site is **not deployed yet**. No hosting account has been created and no DNS has been changed.
- The code is ready for production and pushed to GitHub (`main`):
  - Secret key, debug mode and allowed domains come from `yp/.env` (git-ignored; see `yp/.env.example`).
  - Debug is off unless `DJANGO_DEBUG=1` is set.
  - HTTPS security settings, `STATIC_ROOT` and a clean `requirements.txt` are in place.
- The README's **Deployment** section has the full step-by-step guide for PythonAnywhere with Cloudflare DNS.
- The domain `yusufali.dev` is registered at **Namecheap**. `.dev` domains only load over HTTPS.
- Expected traffic: **little to none**. This matters a lot for free hosting (see below).
- Blog posts, projects and uploaded images are stored on disk (`db.sqlite3`, `yp/media/`), so the host needs storage that survives restarts.

## Recommended path

**Free PythonAnywhere now, paid plan later.**

### Step 1: go live for free
1. Create a free PythonAnywhere account.
2. Follow the README's Deployment steps 1–4, with two differences:
   - The web app's domain is `<username>.pythonanywhere.com`.
   - In the server's `yp/.env`, set:
     ```
     DJANGO_ALLOWED_HOSTS=<username>.pythonanywhere.com
     DJANGO_CSRF_TRUSTED_ORIGINS=https://<username>.pythonanywhere.com
     ```
3. Optional: send `yusufali.dev` and `www.yusufali.dev` to that address with a free Cloudflare redirect rule, so the domain can still be shared.
4. Set a **monthly reminder** to log in and click "Run until 1 month from today". Free sites on new accounts stop after 1 month without it. Files and setup are kept, and one click restarts the site.

Things to check when doing this:
- The free plan has 512 MB of disk. Confirm the virtualenv, code and images fit.
- The address bar shows `…pythonanywhere.com`, not the domain.

### Step 2: upgrade when ready ($10/month Developer plan)
1. Upgrade the account.
2. Add the `www.yusufali.dev` web app, the Cloudflare DNS records and the HTTPS certificate (README Deployment steps 4–6).
3. Update `yp/.env` to the real domain (the values in `yp/.env.example`).

No code changes or data migration are needed: the posts, projects and images are already on that server.

## Options compared

| Option | Cost | Domain in address bar | Speed | Setup | Upkeep | Fit for a low-traffic site |
|---|---|---|---|---|---|---|
| PythonAnywhere free | $0 | No | Always fast | Small | Monthly button click | Good |
| PythonAnywhere Developer | $10/month | Yes (`www`; bare domain via Cloudflare redirect) | Always fast | Already documented | Very low | Best |
| Render + Neon + Cloudflare R2 | $0 | Yes | About 1 minute wait after 15 minutes idle | Medium; code changes needed | Three accounts | Poor without a keep-alive monitor |
| Oracle Cloud Always Free server | $0 (card on file) | Yes, including the bare domain | Always fast | High | You run the server | Worst |

## Notes on each option

### PythonAnywhere
- Free plan: one site at `<username>.pythonanywhere.com`, no custom domain, 512 MB disk, limited CPU, outbound internet only to approved sites.
- Custom domains need the Developer plan ($10/month).
- Custom domains attach by CNAME, which only works on `www`. The bare `yusufali.dev` needs a redirect. Namecheap's redirect is HTTP-only, so the plan is DNS on Cloudflare's free plan with a redirect rule (details in the README).
- Supports Python up to 3.13. Django 6 needs 3.12 or newer.

### Render + Neon + Cloudflare R2 (all free tiers)
- Render: custom domain and HTTPS included. Sleeps after 15 minutes idle and takes about a minute to wake. 750 hours a month. Disk is wiped on every deploy or restart. No server console.
- Render's own free database is deleted after 30 days, so the database would go on Neon (permanent free plan, 1 GB, pauses after 5 minutes idle).
- Uploaded images would go to Cloudflare R2 (10 GB free). Cloudflare may ask for a card; Cloudinary is an alternative.
- With almost no traffic, nearly every visitor hits the 1-minute wake-up. A free uptime monitor pinging every ~10 minutes avoids that. It should hit a page that doesn't use the database, so Neon can still sleep.
- Code changes needed: Gunicorn, WhiteNoise, Postgres settings, R2 image storage, a `render.yaml`, and an admin login created from environment variables.

### Oracle Cloud Always Free
- Free server options: an ARM server with 2 CPUs and 12 GB RAM in total, or up to two small AMD servers (1/8 CPU, 1 GB RAM). 200 GB disk, 10 TB data out.
- Needs a credit card and phone number. The home region is permanent. Free ARM servers are often out of capacity.
- **Idle servers are reclaimed** if, over 7 days, CPU and network use both stay under 20% (and memory, on ARM). A quiet portfolio will be under those limits.
- Upgrading to Pay As You Go is the usual way around that. It places a $100 card hold, and it is unconfirmed in Oracle's docs that it prevents reclamation.
- The current code would run almost unchanged (Nginx + Gunicorn + Let's Encrypt), and the bare domain would work with plain `A` records at Namecheap. The server would be yours to maintain.

## Open decisions
- When to upgrade to the PythonAnywhere Developer plan.
- Whether to set up the Cloudflare redirect during the free stage.
- The 8 project cards have no demo links yet, so no "View Live Demo" buttons show. Add links in the admin when available.
- YouTube and LinkedIn links were removed until there are URLs for them.

## Sources
- PythonAnywhere pricing: https://www.pythonanywhere.com/pricing/
- PythonAnywhere free account changes (January 2026): https://blog.pythonanywhere.com/221/
- PythonAnywhere custom domains: https://help.pythonanywhere.com/pages/CustomDomains/
- PythonAnywhere naked domains: https://help.pythonanywhere.com/pages/NakedDomains/
- Render free tier: https://render.com/docs/free
- Neon pricing: https://neon.com/pricing
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Cloudflare root-to-www redirect: https://developers.cloudflare.com/rules/url-forwarding/examples/redirect-root-to-www/
- Oracle Always Free resources: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- Oracle Free Tier overview: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm
