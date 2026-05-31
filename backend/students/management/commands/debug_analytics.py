"""
Custom management command to debug analytics service
"""
from django.core.management.base import BaseCommand
from students.models import Student, StanceEvaluation
from students.pose_evaluation.analytics import PoseAnalyticsService


class Command(BaseCommand):
    help = 'Debug analytics service'

    def add_arguments(self, parser):
        parser.add_argument(
            '--student-id',
            type=int,
            default=10,
            help='Student ID to test (default: 10)',
        )

    def handle(self, *args, **options):
        student_id = options.get('student_id')
        
        self.stdout.write(self.style.SUCCESS('='*60))
        self.stdout.write(self.style.SUCCESS('ANALYTICS SERVICE DEBUG TEST'))
        self.stdout.write(self.style.SUCCESS('='*60))
        
        # Test 1: Check if student exists
        self.stdout.write('\n[TEST 1] Checking if Student with ID=%s exists...' % student_id)
        try:
            student = Student.objects.get(student_id=student_id)
            self.stdout.write(self.style.SUCCESS(f'✓ Student found: {student}'))
        except Student.DoesNotExist:
            self.stdout.write(self.style.ERROR('✗ Student with ID=%s does not exist' % student_id))
            self.stdout.write('\nAvailable students:')
            for s in Student.objects.all()[:5]:
                self.stdout.write(f'  - ID {s.student_id}: {s.first_name} {s.last_name}')
            return
        
        # Test 2: Check evaluations
        self.stdout.write('\n[TEST 2] Checking StanceEvaluations for this student...')
        evals = StanceEvaluation.objects.filter(student=student)
        self.stdout.write(f'Total evaluations: {evals.count()}')
        if evals.exists():
            self.stdout.write('Sample evaluations:')
            for eval in evals[:3]:
                self.stdout.write(f'  - Score: {eval.score}, Date: {eval.date_evaluated}, Type: {eval.stance_type}')
        
        # Test 3: Test calculate_accuracy_trend
        self.stdout.write('\n[TEST 3] Testing calculate_accuracy_trend()...')
        try:
            trend = PoseAnalyticsService.calculate_accuracy_trend(student, 30)
            self.stdout.write(self.style.SUCCESS('✓ Trend calculated:'))
            self.stdout.write(f'  - Trend data points: {len(trend["trend_data"])}')
            self.stdout.write(f'  - Current accuracy: {trend["current_accuracy"]}')
            self.stdout.write(f'  - Average accuracy: {trend["average_accuracy"]}')
            self.stdout.write(f'  - Evaluations count: {trend["evaluations_count"]}')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'✗ Error in calculate_accuracy_trend: {type(e).__name__}: {e}'))
            import traceback
            traceback.print_exc()
            return
        
        # Test 4: Test project_accuracy
        self.stdout.write('\n[TEST 4] Testing project_accuracy()...')
        try:
            projection = PoseAnalyticsService.project_accuracy(student, 30, 30)
            self.stdout.write(self.style.SUCCESS('✓ Projection calculated:'))
            self.stdout.write(f'  - Projected accuracy: {projection["projected_accuracy"]}')
            self.stdout.write(f'  - Confidence: {projection["confidence"]}')
            self.stdout.write(f'  - Projection basis: {projection["projection_basis"]}')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'✗ Error in project_accuracy: {type(e).__name__}: {e}'))
            import traceback
            traceback.print_exc()
            return
        
        # Test 5: Test generate_insights
        self.stdout.write('\n[TEST 5] Testing generate_insights()...')
        try:
            insights = PoseAnalyticsService.generate_insights(student, 30)
            self.stdout.write(self.style.SUCCESS(f'✓ Insights generated: {len(insights)} insights'))
            for i, insight in enumerate(insights, 1):
                self.stdout.write(f'  {i}. {insight["title"]} (priority: {insight["priority"]})')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'✗ Error in generate_insights: {type(e).__name__}: {e}'))
            import traceback
            traceback.print_exc()
            return
        
        # Test 6: Test get_student_analytics_summary
        self.stdout.write('\n[TEST 6] Testing get_student_analytics_summary()...')
        try:
            analytics = PoseAnalyticsService.get_student_analytics_summary(student)
            self.stdout.write(self.style.SUCCESS('✓ Analytics summary generated:'))
            self.stdout.write(f'  - Total evaluations: {analytics["summary"]["total_evaluations"]}')
            self.stdout.write(f'  - Current accuracy: {analytics["summary"]["current_accuracy"]}')
            self.stdout.write(f'  - Trend direction: {analytics["summary"]["trend_direction"]}')
            self.stdout.write(f'  - Keys: {list(analytics.keys())}')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'✗ Error in get_student_analytics_summary: {type(e).__name__}: {e}'))
            import traceback
            traceback.print_exc()
            return
        
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS('ALL TESTS PASSED ✓'))
        self.stdout.write('='*60)
