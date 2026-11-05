# Generated migration to add per_session period choice

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0023_add_belt_progression_archive'),
    ]

    operations = [
        migrations.AlterField(
            model_name='performancesummary',
            name='period',
            field=models.CharField(
                choices=[
                    ('per_session', 'Per Session'),
                    ('monthly', 'Monthly'),
                    ('quarterly', 'Quarterly'),
                    ('yearly', 'Yearly'),
                    ('overall', 'Overall'),
                ],
                max_length=16,
            ),
        ),
    ]
