import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0017_sparringmatch'),
    ]

    operations = [
        migrations.AddField(
            model_name='parentstudent',
            name='is_primary_contact',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='parentstudent',
            name='added_at',
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='parentstudent',
            name='added_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='added_parent_relationships',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
