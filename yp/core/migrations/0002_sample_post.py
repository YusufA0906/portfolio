from django.db import migrations

SLUG = "welcome-to-the-blog"


def create_sample_post(apps, schema_editor):
    Post = apps.get_model("core", "Post")
    Post.objects.get_or_create(
        slug=SLUG,
        defaults={
            "title": "Welcome to the blog",
            "excerpt": "A sample post — edit or delete it in the Django admin.",
            "body": (
                "This is a sample post so the blog has something to show. "
                "Edit it or delete it from the Django admin at /admin.\n\n"
                "To write a new post, add a Post in the admin, give it a title, "
                "and separate paragraphs with a blank line."
            ),
        },
    )


def delete_sample_post(apps, schema_editor):
    apps.get_model("core", "Post").objects.filter(slug=SLUG).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_sample_post, delete_sample_post),
    ]
