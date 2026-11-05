from django.db import migrations


def normalize_belt_values(apps, schema_editor):
    BeltProgressionIndicator = apps.get_model('students', 'BeltProgressionIndicator')
    Student = apps.get_model('students', 'Student')

    from ..belt_progression import normalize_belt_name, get_next_belt

    for student in Student.objects.all():
        normalized_belt = normalize_belt_name(student.current_belt_rank)
        if normalized_belt and normalized_belt != student.current_belt_rank:
            student.current_belt_rank = normalized_belt
            student.save(update_fields=['current_belt_rank'])

    for indicator in BeltProgressionIndicator.objects.all():
        normalized_current = normalize_belt_name(indicator.current_belt)
        if normalized_current:
            normalized_target = get_next_belt(normalized_current)
        else:
            normalized_target = normalize_belt_name(indicator.target_belt)

        should_update = False
        if normalized_current != indicator.current_belt:
            indicator.current_belt = normalized_current
            should_update = True
        if normalized_target != indicator.target_belt:
            indicator.target_belt = normalized_target
            should_update = True
        if should_update:
            indicator.save(update_fields=['current_belt', 'target_belt'])


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0021_alter_instructorrating_discipline_score_and_more'),
    ]

    operations = [
        migrations.RunPython(normalize_belt_values, reverse_code=migrations.RunPython.noop),
    ]
