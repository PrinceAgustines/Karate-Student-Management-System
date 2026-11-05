from django.db import migrations, models


def seed_gamification_definitions(apps, schema_editor):
    BadgeDefinition = apps.get_model('students', 'BadgeDefinition')
    ChallengeDefinition = apps.get_model('students', 'ChallengeDefinition')

    badge_definitions = [
        {
            'name': 'Perfect Attendance',
            'slug': 'perfect_attendance',
            'description': 'Attend 30 sessions to earn this badge.',
            'icon': '🎯',
            'criteria_type': 'attendance',
            'threshold': 30.0,
            'reward_xp': 200,
            'active': True,
        },
        {
            'name': 'Kata Master',
            'slug': 'kata_master',
            'description': 'Achieve 90+ kata score to earn this badge.',
            'icon': '🥋',
            'criteria_type': 'kata_score',
            'threshold': 90.0,
            'reward_xp': 180,
            'active': True,
        },
        {
            'name': 'Rising Star',
            'slug': 'rising_star',
            'description': 'Keep overall performance above 85%.',
            'icon': '⭐',
            'criteria_type': 'overall_score',
            'threshold': 85.0,
            'reward_xp': 220,
            'active': True,
        },
        {
            'name': 'Belt Achiever',
            'slug': 'belt_achiever',
            'description': 'Reach 85% readiness toward your next belt.',
            'icon': '🏆',
            'criteria_type': 'belt_readiness',
            'threshold': 85.0,
            'reward_xp': 250,
            'active': True,
        },
        {
            'name': 'Consistency King',
            'slug': 'consistency_king',
            'description': 'Attend 5 sessions in the last 7 days.',
            'icon': '📅',
            'criteria_type': 'streak',
            'threshold': 5.0,
            'reward_xp': 160,
            'active': True,
        },
    ]

    challenge_definitions = [
        {
            'name': 'Weekly Warrior',
            'slug': 'weekly_warrior',
            'description': 'Attend 5 sessions this week.',
            'icon': '🔥',
            'target_value': 5.0,
            'reward_xp': 50,
            'active': True,
        },
        {
            'name': 'Kata Perfection',
            'slug': 'kata_perfection',
            'description': 'Score 95 or more on kata evaluations.',
            'icon': '🥇',
            'target_value': 1.0,
            'reward_xp': 100,
            'active': True,
        },
        {
            'name': 'Consistency King',
            'slug': 'challenge_consistency_king',
            'description': 'Attend 3 consecutive sessions this week.',
            'icon': '📆',
            'target_value': 3.0,
            'reward_xp': 40,
            'active': True,
        },
        {
            'name': 'Monthly XP Goal',
            'slug': 'monthly_xp_goal',
            'description': 'Reach 1000 XP to complete this challenge.',
            'icon': '⚡',
            'target_value': 1000.0,
            'reward_xp': 200,
            'active': True,
        },
    ]

    for badge_definition in badge_definitions:
        BadgeDefinition.objects.update_or_create(
            slug=badge_definition['slug'],
            defaults=badge_definition,
        )

    for challenge_definition in challenge_definitions:
        ChallengeDefinition.objects.update_or_create(
            slug=challenge_definition['slug'],
            defaults=challenge_definition,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0006_alter_posetemplate_stance_label_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='GamificationProfile',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('total_xp', models.IntegerField(default=0)),
                ('level', models.IntegerField(default=1)),
                ('current_xp', models.IntegerField(default=0)),
                ('next_level_xp', models.IntegerField(default=500)),
                ('streak_days', models.IntegerField(default=0)),
                ('last_activity_date', models.DateField(blank=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('student', models.OneToOneField(on_delete=models.deletion.CASCADE, related_name='gamification_profile', to='students.student')),
            ],
        ),
        migrations.CreateModel(
            name='BadgeDefinition',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=128)),
                ('slug', models.CharField(max_length=128, unique=True)),
                ('description', models.TextField(blank=True)),
                ('icon', models.CharField(blank=True, max_length=16)),
                ('criteria_type', models.CharField(choices=[('attendance', 'Attendance'), ('kata_score', 'Kata Score'), ('overall_score', 'Overall Score'), ('belt_readiness', 'Belt Readiness'), ('streak', 'Consistency Streak')], max_length=32)),
                ('threshold', models.FloatField(default=0.0)),
                ('reward_xp', models.IntegerField(default=0)),
                ('active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='ChallengeDefinition',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=128)),
                ('slug', models.CharField(max_length=128, unique=True)),
                ('description', models.TextField(blank=True)),
                ('icon', models.CharField(blank=True, max_length=16)),
                ('target_value', models.FloatField(default=0.0)),
                ('reward_xp', models.IntegerField(default=0)),
                ('active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='StudentBadge',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('earned_at', models.DateField(blank=True, null=True)),
                ('progress_value', models.FloatField(default=0.0)),
                ('note', models.CharField(blank=True, max_length=256)),
                ('badge', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='student_badges', to='students.badgedefinition')),
                ('student', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='student_badges', to='students.student')),
            ],
            options={
                'unique_together': {('student', 'badge')},
            },
        ),
        migrations.CreateModel(
            name='StudentChallenge',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('progress', models.FloatField(default=0.0)),
                ('completed_at', models.DateField(blank=True, null=True)),
                ('reward_claimed', models.BooleanField(default=False)),
                ('challenge', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='student_challenges', to='students.challengedefinition')),
                ('student', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='student_challenges', to='students.student')),
            ],
            options={
                'unique_together': {('student', 'challenge')},
            },
        ),
        migrations.RunPython(seed_gamification_definitions),
    ]
