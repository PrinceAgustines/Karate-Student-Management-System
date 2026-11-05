import datetime
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import BugReport, UserLoginEvent, UserPresence


class AdminDashboardSummaryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = get_user_model().objects.create_user(
            username='dashboard-admin',
            email='dashboard-admin@example.com',
            password='StrongPass!482',
            role='admin',
        )

    def test_summary_returns_role_counts_and_seven_day_login_totals(self):
        instructor = get_user_model().objects.create_user(
            username='dashboard-instructor',
            email='dashboard-instructor@example.com',
            password='StrongPass!482',
            role='instructor',
        )
        inactive_student = get_user_model().objects.create_user(
            username='inactive-student',
            email='inactive-student@example.com',
            password='StrongPass!482',
            role='student',
            is_active=False,
        )
        old_parent = get_user_model().objects.create_user(
            username='old-parent',
            email='old-parent@example.com',
            password='StrongPass!482',
            role='parent',
        )
        today = datetime.date(2025, 6, 15)
        login_time = timezone.make_aware(datetime.datetime(2025, 6, 13, 12))
        recent_presence = timezone.now()
        UserPresence.objects.create(user=self.admin, last_seen=recent_presence)
        UserPresence.objects.create(user=instructor, last_seen=recent_presence)
        UserPresence.objects.create(
            user=inactive_student,
            last_seen=recent_presence,
        )
        UserPresence.objects.create(
            user=old_parent,
            last_seen=recent_presence - datetime.timedelta(minutes=5),
        )
        UserLoginEvent.objects.create(user=self.admin)
        UserLoginEvent.objects.filter(user=self.admin).update(created_at=login_time)
        UserLoginEvent.objects.create(user=instructor)
        UserLoginEvent.objects.filter(user=instructor).update(created_at=login_time)
        BugReport.objects.create(
            reporter=instructor,
            title='One bug',
            description='Report from three days ago.',
        )
        BugReport.objects.filter(title='One bug').update(created_at=login_time)
        BugReport.objects.create(
            reporter=self.admin,
            title='Another bug',
            description='A second report from the same day.',
        )
        BugReport.objects.filter(title='Another bug').update(
            created_at=login_time + datetime.timedelta(minutes=10),
        )
        BugReport.objects.create(
            reporter=instructor,
            title='Older bug',
            description='Outside the seven-day chart window.',
        )
        BugReport.objects.filter(title='Older bug').update(
            created_at=login_time - datetime.timedelta(days=10),
        )
        self.client.force_authenticate(user=self.admin)

        with patch('apps.users.views.timezone.localdate', return_value=today):
            response = self.client.get('/api/users/admin-dashboard-summary/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['active_users'], 2)
        self.assertEqual(response.data['total_users'], 4)
        self.assertEqual(response.data['roles']['student']['active_users'], 0)
        self.assertEqual(response.data['roles']['student']['total_users'], 1)
        self.assertEqual(response.data['roles']['parent']['active_users'], 0)
        self.assertEqual(response.data['roles']['parent']['total_users'], 1)
        self.assertEqual(
            response.data['login_trend'],
            [
                {'date': '2025-06-09', 'logins': 0},
                {'date': '2025-06-10', 'logins': 0},
                {'date': '2025-06-11', 'logins': 0},
                {'date': '2025-06-12', 'logins': 0},
                {'date': '2025-06-13', 'logins': 2},
                {'date': '2025-06-14', 'logins': 0},
                {'date': '2025-06-15', 'logins': 0},
            ],
        )
        self.assertEqual(
            response.data['bug_reports_trend'],
            [
                {'date': '2025-06-09', 'reports': 0},
                {'date': '2025-06-10', 'reports': 0},
                {'date': '2025-06-11', 'reports': 0},
                {'date': '2025-06-12', 'reports': 0},
                {'date': '2025-06-13', 'reports': 2},
                {'date': '2025-06-14', 'reports': 0},
                {'date': '2025-06-15', 'reports': 0},
            ],
        )

    def test_non_admin_cannot_read_summary(self):
        instructor = get_user_model().objects.create_user(
            username='instructor',
            email='instructor@example.com',
            password='StrongPass!482',
            role='instructor',
        )
        self.client.force_authenticate(user=instructor)

        response = self.client.get('/api/users/admin-dashboard-summary/')

        self.assertEqual(response.status_code, 403)


class LoginEventTests(TestCase):
    def test_successful_token_login_records_login_event(self):
        user = get_user_model().objects.create_user(
            username='student-id',
            email='student@example.com',
            password='StrongPass!482',
            role='student',
        )

        response = APIClient().post(
            '/api/users/login/',
            {'email': user.email, 'password': 'StrongPass!482'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(UserLoginEvent.objects.filter(user=user).count(), 1)


class UserPresenceHeartbeatTests(TestCase):
    def test_authenticated_heartbeat_creates_then_refreshes_presence(self):
        user = get_user_model().objects.create_user(
            username='presence-user',
            email='presence@example.com',
            password='StrongPass!482',
            role='student',
        )
        client = APIClient()
        client.force_authenticate(user=user)

        first_response = client.post('/api/users/presence/heartbeat/')
        first_seen = UserPresence.objects.get(user=user).last_seen
        with patch('apps.users.views.timezone.now', return_value=first_seen + datetime.timedelta(seconds=30)):
            second_response = client.post('/api/users/presence/heartbeat/')

        self.assertEqual(first_response.status_code, 204)
        self.assertEqual(second_response.status_code, 204)
        self.assertEqual(
            UserPresence.objects.get(user=user).last_seen,
            first_seen + datetime.timedelta(seconds=30),
        )


class BugReportTests(TestCase):
    def setUp(self):
        self.instructor = get_user_model().objects.create_user(
            username='reporting-instructor',
            email='reporting-instructor@example.com',
            password='StrongPass!482',
            role='instructor',
            first_name='Rin',
            last_name='Dojo',
        )
        self.admin = get_user_model().objects.create_user(
            username='report-admin',
            email='report-admin@example.com',
            password='StrongPass!482',
            role='admin',
        )
        self.client = APIClient()

    def test_instructor_can_submit_report_and_admin_can_view_and_resolve_it(self):
        self.client.force_authenticate(user=self.instructor)
        response = self.client.post(
            '/api/users/bug-reports/',
            {
                'title': 'Schedule page error',
                'description': 'The schedule page does not load after selecting a date.',
                'picture': SimpleUploadedFile(
                    'schedule.png',
                    b'png-data',
                    content_type='image/png',
                ),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['status'], 'active')
        self.assertEqual(response.data['reporter_name'], 'Rin Dojo')

        self.client.force_authenticate(user=self.admin)
        list_response = self.client.get('/api/users/bug-reports/')
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data['total_count'], 1)
        self.assertEqual(list_response.data['active_count'], 1)
        self.assertEqual(list_response.data['fixed_count'], 0)

        status_response = self.client.patch(
            f"/api/users/bug-reports/{response.data['id']}/",
            {'status': 'fixed'},
            format='json',
        )
        self.assertEqual(status_response.status_code, 200)
        self.assertEqual(status_response.data['status'], 'fixed')

    def test_student_cannot_view_all_reports_and_invalid_image_is_rejected(self):
        student = get_user_model().objects.create_user(
            username='report-student',
            email='report-student@example.com',
            password='StrongPass!482',
            role='student',
        )
        self.client.force_authenticate(user=student)
        list_response = self.client.get('/api/users/bug-reports/')
        invalid_upload_response = self.client.post(
            '/api/users/bug-reports/',
            {
                'title': 'Invalid attachment',
                'description': 'The attachment is not an image.',
                'picture': SimpleUploadedFile(
                    'notes.txt',
                    b'plain-text',
                    content_type='text/plain',
                ),
            },
            format='multipart',
        )

        self.assertEqual(list_response.status_code, 403)
        self.assertEqual(invalid_upload_response.status_code, 400)
