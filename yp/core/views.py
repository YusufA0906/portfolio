from django.shortcuts import get_object_or_404, render

from .models import Post, Project


# Create your views here.
def index(request):
    projects = Project.objects.all()
    return render(request, "index.html", {
        "finance": projects.filter(category="finance"),
        "automation": projects.filter(category="automation"),
    })

def projects(request):
    return render(request, "projects.html", {
        "projects": Project.objects.all(),
        "categories": Project.CATEGORY_CHOICES,
    })

def blog(request):
    posts = Post.objects.filter(is_published=True)
    return render(request, "blog.html", {"posts": posts})

def blog_post(request, slug):
    post = get_object_or_404(Post, slug=slug, is_published=True)
    return render(request, "blog_post.html", {"post": post})
