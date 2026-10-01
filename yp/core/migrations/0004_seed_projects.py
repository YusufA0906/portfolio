import datetime

from django.conf import settings
from django.core.files import File
from django.db import migrations

ASSETS = settings.BASE_DIR / "core" / "static" / "assets"
DATE = datetime.date(2023, 8, 1)

# The project cards that used to be hard-coded on the home page
PROJECTS = [
    ("finance", "Canadian Tax Compliance", "item-1.png",
     "Personal & Corporate tax preparation, CRA alignment, and planning."),
    ("finance", "Cloud Bookkeeping Setup", "item-2.png",
     "Setting up and managing QuickBooks/Xero, payroll, and monthly financial reporting."),
    ("finance", "Custom Financial Dashboards", "item-3.jpg",
     "Web development meets finance: creating internal web tools for businesses to track their revenue and KPIs."),
    ("finance", "Corporate Payroll Integration or Financial Forecasting Models", "item-4.png",
     "Configuring automated payroll schedules, managing employee tax deductions, and ensuring seamless "
     "synchronization with your core accounting ledger"),
    ("automation", "Python Workflow Automation", "item-5.png",
     "Eliminating data entry by connecting apps, automated invoicing scripts, and data scraping."),
    ("automation", "Managed IT Infrastructure", "item-6.png",
     "CompTIA A+ standard hardware setup, network security, data backups, and troubleshooting for small offices."),
    ("automation", "Business Web Applications", "item-7.png",
     "Building functional, secure internal websites or customer portals to streamline operations."),
    ("automation", "Custom API Integrations", "item-8.png",
     "Writing secure scripts to make your isolated software applications communicate, sync data automatically, "
     "and completely eliminate manual data transfers."),
]


def seed_projects(apps, schema_editor):
    Project = apps.get_model("core", "Project")
    for order, (category, title, image, description) in enumerate(PROJECTS, start=1):
        if Project.objects.filter(title=title).exists():
            continue
        project = Project(title=title, category=category, date=DATE, description=description, order=order)
        with open(ASSETS / image, "rb") as f:
            project.image.save(image, File(f), save=False)
        project.save()


def remove_projects(apps, schema_editor):
    Project = apps.get_model("core", "Project")
    for project in Project.objects.filter(title__in=[p[1] for p in PROJECTS]):
        project.image.delete(save=False)
        project.delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_project"),
    ]

    operations = [
        migrations.RunPython(seed_projects, remove_projects),
    ]
