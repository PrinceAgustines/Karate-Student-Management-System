from django.db import migrations, models


BELT_CHOICES = [
    ('White Belt', 'White Belt'),
    ('Yellow Belt', 'Yellow Belt'),
    ('Orange Belt', 'Orange Belt'),
    ('Green Belt', 'Green Belt'),
    ('Purple Belt', 'Purple Belt'),
    ('1st Class Purple Belt', '1st Class Purple Belt'),
    ('Brown Belt', 'Brown Belt'),
    ('1st Class Brown Belt', '1st Class Brown Belt'),
    ('2nd Class Brown Belt', '2nd Class Brown Belt'),
    ('Black Belt', 'Black Belt'),
]

READINESS_STATUS_CHOICES = [
    ('not_ready', 'Not Ready'),
    ('in_progress', 'In Progress'),
    ('ready', 'Ready for Testing'),
    ('tested', 'Tested - Awaiting Decision'),
    ('promoted', 'Promoted'),
]


def move_belt_progression_to_summaries(apps, schema_editor):
    Indicator = apps.get_model('students', 'BeltProgressionIndicator')
    Summary = apps.get_model('students', 'PerformanceSummary')
    database = schema_editor.connection.alias
    seen_students = set()

    indicators = Indicator.objects.using(database).order_by(
        'student_id',
        '-last_assessment_date',
        '-pk',
    )
    for indicator in indicators.iterator():
        if indicator.student_id in seen_students:
            raise RuntimeError(
                'Multiple belt progression indicators exist for student '
                f'{indicator.student_id}; merge them before applying migration 0029.'
            )
        seen_students.add(indicator.student_id)

        if Summary.objects.using(database).filter(
            student_id=indicator.student_id,
            period='belt_progression',
        ).exists():
            raise RuntimeError(
                'A belt progression summary already exists for student '
                f'{indicator.student_id}; resolve it before applying migration 0029.'
            )

        assessment_date = indicator.last_assessment_date
        Summary.objects.using(database).create(
            student_id=indicator.student_id,
            period='belt_progression',
            start_date=assessment_date,
            end_date=assessment_date,
            target_belt=indicator.target_belt,
            readiness_status=indicator.readiness_status,
            kata_readiness=indicator.kata_readiness,
            kumite_readiness=indicator.kumite_readiness,
            discipline_readiness=indicator.discipline_readiness,
            attendance_readiness=indicator.attendance_readiness,
            overall_readiness_percentage=indicator.overall_readiness_percentage,
            kata_requirement=indicator.kata_requirement,
            kumite_requirement=indicator.kumite_requirement,
            discipline_requirement=indicator.discipline_requirement,
            attendance_requirement=indicator.attendance_requirement,
            eligible_since=indicator.eligible_since,
            last_assessment_date=assessment_date,
            estimated_promotion_date=indicator.estimated_promotion_date,
            notes=indicator.notes,
        )


def restore_belt_progression_indicators(apps, schema_editor):
    Indicator = apps.get_model('students', 'BeltProgressionIndicator')
    Summary = apps.get_model('students', 'PerformanceSummary')
    database = schema_editor.connection.alias

    for summary in Summary.objects.using(database).filter(period='belt_progression').iterator():
        indicator = Indicator.objects.using(database).create(
            student_id=summary.student_id,
            current_belt=summary.student.current_belt_rank,
            target_belt=summary.target_belt or '',
            readiness_status=summary.readiness_status or 'not_ready',
            kata_readiness=summary.kata_readiness or 0.0,
            kumite_readiness=summary.kumite_readiness or 0.0,
            discipline_readiness=summary.discipline_readiness or 0.0,
            attendance_readiness=summary.attendance_readiness or 0.0,
            overall_readiness_percentage=summary.overall_readiness_percentage or 0.0,
            kata_requirement=summary.kata_requirement or 75.0,
            kumite_requirement=summary.kumite_requirement or 70.0,
            discipline_requirement=summary.discipline_requirement or 80.0,
            attendance_requirement=summary.attendance_requirement or 85.0,
            eligible_since=summary.eligible_since,
            estimated_promotion_date=summary.estimated_promotion_date,
            notes=summary.notes or '',
        )
        if summary.last_assessment_date:
            Indicator.objects.using(database).filter(pk=indicator.pk).update(
                last_assessment_date=summary.last_assessment_date
            )
        summary.delete(using=database)


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0028_remove_match_student_a_remove_match_student_b_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='performancesummary',
            name='period',
            field=models.CharField(
                choices=[
                    ('monthly', 'Monthly'),
                    ('quarterly', 'Quarterly'),
                    ('yearly', 'Yearly'),
                    ('overall', 'Overall'),
                    ('belt_progression', 'Belt Progression'),
                ],
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name='performancesummary',
            name='target_belt',
            field=models.CharField(blank=True, choices=BELT_CHOICES, max_length=128, null=True),
        ),
        migrations.AddField(
            model_name='performancesummary',
            name='readiness_status',
            field=models.CharField(blank=True, choices=READINESS_STATUS_CHOICES, max_length=32, null=True),
        ),
        migrations.AddField(
            model_name='performancesummary',
            name='kata_readiness',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='performancesummary',
            name='kumite_readiness',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='performancesummary',
            name='discipline_readiness',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='performancesummary',
            name='attendance_readiness',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='performancesummary',
            name='overall_readiness_percentage',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='performancesummary',
            name='kata_requirement',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='performancesummary',
            name='kumite_requirement',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='performancesummary',
            name='discipline_requirement',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='performancesummary',
            name='attendance_requirement',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='performancesummary',
            name='eligible_since',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='performancesummary',
            name='last_assessment_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='performancesummary',
            name='estimated_promotion_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='performancesummary',
            name='notes',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddConstraint(
            model_name='performancesummary',
            constraint=models.UniqueConstraint(
                condition=models.Q(period='belt_progression'),
                fields=('student',),
                name='uniq_student_belt_progression',
            ),
        ),
        migrations.RunPython(
            move_belt_progression_to_summaries,
            restore_belt_progression_indicators,
        ),
        migrations.DeleteModel(
            name='StudentChallenge',
        ),
        migrations.DeleteModel(
            name='ChallengeDefinition',
        ),
        migrations.DeleteModel(
            name='BeltProgressionIndicator',
        ),
    ]
