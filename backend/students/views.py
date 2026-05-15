import os
import random
import uuid

from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import Count, Avg, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import action
from .models import (
    Attendance,
    BeltProgressionIndicator,
    BadgeDefinition,
    Cart,
    CartItem,
    GamificationProfile,
    InstructorRating,
    Inventory,
    KataRating,
    KumiteRating,
    Match,
    Notification,
    Order,
    OrderItem,
    ParentStudent,
    PerformanceSummary,
    PoseTemplate,
    ProgressionInsight,
    Session,
    StanceEvaluation,
    Student,
    StudentBadge,
    SystemID,
)
from .serializers import (
    AttendanceSerializer,
    BeltProgressionIndicatorSerializer,
    CartSerializer,
    CartItemSerializer,
    GamificationProfileSerializer,
    InstructorRatingSerializer,
    InventorySerializer,
    KataRatingSerializer,
    KumiteRatingSerializer,
    NotificationSerializer,
    OrderSerializer,
    OrderItemSerializer,
    OrderCreateSerializer,
    ParentStudentSerializer,
    PerformanceSummarySerializer,
    PoseTemplateSerializer,
    ProgressionInsightSerializer,
    StudentRegistrationSerializer,
    StudentSerializer,
    SessionSerializer,
    StanceEvaluationSerializer,
    SystemIDSerializer,
)
from .services.performance_services import (
    BeltProgressionService,
    GamificationService,
    PerformanceAggregationService,
    ProgressionInsightService,
)
from .facial_recognition import FacialRecognitionService
from .pose_evaluation import PoseEvaluationService


