from django.db import models
from django.urls import reverse
from django.utils import timezone


class Post(models.Model):
    """A blog post, written in the Django admin. Separate paragraphs in the
    body with a blank line."""

    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    excerpt = models.CharField(max_length=300, blank=True, help_text="Short summary shown on the blog list.")
    body = models.TextField(help_text="Separate paragraphs with a blank line.")
    published_at = models.DateTimeField(default=timezone.now)
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ["-published_at"]

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        return reverse("blog_post", args=[self.slug])

    @property
    def reading_minutes(self):
        return max(1, round(len(self.body.split()) / 200))


class Project(models.Model):
    """A portfolio project, managed in the Django admin. The category groups it
    on the home page and drives the filter on /projects."""

    CATEGORY_CHOICES = [
        ("finance", "Finance & Tax"),
        ("automation", "Automation & IT"),
    ]

    title = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    date = models.DateField()
    image = models.ImageField(upload_to="projects/")
    description = models.TextField()
    link = models.URLField(blank=True, help_text="Optional live demo or case study. The button only shows when set.")
    order = models.PositiveIntegerField(default=0, help_text="Lower numbers show first.")

    class Meta:
        ordering = ["order", "-date"]

    def __str__(self):
        return self.title
