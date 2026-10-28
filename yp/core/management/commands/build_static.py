"""Export the site as plain HTML for GitHub Pages.

Renders every page into <repo>/docs/ along with the static files and uploaded
images. Run it after editing projects or posts in the admin, then commit and
push docs/.

    python yp/manage.py build_static
"""
import shutil
from pathlib import Path

from django.conf import settings
from django.contrib.staticfiles import finders
from django.core.management.base import BaseCommand, CommandError
from django.test import Client
from django.test.utils import override_settings
from django.urls import reverse

from core.models import Post

# Files in docs/ that GitHub owns or needs; they survive a rebuild.
KEEP = {"CNAME"}


class Command(BaseCommand):
    help = "Render the site to static HTML in docs/ for GitHub Pages."

    def add_arguments(self, parser):
        parser.add_argument(
            "--out",
            default=str(Path(settings.BASE_DIR).parent / "docs"),
            help="Output folder (default: docs/ at the repo root).",
        )

    def handle(self, *args, **options):
        out = Path(options["out"])
        out.mkdir(exist_ok=True)
        for item in out.iterdir():
            if item.name in KEEP:
                continue
            shutil.rmtree(item) if item.is_dir() else item.unlink()

        # GitHub Pages serves "/projects" from projects.html. "/blog" also has a
        # blog/ folder for the posts, so it gets blog/index.html as well.
        pages = {
            reverse("index"): ["index.html"],
            reverse("projects"): ["projects.html"],
            reverse("blog"): ["blog.html", "blog/index.html"],
        }
        for post in Post.objects.filter(is_published=True):
            pages[post.get_absolute_url()] = [f"blog/{post.slug}.html"]

        with override_settings(DEBUG=False, ALLOWED_HOSTS=["testserver"]):
            client = Client()
            for url, files in pages.items():
                response = client.get(url)
                if response.status_code != 200:
                    raise CommandError(f"{url} returned {response.status_code}")
                for name in files:
                    self.write(out / name, response.content)
            # Django's own 404 page, shown by GitHub Pages for unknown URLs
            self.write(out / "404.html", client.get("/__missing__").content)

        self.copy_static(out / settings.STATIC_URL.strip("/"))
        media = Path(settings.MEDIA_ROOT)
        if media.exists():
            shutil.copytree(media, out / settings.MEDIA_URL.strip("/"), dirs_exist_ok=True)

        # Stop GitHub Pages running the files through Jekyll
        (out / ".nojekyll").touch()
        self.stdout.write(self.style.SUCCESS(f"Built {len(pages)} pages into {out}"))

    def write(self, path, content):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)

    def copy_static(self, dest):
        """Copy every static file the site uses, skipping the admin's."""
        for finder in finders.get_finders():
            for rel_path, storage in finder.list(["CVS", ".*", "*~"]):
                if rel_path.replace("\\", "/").startswith("admin/"):
                    continue
                target = dest / rel_path
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(storage.path(rel_path), target)
