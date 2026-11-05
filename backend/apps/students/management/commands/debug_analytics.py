"""Debug pose evaluation trend calculations for one student."""
from django.core.management.base import BaseCommand
from apps.students.models import Student, StanceEvaluation
from apps.students.pose_evaluation.trends import PoseAnalyticsService


class Command(BaseCommand):
    help = 'Debug pose evaluation trends'

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
        self.stdout.write(self.style.SUCCESS('POSE TREND DEBUG TEST'))
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
            trend = PoseAnalyticsService.calculate_accuracy_trend(student)
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
        
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS('ALL TESTS PASSED ✓'))
        self.stdout.write('='*60)
