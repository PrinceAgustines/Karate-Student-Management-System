import datetime

from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import BugReport, CustomUser, UserLoginEvent, UserPresence
from .serializers import (
    BugReportCreateSerializer,
    BugReportSerializer,
    CustomTokenObtainPairSerializer,
    RegisterSerializer,
    UserSerializer,
)


class RegisterView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class ParentTokenObtainView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        parent_id = request.data.get('parent_id', '').strip().upper()
        password = request.data.get('password', '') or ''

        if not parent_id:
            return Response({'parent_id': 'Parent ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if not password:
            return Response({'password': 'Password is required for parent login.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = CustomUser.objects.get(username__iexact=parent_id, role='parent')
        except CustomUser.DoesNotExist:
            return Response({'parent_id': 'Parent account not found.'}, status=status.HTTP_400_BAD_REQUEST)

        if not user.is_active:
            return Response({'detail': 'Parent account is inactive.'}, status=status.HTTP_403_FORBIDDEN)

        if not user.check_password(password):
            return Response({'password': 'Invalid password for this Parent ID.'}, status=status.HTTP_400_BAD_REQUEST)

        refresh = RefreshToken.for_user(user)
        UserLoginEvent.objects.create(user=user)
        return Response({'refresh': str(refresh), 'access': str(refresh.access_token)}, status=status.HTTP_200_OK)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserPresenceHeartbeatView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        UserPresence.objects.update_or_create(
            user=request.user,
            defaults={'last_seen': timezone.now()},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class BugReportCollectionView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, *args, **kwargs):
        if request.user.role != 'admin':
            raise PermissionDenied('Only administrators can view bug reports.')

        reports = BugReport.objects.select_related('reporter').all()
        serialized_reports = BugReportSerializer(
            reports,
            many=True,
            context={'request': request},
        ).data
        fixed_count = reports.filter(status=BugReport.STATUS_FIXED).count()
        total_count = reports.count()

        return Response({
            'total_count': total_count,
            'fixed_count': fixed_count,
            'active_count': total_count - fixed_count,
            'reports': serialized_reports,
        })

    def post(self, request, *args, **kwargs):
        if request.user.role not in {'instructor', 'student', 'parent'}:
            raise PermissionDenied('Only instructors, students, and parents can submit bug reports.')

        serializer = BugReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = serializer.save(reporter=request.user)
        return Response(
            BugReportSerializer(report, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class BugReportDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk, *args, **kwargs):
        if request.user.role != 'admin':
            raise PermissionDenied('Only administrators can update bug report status.')

        report = get_object_or_404(BugReport, pk=pk)
        new_status = request.data.get('status')
        if new_status not in {BugReport.STATUS_ACTIVE, BugReport.STATUS_FIXED}:
            return Response(
                {'status': 'Choose either active or fixed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        report.status = new_status
        report.save(update_fields=['status'])
        return Response(BugReportSerializer(report, context={'request': request}).data)


class AdminDashboardSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        if request.user.role != 'admin':
            raise PermissionDenied('Only administrators can view the admin dashboard summary.')

        active_since = timezone.now() - datetime.timedelta(seconds=90)
        roles = {}
        for role, label in CustomUser.ROLE_CHOICES:
            users = CustomUser.objects.filter(role=role)
            active_users = users.filter(
                is_active=True,
                presence__last_seen__gte=active_since,
            )
            roles[role] = {
                'label': label,
                'active_users': active_users.count(),
                'total_users': users.count(),
            }

        today = timezone.localdate()
        start_date = today - datetime.timedelta(days=6)
        login_counts = {
            row['login_date'].isoformat(): row['login_count']
            for row in UserLoginEvent.objects.filter(
                created_at__date__gte=start_date,
                created_at__date__lte=today,
            ).annotate(
                login_date=TruncDate('created_at'),
            ).values('login_date').annotate(
                login_count=Count('id'),
            )
        }
        login_trend = [
            {
                'date': (start_date + datetime.timedelta(days=offset)).isoformat(),
                'logins': login_counts.get(
                    (start_date + datetime.timedelta(days=offset)).isoformat(),
                    0,
                ),
            }
            for offset in range(7)
        ]

        bug_report_counts = {
            row['report_date'].isoformat(): row['report_count']
            for row in BugReport.objects.filter(
                created_at__date__gte=start_date,
                created_at__date__lte=today,
            ).annotate(
                report_date=TruncDate('created_at'),
            ).values('report_date').annotate(
                report_count=Count('id'),
            )
        }
        bug_reports_trend = [
            {
                'date': (start_date + datetime.timedelta(days=offset)).isoformat(),
                'reports': bug_report_counts.get(
                    (start_date + datetime.timedelta(days=offset)).isoformat(),
                    0,
                ),
            }
            for offset in range(7)
        ]

        return Response({
            'active_users': CustomUser.objects.filter(
                is_active=True,
                presence__last_seen__gte=active_since,
            ).count(),
            'total_users': CustomUser.objects.count(),
            'roles': roles,
            'login_trend': login_trend,
            'bug_reports_trend': bug_reports_trend,
        })