class IsAuthenticatedInventoryManager(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in permissions.SAFE_METHODS:
            return True

        return getattr(request.user, "role", None) in {"admin", "instructor"}


class VerifySystemIDView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        code = request.data.get('code', '').strip().upper()

        if not code:
            return Response({'detail': 'Student ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            system_id = SystemID.objects.get(code=code)
        except SystemID.DoesNotExist:
            return Response({'detail': 'Student ID not found.'}, status=status.HTTP_404_NOT_FOUND)

        if system_id.id_type != 'student':
            return Response({'detail': 'The provided ID is not a student ID.'}, status=status.HTTP_400_BAD_REQUEST)

        if system_id.status != 'generated':
            return Response({'detail': 'This Student ID has already been used.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'code': system_id.code, 'status': system_id.status}, status=status.HTTP_200_OK)


class StudentRegistrationView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = StudentRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        student_code = serializer.validated_data['student_id']
        student = serializer.save()

        try:
            system_id = SystemID.objects.get(code=student_code)
            system_id.assigned_student = student
            system_id.status = 'assigned'
            system_id.save()
        except SystemID.DoesNotExist:
            return Response(
                {'detail': 'Unable to assign the selected Student ID.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        Notification.objects.create(
            student=student,
            notification_type='student_registered',
            message=f"{student.first_name} {student.last_name} has been registered.",
            date_sent=timezone.now().date(),
            recipient=request.data.get('email', ''),
        )
        return Response(
            {
                "student_id": student_code,
                "application_number": student.application_number,
                "user_email": request.data.get("email"),
            },
            status=status.HTTP_201_CREATED,
        )


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_update(self, serializer):
        old_belt = serializer.instance.current_belt_rank
        student = serializer.save()
        new_belt = student.current_belt_rank
        if old_belt != new_belt:
            # Notify student
            Notification.objects.create(
                student=student,
                notification_type='new_rank_achieved',
                message=f'Congratulations! You have achieved a new rank: {new_belt}',
                date_sent=timezone.now().date(),
                recipient=student.contacts.first().email_address if student.contacts.exists() else 'student',
            )
            # Notify parents about promotion
            parents = ParentStudent.objects.filter(student=student).values_list('parent', flat=True)
            for parent_id in parents:
                try:
                    parent_user = User.objects.get(id=parent_id)
                    Notification.objects.create(
                        student=student,
                        notification_type='child_promotion_achieved',
                        message=f'Your child has achieved a new rank: {new_belt}!',
                        date_sent=timezone.now().date(),
                        recipient=parent_user.email or 'parent',
                    )
                except:
                    pass
            # Admin notification
            Notification.objects.create(
                student=student,
                notification_type='promotion_eligible',
                message=f'Student {student.first_name} {student.last_name} promoted to {new_belt}',
                date_sent=timezone.now().date(),
                recipient='admin@instructor',
            )
        else:
            # Profile updated
            Notification.objects.create(
                student=student,
                notification_type='profile_updated',
                message=f'Your profile has been updated',
                date_sent=timezone.now().date(),
                recipient=student.contacts.first().email_address if student.contacts.exists() else 'student',
            )

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_authenticated and getattr(user, 'role', None) == 'parent':
            # Get students that this parent is connected to
            parent_student_ids = ParentStudent.objects.filter(
                parent=user
            ).values_list('student_id', flat=True)
            return queryset.filter(student_id__in=parent_student_ids)
        return queryset

    @action(detail=False, methods=['get'], url_path='all-students')
    def all_students(self, request):
        """Return the full student list for selectors and lookup screens."""
        queryset = Student.objects.all()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='performance-dashboard')
    def performance_dashboard(self, request, pk=None):
        student = self.get_object()
        kata_rating = student.kata_ratings.order_by('-date_recorded').first()
        kumite_rating = student.kumite_ratings.order_by('-date_recorded').first()
        performance_summary = student.performance_summaries.order_by('-generated_at').first()
        belt_progression = student.belt_progression_indicators.order_by('-last_assessment_date').first()
        progression_insights = student.progression_insights.order_by('-generated_at')[:5]

        gamification_payload = GamificationService.sync_student_profile(student)
        return Response({
            'student': StudentSerializer(student, context={'request': request}).data,
            'kata_rating': KataRatingSerializer(kata_rating).data if kata_rating else None,
            'kumite_rating': KumiteRatingSerializer(kumite_rating).data if kumite_rating else None,
            'performance_summary': PerformanceSummarySerializer(performance_summary).data if performance_summary else None,
            'belt_progression': BeltProgressionIndicatorSerializer(belt_progression).data if belt_progression else None,
            'progression_insights': ProgressionInsightSerializer(progression_insights, many=True).data,
            'gamification': {
                'profile': GamificationProfileSerializer(gamification_payload['profile']).data,
                'badges': gamification_payload['badges'],
                'challenges': gamification_payload['challenges'],
                'metrics': gamification_payload['metrics'],
            },
        })

    @action(detail=True, methods=['get'], url_path='gamification')
    def gamification(self, request, pk=None):
        student = self.get_object()
        payload = GamificationService.sync_student_profile(student)
        return Response({
            'student': StudentSerializer(student, context={'request': request}).data,
            'gamification': {
                'profile': GamificationProfileSerializer(payload['profile']).data,
                'badges': payload['badges'],
                'challenges': payload['challenges'],
                'metrics': payload['metrics'],
            },
        })

    @action(detail=False, methods=['get'], url_path='gamification/leaderboard')
    def gamification_leaderboard(self, request):
        leaderboard = GamificationService.get_leaderboard()
        return Response(leaderboard)

    @action(detail=False, methods=['get'], url_path='gamification/badges')
    def gamification_badges(self, request):
        total_students = Student.objects.filter(role='Student').count()
        badge_summary = []
        for badge in BadgeDefinition.objects.filter(active=True):
            earned_count = StudentBadge.objects.filter(badge=badge, earned_at__isnull=False).count()
            percentage = round((earned_count / total_students) * 100, 2) if total_students > 0 else 0.0
            badge_summary.append({
                'id': badge.id,
                'name': badge.name,
                'slug': badge.slug,
                'icon': badge.icon,
                'description': badge.description,
                'criteria_type': badge.criteria_type,
                'threshold': badge.threshold,
                'reward_xp': badge.reward_xp,
                'earned_count': earned_count,
                'total_students': total_students,
                'percentage': percentage,
            })
        return Response(badge_summary)

    @action(detail=False, methods=['get'], url_path=r'gamification/badges/(?P<badge_id>[^/.]+)/students')
    def gamification_badge_students(self, request, badge_id=None):
        badge = get_object_or_404(BadgeDefinition, pk=badge_id)
        earned_student_badges = StudentBadge.objects.filter(badge=badge, earned_at__isnull=False).select_related('student')
        students = [
            {
                'student_id': student_badge.student.student_id,
                'name': f"{student_badge.student.first_name} {student_badge.student.last_name}",
                'current_belt_rank': student_badge.student.current_belt_rank or 'Unknown',
                'earned_at': student_badge.earned_at.isoformat() if student_badge.earned_at else None,
                'progress_value': student_badge.progress_value,
            }
            for student_badge in earned_student_badges
        ]
        return Response({
            'badge_id': badge.id,
            'badge_name': badge.name,
            'students': students,
        })

    @action(detail=True, methods=['post'], url_path='generate-progression')
    def generate_progression(self, request, pk=None):
        student = self.get_object()
        period = request.data.get('period', 'monthly')
        result = PerformanceAggregationService.generate_student_progression(student, period=period)

        return Response({
            'student': StudentSerializer(student, context={'request': request}).data,
            'kata_rating': KataRatingSerializer(result['kata_rating']).data,
            'kumite_rating': KumiteRatingSerializer(result['kumite_rating']).data,
            'performance_summary': PerformanceSummarySerializer(result['performance_summary']).data,
            'belt_progression': BeltProgressionIndicatorSerializer(result['belt_progression_indicator']).data,
            'progression_insights': ProgressionInsightSerializer(result['progression_insights'], many=True).data,
        })


class AnalyticsOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        total_students = Student.objects.count()
        total_sessions = Session.objects.count()
        total_attendance = Attendance.objects.count()
        attendance_per_session = list(
            Attendance.objects.values('session').annotate(count=Count('attendance_id'))
        )
        # Fix division by zero: check total_sessions > 0 before division
        average_session_attendance = (
            sum(item['count'] for item in attendance_per_session) / total_sessions
            if total_sessions > 0 else 0.0
        )

        average_kata = float(
            StanceEvaluation.objects.aggregate(avg=Avg('score'))['avg'] or 0.0
        )
        average_kumite = float(
            InstructorRating.objects.aggregate(avg=Avg('kumite_score'))['avg'] or 0.0
        )
        average_discipline = float(
            InstructorRating.objects.aggregate(avg=Avg('discipline_score'))['avg'] or 0.0
        )
        overall_performance = 0.0
        perf_values = [value for value in [average_kata, average_kumite, average_discipline] if value is not None]
        if perf_values:
            overall_performance = sum(perf_values) / len(perf_values)

        performance_trend = []
        latest_summaries = PerformanceSummary.objects.order_by('-generated_at')[:6]
        for summary in reversed(latest_summaries):
            performance_trend.append({
                'period': summary.period.title(),
                'overall_average': summary.overall_average,
            })

        belt_distribution = [
            {'belt': row['current_belt_rank'] or 'Unknown', 'count': row['count']}
            for row in Student.objects.values('current_belt_rank').annotate(count=Count('student_id'))
        ]

        attendance_by_week: dict[str, int] = {}
        for record_date in Attendance.objects.values_list('date', flat=True):
            if not record_date:
                continue
            year, week, _ = record_date.isocalendar()
            week_label = f"{year}-W{week}"
            attendance_by_week[week_label] = attendance_by_week.get(week_label, 0) + 1

        attendance_trend = [
            {'week': week_label, 'attendance': count}
            for week_label, count in sorted(attendance_by_week.items())
        ][:6]

        low_attendance_sessions = (
            Session.objects.annotate(attendance_count=Count('attendances'))
            .filter(attendance_count__lt=average_session_attendance * 0.75)
            .count()
        )
        underperforming_students = (
            PerformanceSummary.objects.filter(overall_average__lt=70.0)
            .values('student')
            .distinct()
            .count()
        )
        promotion_ready = BeltProgressionIndicator.objects.filter(
            readiness_status__in=['ready', 'promoted']
        ).count()

        projected_promotion_ready = int(promotion_ready + max(0, (total_students - promotion_ready) * 0.1))
        projected_attendance_change = round(
            (average_session_attendance / max(1, total_attendance)) * 100 if total_attendance else 0.0,
            1,
        )

        recommendations = []
        if low_attendance_sessions:
            recommendations.append(
                'Investigate low-attendance sessions and send reminders to students for weak classes.'
            )
        if underperforming_students:
            recommendations.append(
                'Focus coaching on students with performance summaries below threshold and schedule follow-up assessments.'
            )
        if overall_performance < 75.0:
            recommendations.append(
                'Review curriculum pacing for kata and kumite to improve overall performance in the next cycle.'
            )
        if promotion_ready < max(1, total_students * 0.15):
            recommendations.append(
                'Increase preparation for promotion readiness through belt-specific training plans.'
            )

        return Response({
            'descriptive': {
                'total_students': total_students,
                'total_sessions': total_sessions,
                'total_attendance': total_attendance,
                'avg_session_attendance': round(average_session_attendance, 1),
                'avg_kata_score': round(average_kata, 1),
                'avg_kumite_score': round(average_kumite, 1),
                'avg_discipline_score': round(average_discipline, 1),
                'overall_average_score': round(overall_performance, 1),
                'promotion_ready_count': promotion_ready,
            },
            'attendance_trend': attendance_trend,
            'performance_trend': performance_trend,
            'belt_distribution': belt_distribution,
            'diagnostic': [
                {
                    'title': 'Low Attendance Sessions',
                    'value': str(low_attendance_sessions),
                    'detail': 'Sessions with attendance under 75% of average.',
                },
                {
                    'title': 'Underperforming Students',
                    'value': str(underperforming_students),
                    'detail': 'Students with latest overall performance below 70%.',
                },
                {
                    'title': 'Average Performance Gap',
                    'value': f'{max(0, 75 - round(overall_performance, 1))} pts',
                    'detail': 'Distance to the target performance threshold.',
                },
            ],
            'predictive': [
                {
                    'title': 'Projected Promotion Ready',
                    'value': str(projected_promotion_ready),
                    'detail': 'Based on current readiness and trend.',
                },
                {
                    'title': 'Attendance Forecast',
                    'value': f'{projected_attendance_change}%',
                    'detail': 'Estimated attendance trend value for the next review period.',
                },
                {
                    'title': 'Next Promotion Window',
                    'value': '3 months',
                    'detail': 'Expected time to reach belt advancement readiness.',
                },
            ],
            'prescriptive': recommendations,
        })


class SessionViewSet(viewsets.ModelViewSet):
    queryset = Session.objects.all()
    serializer_class = SessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        session = serializer.save()
        # Notify all students for new schedule
        all_students = Student.objects.all()
        for student in all_students:
            # Student notification
            Notification.objects.create(
                student=student,
                notification_type='schedule_created',
                message=f'New class schedule: {session.session_type} on {session.date} at {session.start_time}',
                date_sent=timezone.now().date(),
                recipient=student.contacts.first().email_address if student.contacts.exists() else 'student',
            )
            # Parent notification
            parents = ParentStudent.objects.filter(student=student).values_list('parent', flat=True)
            for parent_id in parents:
                try:
                    parent_user = User.objects.get(id=parent_id)
                    if 'belt' in session.session_type.lower():
                        notif_type = 'belt_exam_scheduled'
                        message = f'Belt examination scheduled for your child: {session.session_type} on {session.date} at {session.start_time}'
                    elif 'tournament' in session.session_type.lower():
                        notif_type = 'tournament_announcement'
                        message = f'Tournament announcement: {session.session_type} on {session.date} at {session.start_time}'
                    else:
                        notif_type = 'child_upcoming_class'
                        message = f'Your child has an upcoming {session.session_type} class on {session.date} at {session.start_time}'
                    
                    Notification.objects.create(
                        student=student,
                        notification_type=notif_type,
                        message=message,
                        date_sent=timezone.now().date(),
                        recipient=parent_user.email or 'parent',
                    )
                except:
                    pass
        
        # Create notification for admin/instructor
        student = Student.objects.first()  # Use first student as placeholder for system notifications
        if student:
            if 'tournament' in session.session_type.lower():
                notif_type = 'tournament_announcement'
                message = f'Tournament schedule added: {session.session_type} on {session.date} at {session.start_time}'
            elif 'seminar' in session.session_type.lower():
                notif_type = 'seminar_added'
                message = f'Seminar schedule added: {session.session_type} on {session.date} at {session.start_time}'
            elif 'belt' in session.session_type.lower():
                notif_type = 'belt_exam_scheduled'
                message = f'Belt examination scheduled: {session.session_type} on {session.date} at {session.start_time}'
            else:
                notif_type = 'schedule_created'
                message = f'New class schedule created: {session.session_type} on {session.date} at {session.start_time}'
            Notification.objects.create(
                student=student,
                notification_type=notif_type,
                message=message,
                date_sent=timezone.now().date(),
                recipient='admin@instructor',
            )

    def perform_update(self, serializer):
        session = serializer.save()
        # Notify students enrolled in this session
        enrolled_students = Attendance.objects.filter(session=session).values_list('student', flat=True).distinct()
        for student_id in enrolled_students:
            student = Student.objects.get(student_id=student_id)
            Notification.objects.create(
                student=student,
                notification_type='schedule_updated',
                message=f'Schedule updated: {session.session_type} on {session.date} at {session.start_time}',
                date_sent=timezone.now().date(),
                recipient=student.contacts.first().email_address if student.contacts.exists() else 'student',
            )
            # Notify parents about schedule change
            parents = ParentStudent.objects.filter(student=student).values_list('parent', flat=True)
            for parent_id in parents:
                try:
                    parent_user = User.objects.get(id=parent_id)
                    if 'belt' in session.session_type.lower():
                        notif_type = 'belt_exam_reminder'
                        message = f'Belt exam reminder: your child\'s {session.session_type} has been rescheduled to {session.date} at {session.start_time}'
                    else:
                        notif_type = 'child_schedule_changed'
                        message = f'Schedule changed for your child\'s {session.session_type} class on {session.date} at {session.start_time}'
                    
                    Notification.objects.create(
                        student=student,
                        notification_type=notif_type,
                        message=message,
                        date_sent=timezone.now().date(),
                        recipient=parent_user.email or 'parent',
                    )
                except:
                    pass
        # Admin notification
        student = Student.objects.first()
        if student:
            Notification.objects.create(
                student=student,
                notification_type='schedule_updated',
                message=f'Schedule updated successfully: {session.session_type} on {session.date} at {session.start_time}',
                date_sent=timezone.now().date(),
                recipient='admin@instructor',
            )


class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]


class StanceEvaluationViewSet(viewsets.ModelViewSet):
    queryset = StanceEvaluation.objects.all().order_by('-date_evaluated')
    serializer_class = StanceEvaluationSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.pose_service = PoseEvaluationService()

    @action(detail=False, methods=['post'], url_path='analyze', parser_classes=[MultiPartParser, FormParser, JSONParser])
    def analyze(self, request):
        if 'media' not in request.FILES:
            return Response({'detail': 'Media file is required.'}, status=status.HTTP_400_BAD_REQUEST)

        student_id = request.data.get('student_id')
        if not student_id:
            return Response({'detail': 'Student ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            student = Student.objects.get(student_id=student_id)
        except Student.DoesNotExist:
            return Response({'detail': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        media_file = request.FILES['media']

        try:
            analysis = self.pose_service.analyze_pose_media(media_file, student.student_id, evaluator=request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({'detail': f'Pose analysis failed: {exc}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        evaluation = StanceEvaluation.objects.create(
            student=student,
            stance_type=analysis['stance_type'],
            score=analysis['score'],
            remarks=analysis['remarks'],
            analysis_details=analysis['analysis_details'],
            evaluated_by=request.user,
            date_evaluated=timezone.now().date(),
        )

        # Create notification for pose evaluation completed
        Notification.objects.create(
            student=student,
            notification_type='pose_evaluation_completed',
            message=f'Pose evaluation completed for {student.first_name} {student.last_name} with score {evaluation.score}',
            date_sent=timezone.now().date(),
            recipient='admin@instructor',
        )

        serializer = self.get_serializer(evaluation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PoseTemplateViewSet(viewsets.ModelViewSet):
    queryset = PoseTemplate.objects.all().order_by('-created_at')
    serializer_class = PoseTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.pose_service = PoseEvaluationService()

    def perform_create(self, serializer):
        # Don't save directly - use the pose service to extract landmarks
        pass

    def create(self, request, *args, **kwargs):
        if 'media_file' not in request.FILES:
            return Response({'detail': 'Media file is required.'}, status=status.HTTP_400_BAD_REQUEST)

        stance_label = request.data.get('stance_label')
        if not stance_label:
            return Response({'detail': 'Stance label is required.'}, status=status.HTTP_400_BAD_REQUEST)

        media_file = request.FILES['media_file']

        try:
            result = self.pose_service.create_pose_template(media_file, stance_label, request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({'detail': f'Template creation failed: {exc}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Return the created template data
        template = PoseTemplate.objects.get(id=result['id'])
        serializer = self.get_serializer(template)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='label-choices')
    def label_choices(self, request):
        return Response(PoseTemplate.get_stance_label_choices())


class InstructorRatingViewSet(viewsets.ModelViewSet):
    queryset = InstructorRating.objects.all()
    serializer_class = InstructorRatingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        rating = serializer.save()
        # Notify student
        Notification.objects.create(
            student=rating.student,
            notification_type='grade_posted',
            message=f'Your instructor rating has been posted',
            date_sent=timezone.now().date(),
            recipient=rating.student.contacts.first().email_address if rating.student.contacts.exists() else 'student',
        )
        # Notify parents
        parents = ParentStudent.objects.filter(student=rating.student).values_list('parent', flat=True)
        for parent_id in parents:
            try:
                parent_user = User.objects.get(id=parent_id)
                Notification.objects.create(
                    student=rating.student,
                    notification_type='child_grading_available',
                    message=f'New grading results available for your child',
                    date_sent=timezone.now().date(),
                    recipient=parent_user.email or 'parent',
                )
            except:
                pass
        # Admin notification
        Notification.objects.create(
            student=rating.student,
            notification_type='grading_submitted',
            message=f'New grading submitted for {rating.student.first_name} {rating.student.last_name} by {rating.instructor.first_name} {rating.instructor.last_name}',
            date_sent=timezone.now().date(),
            recipient='admin@instructor',
        )

    def perform_update(self, serializer):
        rating = serializer.save()
        # Notify student
        Notification.objects.create(
            student=rating.student,
            notification_type='grade_posted',
            message=f'Your instructor rating has been updated',
            date_sent=timezone.now().date(),
            recipient=rating.student.contacts.first().email_address if rating.student.contacts.exists() else 'student',
        )
        # Notify parents
        parents = ParentStudent.objects.filter(student=rating.student).values_list('parent', flat=True)
        for parent_id in parents:
            try:
                parent_user = User.objects.get(id=parent_id)
                Notification.objects.create(
                    student=rating.student,
                    notification_type='child_grading_available',
                    message=f'Updated grading results available for your child',
                    date_sent=timezone.now().date(),
                    recipient=parent_user.email or 'parent',
                )
            except:
                pass
        # Admin notification
        Notification.objects.create(
            student=rating.student,
            notification_type='grade_updated',
            message=f'Grade updated successfully for {rating.student.first_name} {rating.student.last_name}',
            date_sent=timezone.now().date(),
            recipient='admin@instructor',
        )


class KataRatingViewSet(viewsets.ModelViewSet):
    queryset = KataRating.objects.all().order_by('-date_recorded')
    serializer_class = KataRatingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        rating = serializer.save()
        # Notify student
        Notification.objects.create(
            student=rating.student,
            notification_type='grade_posted',
            message=f'Your kata grade has been posted: {rating.combined_kata_score}',
            date_sent=timezone.now().date(),
            recipient=rating.student.contacts.first().email_address if rating.student.contacts.exists() else 'student',
        )
        # Notify parents
        parents = ParentStudent.objects.filter(student=rating.student).values_list('parent', flat=True)
        for parent_id in parents:
            try:
                parent_user = User.objects.get(id=parent_id)
                Notification.objects.create(
                    student=rating.student,
                    notification_type='child_grading_available',
                    message=f'New grading results available for your child (Kata)',
                    date_sent=timezone.now().date(),
                    recipient=parent_user.email or 'parent',
                )
            except:
                pass
        # Admin notification
        Notification.objects.create(
            student=rating.student,
            notification_type='grading_submitted',
            message=f'Kata grading submitted for {rating.student.first_name} {rating.student.last_name}',
            date_sent=timezone.now().date(),
            recipient='admin@instructor',
        )

    def perform_update(self, serializer):
        rating = serializer.save()
        # Notify student
        Notification.objects.create(
            student=rating.student,
            notification_type='grade_posted',
            message=f'Your kata grade has been updated: {rating.combined_kata_score}',
            date_sent=timezone.now().date(),
            recipient=rating.student.contacts.first().email_address if rating.student.contacts.exists() else 'student',
        )
        # Notify parents
        parents = ParentStudent.objects.filter(student=rating.student).values_list('parent', flat=True)
        for parent_id in parents:
            try:
                parent_user = User.objects.get(id=parent_id)
                Notification.objects.create(
                    student=rating.student,
                    notification_type='child_grading_available',
                    message=f'Updated grading results available for your child (Kata)',
                    date_sent=timezone.now().date(),
                    recipient=parent_user.email or 'parent',
                )
            except:
                pass
        # Admin notification
        Notification.objects.create(
            student=rating.student,
            notification_type='grade_updated',
            message=f'Kata grade updated for {rating.student.first_name} {rating.student.last_name}',
            date_sent=timezone.now().date(),
            recipient='admin@instructor',
        )

    def get_queryset(self):
        queryset = super().get_queryset()
        student_id = self.request.query_params.get('student_id')
        if student_id:
            queryset = queryset.filter(student__student_id=student_id)

        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from and date_to:
            queryset = queryset.filter(date_recorded__range=(date_from, date_to))

        month = self.request.query_params.get('month')
        if month:
            queryset = queryset.filter(month_year=month)

        return queryset

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        student_id = request.query_params.get('student_id')
        if not student_id:
            return Response({'detail': 'student_id query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        latest = queryset.order_by('-date_recorded').first()
        if not latest:
            return Response({'detail': 'No kata rating found for that student.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(self.get_serializer(latest).data)


class KumiteRatingViewSet(viewsets.ModelViewSet):
    queryset = KumiteRating.objects.all().order_by('-date_recorded')
    serializer_class = KumiteRatingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        rating = serializer.save()
        # Notify student
        Notification.objects.create(
            student=rating.student,
            notification_type='grade_posted',
            message=f'Your kumite grade has been posted: {rating.combined_kumite_score}',
            date_sent=timezone.now().date(),
            recipient=rating.student.contacts.first().email_address if rating.student.contacts.exists() else 'student',
        )
        # Notify parents
        parents = ParentStudent.objects.filter(student=rating.student).values_list('parent', flat=True)
        for parent_id in parents:
            try:
                parent_user = User.objects.get(id=parent_id)
                Notification.objects.create(
                    student=rating.student,
                    notification_type='child_grading_available',
                    message=f'New grading results available for your child (Kumite)',
                    date_sent=timezone.now().date(),
                    recipient=parent_user.email or 'parent',
                )
            except:
                pass
        # Admin notification
        Notification.objects.create(
            student=rating.student,
            notification_type='grading_submitted',
            message=f'Kumite grading submitted for {rating.student.first_name} {rating.student.last_name}',
            date_sent=timezone.now().date(),
            recipient='admin@instructor',
        )

    def perform_update(self, serializer):
        rating = serializer.save()
        # Notify student
        Notification.objects.create(
            student=rating.student,
            notification_type='grade_posted',
            message=f'Your kumite grade has been updated: {rating.combined_kumite_score}',
            date_sent=timezone.now().date(),
            recipient=rating.student.contacts.first().email_address if rating.student.contacts.exists() else 'student',
        )
        # Notify parents
        parents = ParentStudent.objects.filter(student=rating.student).values_list('parent', flat=True)
        for parent_id in parents:
            try:
                parent_user = User.objects.get(id=parent_id)
                Notification.objects.create(
                    student=rating.student,
                    notification_type='child_grading_available',
                    message=f'Updated grading results available for your child (Kumite)',
                    date_sent=timezone.now().date(),
                    recipient=parent_user.email or 'parent',
                )
            except:
                pass
        # Admin notification
        Notification.objects.create(
            student=rating.student,
            notification_type='grade_updated',
            message=f'Kumite grade updated for {rating.student.first_name} {rating.student.last_name}',
            date_sent=timezone.now().date(),
            recipient='admin@instructor',
        )

    def get_queryset(self):
        queryset = super().get_queryset()
        student_id = self.request.query_params.get('student_id')
        if student_id:
            queryset = queryset.filter(student__student_id=student_id)

        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from and date_to:
            queryset = queryset.filter(date_recorded__range=(date_from, date_to))

        return queryset

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        student_id = request.query_params.get('student_id')
        if not student_id:
            return Response({'detail': 'student_id query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        latest = queryset.order_by('-date_recorded').first()
        if not latest:
            return Response({'detail': 'No kumite rating found for that student.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(self.get_serializer(latest).data)


class PerformanceSummaryViewSet(viewsets.ModelViewSet):
    queryset = PerformanceSummary.objects.all().order_by('-generated_at')
    serializer_class = PerformanceSummarySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        student_id = self.request.query_params.get('student_id')
        if student_id:
            queryset = queryset.filter(student__student_id=student_id)

        period = self.request.query_params.get('period')
        if period:
            queryset = queryset.filter(period=period)

        return queryset

    @action(detail=False, methods=['get'], url_path='current')
    def current(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        latest = queryset.order_by('-generated_at').first()
        if not latest:
            return Response({'detail': 'No performance summary found for that student.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(self.get_serializer(latest).data)

    @action(detail=False, methods=['post'], url_path='generate')
    def generate(self, request):
        student_id = request.data.get('student_id')
        period = request.data.get('period', 'monthly')
        if not student_id:
            return Response({'detail': 'student_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            student = Student.objects.get(student_id=student_id)
        except Student.DoesNotExist:
            return Response({'detail': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        summary = PerformanceAggregationService.generate_performance_summary(student, period)
        return Response(self.get_serializer(summary).data)

    @action(detail=False, methods=['get'], url_path='history')
    def history(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class BeltProgressionIndicatorViewSet(viewsets.ModelViewSet):
    queryset = BeltProgressionIndicator.objects.all().order_by('-last_assessment_date')
    serializer_class = BeltProgressionIndicatorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_update(self, serializer):
        old_status = self.get_object().readiness_status
        indicator = serializer.save()
        new_status = indicator.readiness_status
        
        # Notify parents if student becomes eligible for promotion
        if old_status != 'eligible' and new_status == 'eligible':
            student = indicator.student
            parents = ParentStudent.objects.filter(student=student).values_list('parent', flat=True)
            for parent_id in parents:
                try:
                    parent_user = User.objects.get(id=parent_id)
                    Notification.objects.create(
                        student=student,
                        notification_type='child_promotion_eligible',
                        message=f'Your child is now eligible for belt promotion to {indicator.target_belt}!',
                        date_sent=timezone.now().date(),
                        recipient=parent_user.email or 'parent',
                    )
                except:
                    pass

    def get_queryset(self):
        queryset = super().get_queryset()
        student_id = self.request.query_params.get('student_id')
        if student_id:
            queryset = queryset.filter(student__student_id=student_id)

        readiness_status = self.request.query_params.get('readiness_status')
        if readiness_status:
            queryset = queryset.filter(readiness_status=readiness_status)

        current_belt = self.request.query_params.get('current_belt')
        if current_belt:
            queryset = queryset.filter(current_belt=current_belt)

        return queryset

    @action(detail=True, methods=['patch'])
    def promote(self, request, pk=None):
        indicator = self.get_object()
        new_belt = indicator.target_belt
        indicator.current_belt = new_belt
        indicator.target_belt = BeltProgressionService.get_next_belt(new_belt)
        indicator.readiness_status = 'promoted'
        indicator.eligible_since = timezone.now().date()
        indicator.save()

        student = indicator.student
        student.current_belt_rank = new_belt
        student.save(update_fields=['current_belt_rank'])

        # Notify parents about promotion
        parents = ParentStudent.objects.filter(student=student).values_list('parent', flat=True)
        for parent_id in parents:
            try:
                parent_user = User.objects.get(id=parent_id)
                Notification.objects.create(
                    student=student,
                    notification_type='child_promotion_achieved',
                    message=f'Your child has been promoted to {new_belt}!',
                    date_sent=timezone.now().date(),
                    recipient=parent_user.email or 'parent',
                )
            except:
                pass

        return Response(self.get_serializer(indicator).data)

    @action(detail=True, methods=['get'])
    def recommendation(self, request, pk=None):
        indicator = self.get_object()
        return Response({
            'student_id': indicator.student.student_id,
            'readiness_status': indicator.readiness_status,
            'overall_readiness_percentage': indicator.overall_readiness_percentage,
            'kata_readiness': indicator.kata_readiness,
            'kumite_readiness': indicator.kumite_readiness,
            'discipline_readiness': indicator.discipline_readiness,
            'attendance_readiness': indicator.attendance_readiness,
            'recommended_next_step': 'Review belt readiness and training goals.' if indicator.overall_readiness_percentage >= 70 else 'Focus on weak areas before promotion.',
        })


class ProgressionInsightViewSet(viewsets.ModelViewSet):
    queryset = ProgressionInsight.objects.all().order_by('-generated_at')
    serializer_class = ProgressionInsightSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        student_id = self.request.query_params.get('student_id')
        if student_id:
            queryset = queryset.filter(student__student_id=student_id)

        insight_type = self.request.query_params.get('insight_type')
        if insight_type:
            queryset = queryset.filter(insight_type=insight_type)

        return queryset

    @action(detail=False, methods=['post'], url_path='generate')
    def generate(self, request):
        student_id = request.data.get('student_id')
        if not student_id:
            return Response({'detail': 'student_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            student = Student.objects.get(student_id=student_id)
        except Student.DoesNotExist:
            return Response({'detail': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        insights = ProgressionInsightService.analyze_student_performance(student)
        serializer = self.get_serializer(insights, many=True)
        return Response(serializer.data)


class InventoryViewSet(viewsets.ModelViewSet):
    queryset = Inventory.objects.all()
    serializer_class = InventorySerializer
    permission_classes = [IsAuthenticatedInventoryManager]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _prepare_inventory_data(self, request):
        data = request.data.copy()
        image_file = request.FILES.get('image_file')

        if image_file:
            name, ext = os.path.splitext(image_file.name)
            safe_name = slugify(name) or 'upload'
            filename = f"{uuid.uuid4().hex}_{safe_name}{ext}"
            images_dir = os.path.join(settings.MEDIA_ROOT, 'inventory_images')
            os.makedirs(images_dir, exist_ok=True)
            file_path = os.path.join(images_dir, filename)

            with open(file_path, 'wb+') as destination:
                for chunk in image_file.chunks():
                    destination.write(chunk)

            data['image_url'] = request.build_absolute_uri(f"{settings.MEDIA_URL}inventory_images/{filename}")

        data.pop('image_file', None)
        return data

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=self._prepare_inventory_data(request))
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', True)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=self._prepare_inventory_data(request), partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)


class SystemIDViewSet(viewsets.ModelViewSet):
    queryset = SystemID.objects.all()
    serializer_class = SystemIDSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        id_type = request.data.get('id_type')
        quantity = int(request.data.get('quantity', 1))
        if id_type not in dict(SystemID.ID_TYPE_CHOICES):
            return Response(
                {'detail': 'Invalid id_type. Must be student, instructor, admin, or parent.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        quantity = max(1, min(quantity, 100))
        generated = []
        for _ in range(quantity):
            code = self._generate_unique_code(id_type)
            generated.append(SystemID.objects.create(code=code, id_type=id_type))

        serializer = self.get_serializer(generated, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def _generate_unique_code(self, id_type):
        prefix_map = {
            'student': 'S',
            'instructor': 'I',
            'admin': 'A',
            'parent': 'P',
        }
        prefix = prefix_map.get(id_type, 'X')
        while True:
            code = f"{prefix}-{random.randint(0, 99999):05d}"
            if not SystemID.objects.filter(code=code).exists():
                return code


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Notification.objects.none()

        if getattr(user, 'role', None) in {'admin', 'instructor'}:
            return Notification.objects.all().order_by('-date_sent')

        queryset = Notification.objects.none()
        if getattr(user, 'role', None) == 'student':
            student_ids = SystemID.objects.filter(
                code__iexact=user.username,
                id_type='student',
                assigned_student__isnull=False,
            ).values_list('assigned_student_id', flat=True)
            queryset = Notification.objects.filter(
                Q(student__student_id__in=student_ids) |
                Q(recipient__iexact=user.email)
            )
        elif getattr(user, 'role', None) == 'parent':
            student_ids = ParentStudent.objects.filter(
                parent=user
            ).values_list('student_id', flat=True)
            queryset = Notification.objects.filter(
                Q(recipient__iexact=user.email) |
                Q(recipient__iexact=user.username) |
                Q(student__student_id__in=student_ids)
            )

        return queryset.order_by('-date_sent')

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        notifications = self.get_queryset()
        notifications.update(is_read=True)
        return Response({'detail': 'Notifications marked as read.'}, status=status.HTTP_200_OK)

    def perform_update(self, serializer):
        rating = serializer.save()
        Notification.objects.create(
            student=rating.student,
            notification_type='grade_updated',
            message=f'Grade updated successfully for {rating.student.first_name} {rating.student.last_name}',
            date_sent=timezone.now().date(),
            recipient='admin@instructor',
        )


class ParentStudentViewSet(viewsets.ModelViewSet):
    queryset = ParentStudent.objects.all()
    serializer_class = ParentStudentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return ParentStudent.objects.none()

        # Parents can only see their own relationships
        if getattr(user, 'role', None) == 'parent':
            return ParentStudent.objects.filter(parent=user)

        # Admins and instructors can see all relationships
        return ParentStudent.objects.all()

    def perform_create(self, serializer):
        serializer.save(added_by=self.request.user)

    @action(detail=False, methods=['post'], url_path='add-child')
    def add_child(self, request):
        """Allow parents to add children by student ID"""
        if getattr(request.user, 'role', None) != 'parent':
            return Response(
                {'detail': 'Only parents can add children.'},
                status=status.HTTP_403_FORBIDDEN
            )

        student_id = request.data.get('student_id', '').strip()
        relationship = request.data.get('relationship', 'guardian')

        if not student_id:
            return Response(
                {'detail': 'Student ID is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            student = Student.objects.get(student_id=student_id)
        except Student.DoesNotExist:
            return Response(
                {'detail': 'Student not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if relationship already exists
        if ParentStudent.objects.filter(parent=request.user, student=student).exists():
            return Response(
                {'detail': 'You are already connected to this student.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        parent_student = ParentStudent.objects.create(
            parent=request.user,
            student=student,
            relationship=relationship,
            added_by=request.user
        )

        serializer = self.get_serializer(parent_student)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='my-children')
    def my_children(self, request):
        """Get all children for the current parent user"""
        if getattr(request.user, 'role', None) != 'parent':
            return Response(
                {'detail': 'Only parents can view their children.'},
                status=status.HTTP_403_FORBIDDEN
            )

        relationships = ParentStudent.objects.filter(parent=request.user).select_related('student')
        serializer = self.get_serializer(relationships, many=True)
        return Response(serializer.data)


class FacialRecognitionViewSet(viewsets.ViewSet):
    """
    ViewSet for facial recognition operations.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.face_service = FacialRecognitionService()

    @action(detail=False, methods=['post'])
    def process_group_photo(self, request):
        """
        Process a group photo for attendance recognition.
        """
        if 'photo' not in request.FILES:
            return Response(
                {'detail': 'No photo file provided.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file type
        photo_file = request.FILES['photo']
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        if photo_file.content_type not in allowed_types:
            return Response(
                {'detail': 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file size (max 10MB)
        max_size = 10 * 1024 * 1024  # 10MB
        if photo_file.size > max_size:
            return Response(
                {'detail': 'File too large. Maximum size is 10MB.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        session_id = request.data.get('session_id')
        if not session_id:
            return Response(
                {'detail': 'Session ID is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            session = Session.objects.get(pk=session_id)
        except Session.DoesNotExist:
            return Response(
                {'detail': 'Session not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            results = self.face_service.process_group_photo(photo_file)

            # Format response for frontend - service now returns categorized results
            response_data = {
                'session_id': session_id,
                'total_faces': results['total_faces'],
                'confirmed_matches': results['confirmed_matches'],
                'ambiguous_matches': results['ambiguous_matches'],
                'unmatched_faces': results['unmatched_faces']
            }

            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'detail': f'Error processing photo: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def enroll_face(self, request):
        """
        Enroll a student's face data.
        """
        student_id = request.data.get('student_id')
        angle = request.data.get('angle', 'front')

        if not student_id:
            return Response(
                {'detail': 'Student ID is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if 'photo' not in request.FILES:
            return Response(
                {'detail': 'No photo file provided.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file type and size
        photo_file = request.FILES['photo']
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        if photo_file.content_type not in allowed_types:
            return Response(
                {'detail': 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        max_size = 5 * 1024 * 1024  # 5MB
        if photo_file.size > max_size:
            return Response(
                {'detail': 'File too large. Maximum size is 5MB.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate angle parameter
        valid_angles = ['front', 'left', 'right']
        if angle not in valid_angles:
            return Response(
                {'detail': f'Invalid angle. Must be one of: {", ".join(valid_angles)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            student = Student.objects.get(student_id=student_id)
        except Student.DoesNotExist:
            return Response(
                {'detail': 'Student not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            success = self.face_service.enroll_student_face(student, photo_file, angle)

            if success:
                return Response(
                    {'detail': 'Face enrolled successfully.'},
                    status=status.HTTP_201_CREATED
                )
            else:
                return Response(
                    {'detail': 'Failed to enroll face. Please ensure the photo contains a clear face.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            return Response(
                {'detail': f'Error enrolling face: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def record_batch_attendance(self, request):
        """
        Record batch attendance from processed group photo.
        """
        session_id = request.data.get('session_id')
        attendance_data = request.data.get('attendance', [])

        if not session_id:
            return Response(
                {'detail': 'Session ID is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not attendance_data or len(attendance_data) == 0:
            return Response(
                {'detail': 'Attendance data is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate attendance data structure
        for item in attendance_data:
            if not isinstance(item, dict) or 'student_id' not in item:
                return Response(
                    {'detail': 'Invalid attendance data format. Each entry must have student_id.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        try:
            session = Session.objects.get(pk=session_id)
        except Session.DoesNotExist:
            return Response(
                {'detail': 'Session not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        created_attendance = []
        errors = []
        from django.utils import timezone

        for item in attendance_data:
            student_id = item.get('student_id')
            is_present = item.get('present', True)  # Default to present
            confidence = item.get('confidence', 0.0)

            if not student_id:
                errors.append('Student ID is required for each attendance entry')
                continue

            try:
                student = Student.objects.get(student_id=student_id)

                # Check if attendance already exists for this student and session
                existing = Attendance.objects.filter(
                    student=student,
                    session=session
                ).first()

                current_time = timezone.now().time()

                if existing:
                    if is_present:
                        existing.time_in = existing.time_in or current_time
                        existing.recognition_confidence = confidence
                    else:
                        existing.time_in = None
                        existing.recognition_confidence = None
                    existing.save()
                    created_attendance.append(existing)
                else:
                    # Create new attendance record
                    attendance = Attendance.objects.create(
                        student=student,
                        session=session,
                        date=session.date,
                        time_in=current_time if is_present else None,
                        recognition_confidence=confidence if is_present else None
                    )
                    created_attendance.append(attendance)

            except Student.DoesNotExist:
                errors.append(f'Student {student_id} not found')
            except Exception as e:
                errors.append(f'Error recording attendance for student {student_id}: {str(e)}')

        # Create notifications for students
        for attendance in created_attendance:
            if not attendance.time_in:  # absent
                Notification.objects.create(
                    student=attendance.student,
                    notification_type='marked_absent',
                    message=f'You were marked absent for the session on {attendance.date}',
                    date_sent=timezone.now().date(),
                    recipient=attendance.student.contacts.first().email_address if attendance.student.contacts.exists() else 'student',
                )
                # Notify parents about absence
                parents = ParentStudent.objects.filter(student=attendance.student).values_list('parent', flat=True)
                for parent_id in parents:
                    try:
                        parent_user = User.objects.get(id=parent_id)
                        Notification.objects.create(
                            student=attendance.student,
                            notification_type='child_was_absent',
                            message=f'Your child was absent from the {session.session_type} session on {attendance.date}',
                            date_sent=timezone.now().date(),
                            recipient=parent_user.email or 'parent',
                        )
                    except:
                        pass
            else:  # present
                # Notify parents about attendance
                parents = ParentStudent.objects.filter(student=attendance.student).values_list('parent', flat=True)
                for parent_id in parents:
                    try:
                        parent_user = User.objects.get(id=parent_id)
                        Notification.objects.create(
                            student=attendance.student,
                            notification_type='child_attended_class',
                            message=f'Your child attended the {session.session_type} session on {attendance.date}',
                            date_sent=timezone.now().date(),
                            recipient=parent_user.email or 'parent',
                        )
                    except:
                        pass
                        
            # Sync gamification and check for achievements
            old_profile = GamificationProfile.objects.filter(student=attendance.student).first()
            old_level = old_profile.level if old_profile else 1
            old_streak = old_profile.streak_days if old_profile else 0

            GamificationService.sync_student_profile(attendance.student)

            new_profile = GamificationProfile.objects.get(student=attendance.student)
            if new_profile.level > old_level:
                Notification.objects.create(
                    student=attendance.student,
                    notification_type='level_increased',
                    message=f'Congratulations! You have reached level {new_profile.level}',
                    date_sent=timezone.now().date(),
                    recipient=attendance.student.contacts.first().email_address if attendance.student.contacts.exists() else 'student',
                )
                # Notify parents about achievement
                parents = ParentStudent.objects.filter(student=attendance.student).values_list('parent', flat=True)
                for parent_id in parents:
                    try:
                        parent_user = User.objects.get(id=parent_id)
                        Notification.objects.create(
                            student=attendance.student,
                            notification_type='child_achievement_earned',
                            message=f'Your child has reached level {new_profile.level}!',
                            date_sent=timezone.now().date(),
                            recipient=parent_user.email or 'parent',
                        )
                    except:
                        pass
                        
            if new_profile.streak_days > old_streak and new_profile.streak_days >= 5:
                Notification.objects.create(
                    student=attendance.student,
                    notification_type='attendance_streak_achieved',
                    message=f'Great job! You have achieved an attendance streak of {new_profile.streak_days} days',
                    date_sent=timezone.now().date(),
                    recipient=attendance.student.contacts.first().email_address if attendance.student.contacts.exists() else 'student',
                )
                # Notify parents about streak achievement
                parents = ParentStudent.objects.filter(student=attendance.student).values_list('parent', flat=True)
                for parent_id in parents:
                    try:
                        parent_user = User.objects.get(id=parent_id)
                        Notification.objects.create(
                            student=attendance.student,
                            notification_type='child_achievement_earned',
                            message=f'Your child has achieved an attendance streak of {new_profile.streak_days} days!',
                            date_sent=timezone.now().date(),
                            recipient=parent_user.email or 'parent',
                        )
                    except:
                        pass

        # Create notification for attendance recorded (admin)
        if created_attendance:
            student = Student.objects.first()
            if student:
                Notification.objects.create(
                    student=student,
                    notification_type='attendance_recorded',
                    message=f'Student attendance recorded for session {session.session_type} on {session.date}',
                    date_sent=timezone.now().date(),
                    recipient='admin@instructor',
                )

        return Response({
            'created_count': len(created_attendance),
            'errors': errors,
            'attendance_ids': [a.attendance_id for a in created_attendance]
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def extract_faces(self, request):
        """
        Extract faces from a group photo for enrollment.
        """
        if 'photo' not in request.FILES:
            return Response(
                {'detail': 'No photo file provided.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file type and size
        photo_file = request.FILES['photo']
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        if photo_file.content_type not in allowed_types:
            return Response(
                {'detail': 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        max_size = 10 * 1024 * 1024  # 10MB
        if photo_file.size > max_size:
            return Response(
                {'detail': 'File too large. Maximum size is 10MB.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            results = self.face_service.extract_faces_from_photo(photo_file)

            # Format response for frontend
            response_data = {
                'total_faces': results['total_faces'],
                'faces': []
            }

            # Process extracted faces
            for face_data in results['faces']:
                response_data['faces'].append({
                    'face_index': face_data['face_index'],
                    'bounding_box': face_data['bounding_box'],  # [x, y, width, height]
                    'encoding': face_data['encoding']  # Base64 encoded face data
                })

            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'detail': f'Error extracting faces: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def enroll_from_group(self, request):
        """
        Enroll faces from extracted group photo data.
        """
        faces = request.data.get('faces', [])

        if not faces:
            # Legacy support: accept face_assignments + face_{index}_encoding payload
            face_assignments = request.data.get('face_assignments', {})
            if isinstance(face_assignments, dict):
                for face_index, student_id in face_assignments.items():
                    encoding = request.data.get(f'face_{face_index}_encoding')
                    if encoding:
                        faces.append({
                            'student_id': student_id,
                            'encoding': encoding
                        })

        if not faces:
            return Response(
                {'detail': 'Faces data is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        enrolled_count = 0
        errors = []

        for face_data in faces:
            try:
                student_id = face_data.get('student_id')
                encoding = face_data.get('encoding')

                if student_id is None:
                    errors.append('Missing student_id for a face entry')
                    continue

                if not encoding:
                    errors.append(f'No encoding provided for student {student_id}')
                    continue

                try:
                    student_id = int(student_id)
                except (TypeError, ValueError):
                    errors.append(f'Invalid student_id value: {student_id}')
                    continue

                student = Student.objects.get(student_id=student_id)
                saved = self.face_service.save_face_encoding(student, encoding)
                if saved:
                    enrolled_count += 1
                else:
                    errors.append(f'Failed to save encoding for student {student_id}')
            except Student.DoesNotExist:
                errors.append(f'Student {student_id} not found')
            except Exception as e:
                errors.append(f'Error enrolling face: {str(e)}')

        return Response({
            'enrolled_count': enrolled_count,
            'errors': errors
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def record_manual_attendance(self, request):
        """
        Record manual attendance entries for students.
        Allows instructors to manually mark attendance without facial recognition.
        """
        session_id = request.data.get('session_id')
        attendance_data = request.data.get('attendance', [])

        if not session_id:
            return Response(
                {'detail': 'Session ID is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            session = Session.objects.get(pk=session_id)
        except Session.DoesNotExist:
            return Response(
                {'detail': 'Session not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        created_attendance = []
        errors = []
        current_time = timezone.now().time()

        for item in attendance_data:
            student_id = item.get('student_id')
            is_present = item.get('present', False)
            time_in = item.get('time_in')  # Optional: specific time

            if not student_id:
                errors.append('Student ID is required for each attendance entry')
                continue

            try:
                student = Student.objects.get(student_id=student_id)

                # Check if attendance already exists
                existing = Attendance.objects.filter(
                    student=student,
                    session=session
                ).first()

                if existing:
                    # Update existing record
                    if is_present:
                        existing.time_in = time_in if time_in else current_time
                    else:
                        existing.time_in = None
                    existing.recognition_confidence = None
                    existing.save()
                    created_attendance.append(existing)
                else:
                    # Create new record
                    attendance = Attendance.objects.create(
                        student=student,
                        session=session,
                        date=session.date,
                        time_in=time_in if time_in and is_present else (current_time if is_present else None),
                        recognition_confidence=None  # Manual entry has no confidence score
                    )
                    created_attendance.append(attendance)

            except Student.DoesNotExist:
                errors.append(f'Student {student_id} not found')
            except Exception as e:
                errors.append(f'Error recording attendance for student {student_id}: {str(e)}')

        return Response({
            'created_count': len(created_attendance),
            'errors': errors,
            'attendance_ids': [a.attendance_id for a in created_attendance]
        }, status=status.HTTP_201_CREATED)


# E-Commerce Views


class ProductViewSet(viewsets.ModelViewSet):
    """ViewSet for browsing products in inventory"""
    queryset = Inventory.objects.filter(quantity__gt=0)
    serializer_class = InventorySerializer
    permission_classes = [permissions.AllowAny]
    filterset_fields = ['category']
    search_fields = ['item_name', 'description']

    def get_queryset(self):
        queryset = super().get_queryset()
        category = self.request.query_params.get('category')
        search = self.request.query_params.get('search')

        if category:
            queryset = queryset.filter(category=category)
        if search:
            queryset = queryset.filter(item_name__icontains=search) | queryset.filter(description__icontains=search)

        return queryset


class CartViewSet(viewsets.ViewSet):
    """ViewSet for managing shopping cart"""
    permission_classes = [permissions.IsAuthenticated]

    def get_cart(self, user):
        """Get or create cart for user"""
        cart, created = Cart.objects.get_or_create(user=user)
        return cart

    @action(detail=False, methods=['get'])
    def my_cart(self, request):
        """Get current user's cart"""
        cart = self.get_cart(request.user)
        serializer = CartSerializer(cart)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def add_item(self, request):
        """Add item to cart"""
        cart = self.get_cart(request.user)
        inventory_item_id = request.data.get('inventory_item_id')
        quantity = int(request.data.get('quantity', 1))

        if not inventory_item_id or quantity < 1:
            return Response(
                {'detail': 'Invalid inventory_item_id or quantity'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            inventory_item = Inventory.objects.get(item_id=inventory_item_id)
        except Inventory.DoesNotExist:
            return Response(
                {'detail': 'Product not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if inventory_item.quantity < quantity:
            return Response(
                {'detail': f'Only {inventory_item.quantity} items available in stock'},
                status=status.HTTP_400_BAD_REQUEST
            )

        cart_item, created = CartItem.objects.get_or_create(
            cart=cart,
            inventory_item=inventory_item,
            defaults={'quantity': quantity}
        )

        if not created:
            cart_item.quantity += quantity
            cart_item.save()

        serializer = CartItemSerializer(cart_item)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def update_item(self, request):
        """Update item quantity in cart"""
        cart = self.get_cart(request.user)
        cart_item_id = request.data.get('cart_item_id')
        quantity = int(request.data.get('quantity', 1))

        if quantity < 1:
            # Delete item if quantity is 0 or negative
            try:
                cart_item = CartItem.objects.get(id=cart_item_id, cart=cart)
                cart_item.delete()
                return Response({'detail': 'Item removed from cart'}, status=status.HTTP_200_OK)
            except CartItem.DoesNotExist:
                return Response(
                    {'detail': 'Cart item not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

        try:
            cart_item = CartItem.objects.get(id=cart_item_id, cart=cart)
            cart_item.quantity = quantity
            cart_item.save()
            serializer = CartItemSerializer(cart_item)
            return Response(serializer.data)
        except CartItem.DoesNotExist:
            return Response(
                {'detail': 'Cart item not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['post'])
    def remove_item(self, request):
        """Remove item from cart"""
        cart = self.get_cart(request.user)
        cart_item_id = request.data.get('cart_item_id')

        try:
            cart_item = CartItem.objects.get(id=cart_item_id, cart=cart)
            cart_item.delete()
            return Response({'detail': 'Item removed from cart'}, status=status.HTTP_200_OK)
        except CartItem.DoesNotExist:
            return Response(
                {'detail': 'Cart item not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['post'])
    def clear_cart(self, request):
        """Clear all items from cart"""
        cart = self.get_cart(request.user)
        cart.items.all().delete()
        return Response({'detail': 'Cart cleared'}, status=status.HTTP_200_OK)


class OrderViewSet(viewsets.ViewSet):
    """ViewSet for managing orders"""
    permission_classes = [permissions.IsAuthenticated]

    def _has_permission_to_view_order(self, request, order):
        """Check if user has permission to view order"""
        return (request.user == order.user or
                request.user.role in ['admin', 'instructor'])

    @action(detail=False, methods=['post'])
    def create_order(self, request):
        """Create order from cart"""
        user = request.user
        cart = get_object_or_404(Cart, user=user)

        if not cart.items.exists():
            return Response(
                {'detail': 'Cart is empty'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = OrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            # Get student object if available
            student = None
            try:
                student = Student.objects.filter(user=user).first()
            except:
                pass

            # Create order
            order = Order.objects.create(
                user=user,
                student=student,
                recipient_name=serializer.validated_data['recipient_name'],
                recipient_contact=serializer.validated_data['recipient_contact'],
                delivery_address=serializer.validated_data['delivery_address'],
                delivery_city=serializer.validated_data.get('delivery_city', ''),
                customer_notes=serializer.validated_data.get('customer_notes', ''),
                order_status='pending'
            )

            # Create order items from cart items
            total_amount = 0
            for cart_item in cart.items.all():
                item_price = cart_item.inventory_item.price
                OrderItem.objects.create(
                    order=order,
                    inventory_item=cart_item.inventory_item,
                    item_name=cart_item.inventory_item.item_name,
                    quantity=cart_item.quantity,
                    price_at_order=item_price
                )
                total_amount += float(item_price) * cart_item.quantity

            order.total_amount = total_amount
            order.save()

            # Clear cart
            cart.items.all().delete()

            # Create notification
            student_for_notif = student or Student.objects.first()
            if student_for_notif:
                Notification.objects.create(
                    student=student_for_notif,
                    notification_type='product_ordered',
                    message=f'Your order #{order.order_id} has been placed. Total: {total_amount:.2f}',
                    date_sent=timezone.now().date(),
                    recipient=user.email
                )

            response_serializer = OrderSerializer(order)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {'detail': f'Error creating order: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def my_orders(self, request):
        """Get current user's orders"""
        orders = Order.objects.filter(user=request.user).order_by('-created_at')
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def pending_orders(self, request):
        """Get pending orders (admin/instructor only)"""
        if request.user.role not in ['admin', 'instructor']:
            return Response(
                {'detail': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        orders = Order.objects.filter(order_status='pending').order_by('-created_at')
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def all_orders(self, request):
        """Get all orders (admin/instructor only)"""
        if request.user.role not in ['admin', 'instructor']:
            return Response(
                {'detail': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        orders = Order.objects.all().order_by('-created_at')
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def confirm_order(self, request):
        """Confirm a pending order (admin/instructor only)"""
        if request.user.role not in ['admin', 'instructor']:
            return Response(
                {'detail': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        order_id = request.data.get('order_id')
        admin_notes = request.data.get('admin_notes', '')

        try:
            order = Order.objects.get(order_id=order_id)

            if order.order_status != 'pending':
                return Response(
                    {'detail': f'Order is already {order.order_status}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            order.order_status = 'confirmed'
            order.confirmed_at = timezone.now()
            order.confirmed_by = request.user
            if admin_notes:
                order.admin_notes = admin_notes
            order.save()

            # Reduce inventory
            for order_item in order.items.all():
                if order_item.inventory_item:
                    order_item.inventory_item.quantity -= order_item.quantity
                    order_item.inventory_item.save()

            # Create notification
            if order.student:
                Notification.objects.create(
                    student=order.student,
                    notification_type='product_ordered',
                    message=f'Your order #{order.order_id} has been confirmed. Please pick up at the dojo.',
                    date_sent=timezone.now().date(),
                    recipient=order.user.email
                )

            serializer = OrderSerializer(order)
            return Response(serializer.data)

        except Order.DoesNotExist:
            return Response(
                {'detail': 'Order not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['post'])
    def complete_order(self, request):
        """Mark order as completed after customer pays (admin/instructor only)"""
        if request.user.role not in ['admin', 'instructor']:
            return Response(
                {'detail': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        order_id = request.data.get('order_id')

        try:
            order = Order.objects.get(order_id=order_id)

            if order.order_status != 'confirmed':
                return Response(
                    {'detail': 'Only confirmed orders can be completed'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            order.order_status = 'completed'
            order.completed_at = timezone.now()
            order.save()

            # Create notification
            if order.student:
                Notification.objects.create(
                    student=order.student,
                    notification_type='success',
                    message=f'Your order #{order.order_id} has been completed!',
                    date_sent=timezone.now().date(),
                    recipient=order.user.email
                )

            serializer = OrderSerializer(order)
            return Response(serializer.data)

        except Order.DoesNotExist:
            return Response(
                {'detail': 'Order not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['post'])
    def cancel_order(self, request):
        """Cancel an order (admin/instructor only or order owner)"""
        order_id = request.data.get('order_id')

        try:
            order = Order.objects.get(order_id=order_id)

            # Check permissions
            if request.user != order.user and request.user.role not in ['admin', 'instructor']:
                return Response(
                    {'detail': 'Permission denied'},
                    status=status.HTTP_403_FORBIDDEN
                )

            if order.order_status == 'completed':
                return Response(
                    {'detail': 'Cannot cancel a completed order'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Return inventory if order was confirmed
            if order.order_status == 'confirmed':
                for order_item in order.items.all():
                    if order_item.inventory_item:
                        order_item.inventory_item.quantity += order_item.quantity
                        order_item.inventory_item.save()

            order.order_status = 'cancelled'
            order.save()

            serializer = OrderSerializer(order)
            return Response(serializer.data)

        except Order.DoesNotExist:
            return Response(
                {'detail': 'Order not found'},
                status=status.HTTP_404_NOT_FOUND
            )
