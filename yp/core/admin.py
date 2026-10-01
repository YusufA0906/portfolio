from django.contrib import admin

from .models import Post, Project


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "published_at", "is_published")
    list_filter = ("is_published",)
    search_fields = ("title", "body")
    prepopulated_fields = {"slug": ("title",)}


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "date", "order")
    list_editable = ("order",)
    list_filter = ("category",)
    search_fields = ("title", "description")
