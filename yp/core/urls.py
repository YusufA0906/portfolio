from django.urls import path

from . import views


urlpatterns = [
    path("", views.index, name="index"),
    path("projects", views.projects, name="projects"),
    path("blog", views.blog, name="blog"),
    path("blog/<slug:slug>", views.blog_post, name="blog_post"),
]  