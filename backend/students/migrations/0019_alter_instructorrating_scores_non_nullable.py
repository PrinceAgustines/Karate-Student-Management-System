from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0018_restore_parentstudent_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='instructorrating',
            name='kata_score',
            field=models.IntegerField(default=0),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='instructorrating',
            name='kumite_score',
            field=models.IntegerField(default=0),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='instructorrating',
            name='discipline_score',
            field=models.IntegerField(default=0),
            preserve_default=False,
        ),
    ]
