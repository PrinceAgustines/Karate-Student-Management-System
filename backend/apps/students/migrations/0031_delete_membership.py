from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0030_remove_attendance_time_out_and_more'),
    ]

    operations = [
        migrations.DeleteModel(
            name='Membership',
        ),
    ]
