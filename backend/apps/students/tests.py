import base64
import datetime
import tempfile
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    Attendance,
    BadgeDefinition,
    BeltProgressionArchive,
    Contact,
    FaceData,
    InstructorRating,
    Inventory,
    KataRating,
    Notification,
    ParentStudent,
    PerformanceSummary,
    PersonalInfo,
    PoseTemplate,
    Session,
    SparringMatch,
    StanceEvaluation,
    Student,
    StudentBadge,
    SystemID,
)
from .facial_recognition import FacialRecognitionService
from .pose_evaluation.live import process_live_pose_frame
from .pose_evaluation.service import PoseEvaluationService, get_pose_evaluation_service
from .pose_evaluation.trends import PoseAnalyticsService
from .serializers import PoseTemplateSerializer, SparringMatchSerializer, StudentSerializer
from .performance.services import (
    BeltProgressionService,
    GamificationService,
    PerformanceAggregationService,
)


class InventoryImageServingTests(SimpleTestCase):
    def test_inventory_images_are_served_when_debug_is_disabled(self):
        image_contents = b'karate gear image'

        with tempfile.TemporaryDirectory() as media_root, override_settings(
            MEDIA_ROOT=media_root,
            DEBUG=False,
        ):
            image_path = Path(media_root) / 'inventory_images' / 'karategearset.png'
            image_path.parent.mkdir(parents=True)
            image_path.write_bytes(image_contents)

            response = self.client.get(
                '/media/inventory_images/karategearset.png',
                HTTP_HOST='localhost',
            )
            response_contents = b''.join(response.streaming_content)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response_contents, image_contents)


class StudentPhotoServingTests(SimpleTestCase):
    def test_student_photos_are_served_when_debug_is_disabled(self):
        image_contents = b'student portrait image'

        with tempfile.TemporaryDirectory() as media_root, override_settings(
            MEDIA_ROOT=media_root,
            DEBUG=False,
        ):
            image_path = Path(media_root) / 'student_photos' / '42' / 'portrait.jpg'
            image_path.parent.mkdir(parents=True)
            image_path.write_bytes(image_contents)

            response = self.client.get(
                '/media/student_photos/42/portrait.jpg',
                HTTP_HOST='localhost',
            )
            response_contents = b''.join(response.streaming_content)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response_contents, image_contents)


class InventoryImageUploadTests(TestCase):
    def test_uploaded_inventory_image_is_saved_to_configured_storage(self):
        user = get_user_model().objects.create_user(
            username='inventory-instructor',
            email='inventory-instructor@example.com',
            password='StrongPass!482',
            role='instructor',
        )
        client = APIClient()
        client.force_authenticate(user=user)

        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            response = client.post(
                '/api/students/inventories/',
                {
                    'item_name': 'Mouthguard',
                    'category': 'equipment',
                    'quantity': 1,
                    'price': '100.00',
                    'image_file': SimpleUploadedFile(
                        'mouthguard.jpg',
                        b'image contents',
                        content_type='image/jpeg',
                    ),
                },
                format='multipart',
                HTTP_HOST='localhost',
            )

            self.assertEqual(response.status_code, 201, response.data)
            image_path = response.data['image_url'].split('/media/', 1)[1]
            self.assertTrue(default_storage.exists(image_path))
            self.assertEqual(Inventory.objects.get().image_url, response.data['image_url'])


class BeltProgressionSummaryTests(TestCase):
    def setUp(self):
        self.student = Student.objects.create(
            first_name='Ari',
            last_name='Tan',
            gender='Male',
            current_belt_rank='White Belt',
        )

    def test_assessment_updates_the_single_progression_summary(self):
        with patch.object(
            BeltProgressionService,
            'estimate_promotion_date',
            return_value=datetime.date(2026, 12, 1),
        ):
            first = BeltProgressionService.create_or_update_indicator(
                self.student, 80, 75, 90, 85
            )
            updated = BeltProgressionService.create_or_update_indicator(
                self.student, 90, 80, 95, 90
            )

        self.assertEqual(first.pk, updated.pk)
        self.assertEqual(updated.period, PerformanceSummary.BELT_PROGRESSION_PERIOD)
        self.assertEqual(updated.target_belt, 'Yellow Belt')
        self.assertEqual(updated.readiness_status, 'ready')
        self.assertEqual(updated.kata_requirement, 75.0)
        self.assertEqual(
            PerformanceSummary.objects.filter(
                student=self.student,
                period=PerformanceSummary.BELT_PROGRESSION_PERIOD,
            ).count(),
            1,
        )

    def test_apis_keep_summary_and_progression_results_separate(self):
        user = get_user_model().objects.create_user(
            username='progression-admin',
            email='progression-admin@example.com',
            password='StrongPass!482',
            role='admin',
        )
        PerformanceSummary.objects.create(
            student=self.student,
            period='monthly',
            start_date=datetime.date(2026, 10, 1),
            end_date=datetime.date(2026, 10, 31),
        )
        progression = BeltProgressionService.create_or_update_indicator(
            self.student, 80, 75, 90, 85
        )
        client = APIClient()
        client.force_authenticate(user=user)

        summaries = client.get(
            '/api/students/performance-summaries/',
            {'student_id': self.student.student_id},
        )
        indicators = client.get(
            '/api/students/belt-progression-indicators/',
            {'student_id': self.student.student_id},
        )

        self.assertEqual(summaries.status_code, 200)
        self.assertEqual(indicators.status_code, 200)
        self.assertEqual([item['period'] for item in summaries.data], ['monthly'])
        self.assertEqual(len(indicators.data), 1)
        self.assertEqual(indicators.data[0]['id'], progression.pk)
        self.assertEqual(indicators.data[0]['current_belt'], 'White Belt')

    def test_promote_endpoint_archives_records_and_advances_student_belt(self):
        user = get_user_model().objects.create_user(
            username='promotion-admin',
            email='promotion-admin@example.com',
            password='StrongPass!482',
            role='admin',
        )
        indicator = BeltProgressionService.create_or_update_indicator(
            self.student, 75, 70, 80, 85
        )
        indicator.readiness_status = 'ready'
        indicator.overall_readiness_percentage = 95
        indicator.save(update_fields=['readiness_status', 'overall_readiness_percentage'])
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.patch(
            f'/api/students/belt-progression-indicators/{indicator.pk}/promote/',
        )

        self.student.refresh_from_db()
        indicator.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['promoted_to'], 'Yellow Belt')
        self.assertEqual(self.student.current_belt_rank, 'Yellow Belt')
        self.assertEqual(response.data['archive']['archived_belt'], 'White Belt')
        self.assertEqual(indicator.target_belt, 'Orange Belt')
        self.assertEqual(indicator.readiness_status, 'not_ready')
        self.assertEqual(indicator.overall_readiness_percentage, 0)
        self.assertEqual(BeltProgressionArchive.objects.filter(student=self.student).count(), 1)

    def test_promote_endpoint_rejects_student_not_ready(self):
        user = get_user_model().objects.create_user(
            username='promotion-not-ready-admin',
            email='promotion-not-ready-admin@example.com',
            password='StrongPass!482',
            role='admin',
        )
        indicator = BeltProgressionService.create_or_update_indicator(
            self.student, 0, 0, 0, 0
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.patch(
            f'/api/students/belt-progression-indicators/{indicator.pk}/promote/',
        )

        self.student.refresh_from_db()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.student.current_belt_rank, 'White Belt')
        self.assertFalse(BeltProgressionArchive.objects.filter(student=self.student).exists())

    def test_kumite_readiness_uses_instructor_average_for_the_current_belt(self):
        today = timezone.localdate()
        previous_month_end = today.replace(day=1) - datetime.timedelta(days=1)
        student = self.student
        BeltProgressionArchive.objects.create(
            student=student,
            archived_belt='Yellow Belt',
        )
        BeltProgressionArchive.objects.filter(student=student).update(
            promotion_date=previous_month_end - datetime.timedelta(days=1),
        )
        InstructorRating.objects.create(
            student=student,
            kumite_score=80,
            date_evaluated=previous_month_end,
        )
        InstructorRating.objects.create(
            student=student,
            kumite_score=20,
            date_evaluated=today,
        )

        result = PerformanceAggregationService.generate_student_progression(student)

        self.assertEqual(result['performance_summary'].kumite_average, 20)
        self.assertEqual(result['belt_progression_indicator'].kumite_readiness, 71.43)


class PoseEvaluationServiceTests(TestCase):
    def test_reference_classifier_returns_unknown_when_no_templates_exist(self):
        service = PoseEvaluationService.__new__(PoseEvaluationService)

        with patch.object(service, 'get_template_classification', return_value=None):
            self.assertEqual(service.classify_landmarks_with_reference([]), ('Unknown Stance', 0.0, None))

    def test_media_analysis_uses_reference_matching(self):
        success, encoded_image = cv2.imencode(
            '.png',
            np.zeros((64, 64, 3), dtype=np.uint8),
        )
        self.assertTrue(success)
        service = PoseEvaluationService.__new__(PoseEvaluationService)
        service.use_mediapipe = True
        service.pose = object()
        landmarks = PoseReferenceTrainingTests.reference_landmarks()
        media = SimpleUploadedFile(
            'student-pose.png',
            encoded_image.tobytes(),
            content_type='image/png',
        )

        reference_match = {'matched': True, 'template_id': 1, 'stance_label': 'Age-uke / Rising block', 'similarity': 0.75}
        with patch.object(service, 'extract_pose_landmarks', return_value=landmarks), patch.object(
            service,
            'classify_landmarks_with_reference',
            return_value=('Age-uke / Rising block', 0.75, reference_match),
        ) as classify_by_reference:
            result = service.analyze_pose_media(media, student_id=123)

        self.assertEqual(result['stance_type'], 'Age-uke / Rising block')
        self.assertEqual(result['score'], 75)
        self.assertEqual(
            result['analysis_details']['frame_results'][0]['stance_type'],
            'Age-uke / Rising block',
        )
        self.assertEqual(
            result['analysis_details']['evaluation_source'],
            'MediaPipe pose landmarks matched against saved pose references',
        )
        self.assertEqual(result['analysis_details']['frame_results'][0]['reference_match'], reference_match)
        classify_by_reference.assert_called_once_with(landmarks)

    def test_pose_models_initialize_lazily_and_only_once(self):
        service = PoseEvaluationService()

        with patch.object(service, '_initialize_libraries') as initialize_libraries:
            self.assertFalse(service.supports_pose())
            self.assertFalse(service.supports_pose())

        initialize_libraries.assert_called_once_with()

    def test_pose_service_is_shared_for_the_process(self):
        with patch(
            'apps.students.pose_evaluation.service._pose_service',
            None,
        ), patch(
            'apps.students.pose_evaluation.service.PoseEvaluationService',
        ) as service_class:
            first = get_pose_evaluation_service()
            second = get_pose_evaluation_service()

        self.assertIs(first, second)
        service_class.assert_called_once_with()

    def test_viewset_construction_does_not_initialize_pose_service(self):
        from .views import StanceEvaluationViewSet

        with patch('apps.students.views.get_pose_evaluation_service') as get_service:
            StanceEvaluationViewSet()

        get_service.assert_not_called()

    def test_build_detected_stances_keeps_repeated_stances_in_order(self):
        frame_results = [
            {'frame_index': 0, 'stance_type': 'Downward block', 'confidence': 0.85},
            {'frame_index': 1, 'stance_type': 'Downward block', 'confidence': 0.86},
            {'frame_index': 2, 'stance_type': 'Lunge punch', 'confidence': 0.89},
            {'frame_index': 3, 'stance_type': 'Lunge punch', 'confidence': 0.88},
            {'frame_index': 4, 'stance_type': 'Downward block', 'confidence': 0.83},
            {'frame_index': 5, 'stance_type': 'Downward block', 'confidence': 0.82},
        ]

        detected_stances = PoseEvaluationService._build_detected_stances_from_frame_results(frame_results, len(frame_results))

        self.assertEqual([item['stance_type'] for item in detected_stances], ['Downward block', 'Lunge punch', 'Downward block'])
        self.assertEqual([item['first_frame'] for item in detected_stances], [0, 2, 4])
        self.assertEqual([item['score'] for item in detected_stances], [86, 89, 83])


class PoseReferenceTrainingTests(TestCase):
    @staticmethod
    def reference_landmarks():
        landmarks = [
            {
                'x': 0.3 + (index % 5) * 0.1,
                'y': 0.1 + (index // 5) * 0.1,
                'z': 0.0,
                'visibility': 0.95,
            }
            for index in range(33)
        ]
        landmarks[11].update(x=0.43, y=0.3)
        landmarks[12].update(x=0.57, y=0.3)
        landmarks[23].update(x=0.45, y=0.55)
        landmarks[24].update(x=0.55, y=0.55)
        landmarks[25].update(x=0.4, y=0.75)
        landmarks[26].update(x=0.6, y=0.75)
        landmarks[27].update(x=0.3, y=0.95)
        landmarks[28].update(x=0.7, y=0.95)
        return landmarks

    def test_uploaded_reference_image_is_saved_and_used_for_classification(self):
        success, encoded_image = cv2.imencode(
            '.png',
            np.zeros((64, 64, 3), dtype=np.uint8),
        )
        self.assertTrue(success        )
        service = PoseEvaluationService.__new__(PoseEvaluationService)
        service.use_mediapipe = True
        service.pose = object()
        reference_landmarks = self.reference_landmarks()
        image_file = SimpleUploadedFile(
            'kiba-dachi.png',
            encoded_image.tobytes(),
            content_type='image/png',
        )

        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            with patch.object(service, 'extract_pose_landmarks') as extract_landmarks:
                result = service.create_pose_template(
                    image_file,
                    'Kiba-dachi / Horse riding stance',
                )
            extract_landmarks.assert_not_called()

            template = PoseTemplate.objects.get(pk=result['id'])
            self.assertEqual(template.stance_label, 'Kiba-dachi / Horse riding stance')
            self.assertIsNone(template.landmarks)
            self.assertEqual(PoseTemplateSerializer(template).data['landmarks_count'], 0)
            self.assertTrue(template.media_file.name.startswith('pose_templates/'))
            self.assertTrue(template.media_file.storage.exists(template.media_file.name))
            with template.media_file.open('rb') as saved_image:
                self.assertEqual(saved_image.read(), encoded_image.tobytes())

            transformed_landmarks = [
                {
                    **landmark,
                    'x': landmark['x'] * 1.4 + 0.08,
                    'y': landmark['y'] * 1.4 + 0.06,
                    'z': landmark['z'] * 1.4,
                }
                for landmark in reference_landmarks
            ]
            with patch.object(
                service,
                'extract_pose_landmarks',
                return_value=reference_landmarks,
            ):
                expected_stance, expected_confidence, reference_match = service.classify_landmarks_with_reference(
                    transformed_landmarks,
                )
                self.assertEqual(expected_stance, 'Kiba-dachi / Horse riding stance')
                self.assertGreaterEqual(expected_confidence, service.REFERENCE_MATCH_THRESHOLD)
                self.assertTrue(reference_match['matched'])

            student_image = SimpleUploadedFile(
                'student-pose.png',
                encoded_image.tobytes(),
                content_type='image/png',
            )
            with patch.object(service, 'extract_pose_landmarks', return_value=transformed_landmarks), patch.object(
                service,
                '_get_template_landmarks',
                return_value=reference_landmarks,
            ):
                evaluation = service.analyze_pose_media(student_image, student_id=123)

            self.assertEqual(evaluation['stance_type'], expected_stance)
            self.assertEqual(
                evaluation['analysis_details']['frame_results'][0]['stance_type'],
                expected_stance,
            )
            self.assertTrue(evaluation['analysis_details']['frame_results'][0]['reference_match']['matched'])
            self.assertEqual(len(evaluation['analysis_details']['reference_matches']), 1)

    def test_pose_extraction_uses_full_image(self):
        service = PoseEvaluationService.__new__(PoseEvaluationService)
        service.use_mediapipe = True
        service.pose = object()
        image = np.zeros((80, 120, 3), dtype=np.uint8)
        landmarks = self.reference_landmarks()

        with patch.object(
            service,
            '_extract_landmarks_from_image',
            return_value=landmarks,
        ) as extract_landmarks:
            result = service.extract_pose_landmarks(image)

        self.assertEqual(result, landmarks)
        extract_landmarks.assert_called_once()
        self.assertEqual(extract_landmarks.call_args.args[0].shape, image.shape)

    def test_reference_training_rejects_unsupported_label(self):
        service = PoseEvaluationService.__new__(PoseEvaluationService)

        with self.assertRaisesMessage(ValueError, 'Select a supported stance or technique label.'):
            service.create_pose_template(
                SimpleUploadedFile('reference.png', b'image', content_type='image/png'),
                'Unrecognized technique',
            )


class PoseTemplatePermissionTests(TestCase):
    def test_students_cannot_upload_reference_templates(self):
        student_user = get_user_model().objects.create_user(
            username='pose-template-student',
            email='pose-template-student@example.com',
            password='StrongPass!482',
            role='student',
        )
        client = APIClient()
        client.force_authenticate(user=student_user)

        with patch('apps.students.views.get_pose_evaluation_service') as get_service:
            response = client.post(
                '/api/students/pose-templates/',
                {
                    'media_file': SimpleUploadedFile(
                        'reference.png',
                        b'image',
                        content_type='image/png',
                    ),
                    'stance_label': 'Kiba-dachi / Horse riding stance',
                },
                format='multipart',
            )

        self.assertEqual(response.status_code, 403)
        get_service.assert_not_called()


class StanceEvaluationSaveTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='pose-save-instructor',
            email='pose-save-instructor@example.com',
            password='StrongPass!482',
            role='instructor',
        )
        self.student = Student.objects.create(
            first_name='Mina',
            last_name='Sato',
            gender='Female',
        )
        self.session = Session.objects.create(
            date=datetime.date(2026, 2, 14),
            start_time=datetime.time(9, 0),
            end_time=datetime.time(10, 0),
            venue='Main dojo',
            session_type='regular',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch('apps.students.views.get_pose_evaluation_service')
    def test_analysis_is_previewed_and_save_endpoint_persists_it(self, get_service):
        get_service.return_value.analyze_pose_media.return_value = {
            'stance_type': 'Kiba-dachi / Horse riding stance',
            'score': 87,
            'remarks': 'Analyzed one frame.',
            'analysis_details': {'frames_with_pose': 1},
        }
        analysis_response = self.client.post(
            '/api/students/stance-evaluations/analyze/',
            {
                'student_id': self.student.student_id,
                'session_id': self.session.session_id,
                'media': SimpleUploadedFile('pose.png', b'image', content_type='image/png'),
            },
            format='multipart',
        )

        self.assertEqual(analysis_response.status_code, 200)
        self.assertEqual(StanceEvaluation.objects.count(), 0)
        self.assertEqual(analysis_response.data['student'], self.student.student_id)

        save_response = self.client.post(
            '/api/students/stance-evaluations/save/',
            {
                'student_id': self.student.student_id,
                'session_id': self.session.session_id,
                'stance_type': analysis_response.data['stance_type'],
                'score': analysis_response.data['score'],
                'remarks': 'Good stance.',
                'analysis_details': analysis_response.data['analysis_details'],
            },
            format='json',
        )

        self.assertEqual(save_response.status_code, 201)
        self.assertEqual(save_response.data['student'], self.student.student_id)
        self.assertEqual(save_response.data['remarks'], 'Good stance.')
        self.assertEqual(save_response.data['date_evaluated'], self.session.date.isoformat())
        self.assertEqual(save_response.data['analysis_details']['session_id'], self.session.session_id)
        self.assertEqual(StanceEvaluation.objects.count(), 1)
        self.assertEqual(Notification.objects.filter(
            notification_type='pose_evaluation_completed',
        ).count(), 1)

    def test_pose_trend_returns_last_five_sessions_for_selected_student(self):
        today = timezone.now().date()
        sessions = []
        for index in range(6):
            session = Session.objects.create(
                date=today - datetime.timedelta(days=90 - index * 10),
                start_time=datetime.time(9, 0),
                end_time=datetime.time(10, 0),
                venue='Main dojo',
                session_type='regular',
            )
            sessions.append(session)
            StanceEvaluation.objects.create(
                student=self.student,
                stance_type='Kiba-dachi',
                score=60 + index * 5,
                analysis_details={'session_id': session.session_id},
                date_evaluated=session.date,
            )

        StanceEvaluation.objects.create(
            student=self.student,
            stance_type='Kiba-dachi',
            score=95,
            analysis_details={'session_id': sessions[-1].session_id},
            date_evaluated=sessions[-1].date,
        )
        other_student = Student.objects.create(
            first_name='Aiko',
            last_name='Tanaka',
            gender='Female',
        )
        StanceEvaluation.objects.create(
            student=other_student,
            stance_type='Kiba-dachi',
            score=0,
            analysis_details={'session_id': sessions[-1].session_id},
            date_evaluated=sessions[-1].date,
        )

        trend = PoseAnalyticsService.calculate_accuracy_trend(self.student)

        self.assertEqual(len(trend['trend_data']), 5)
        self.assertEqual(
            [point['date'] for point in trend['trend_data']],
            [session.date.isoformat() for session in sessions[1:]],
        )
        self.assertEqual(trend['trend_data'][-1]['session_id'], sessions[-1].session_id)
        self.assertEqual(trend['trend_data'][-1]['accuracy'], 90)


class LivePoseEvaluationTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='live-pose-instructor',
            email='live-pose-instructor@example.com',
            password='StrongPass!482',
            role='instructor',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch('apps.students.pose_evaluation.live.process_live_pose_frame')
    def test_live_frame_endpoint_returns_backend_stance_without_saving(self, process_frame):
        process_frame.return_value = {
            'has_pose': True,
            'landmarks': [{'x': 0.5, 'y': 0.5, 'z': 0.0, 'visibility': 0.9}],
            'stance_type': 'Age-uke / Rising block',
            'confidence': 0.82,
            'reference_match': None,
        }
        response = self.client.post(
            '/api/students/pose-evaluation/live-frame/',
            {'frame': SimpleUploadedFile('frame.jpg', b'frame', content_type='image/jpeg')},
            format='multipart',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['stance_type'], 'Age-uke / Rising block')
        self.assertEqual(response.data['confidence'], 0.82)
        self.assertIsNone(response.data['reference_match'])
        self.assertTrue(response.data['has_pose'])
        self.assertEqual(StanceEvaluation.objects.count(), 0)

    @patch('apps.students.pose_evaluation.live.cv2.imdecode')
    @patch('apps.students.pose_evaluation.live.get_live_pose_service')
    def test_live_frame_uses_reference_pose_classifier(self, get_service, imdecode):
        imdecode.return_value = np.zeros((32, 32, 3), dtype=np.uint8)
        service = get_service.return_value
        service.supports_pose.return_value = True
        service.extract_pose_landmarks.return_value = [
            {'x': 0.4, 'y': 0.3, 'z': 0.0, 'visibility': 0.9},
        ]
        reference_match = {'matched': True, 'template_id': 1}
        service.classify_landmarks_with_reference.return_value = (
            'Age-uke / Rising block',
            0.75,
            reference_match,
        )

        result = process_live_pose_frame(b'encoded-frame')

        self.assertEqual(result['stance_type'], 'Age-uke / Rising block')
        self.assertEqual(result['confidence'], 0.75)
        self.assertEqual(result['reference_match'], reference_match)
        service.classify_landmarks_with_reference.assert_called_once_with(service.extract_pose_landmarks.return_value)

    def test_live_frame_endpoint_requires_an_instructor_role(self):
        self.user.role = 'student'
        self.user.save(update_fields=['role'])

        response = self.client.post(
            '/api/students/pose-evaluation/live-frame/',
            {'frame': SimpleUploadedFile('frame.jpg', b'frame', content_type='image/jpeg')},
            format='multipart',
        )

        self.assertEqual(response.status_code, 403)


class StudentDeletionTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='admin',
            email='admin@example.com',
            password='password123',
            role='admin',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_deleting_student_removes_related_records_and_files(self):
        student = Student.objects.create(first_name='John', last_name='Doe', gender='Male')
        Contact.objects.create(student=student, email_address='john@example.com')
        Notification.objects.create(
            student=student,
            notification_type='profile_updated',
            message='Profile updated',
            date_sent='2026-06-27',
            recipient='john@example.com',
        )
        system_id = SystemID.objects.create(code='S-12345', id_type='student', assigned_student=student)

        face_data = FaceData.objects.create(student=student)
        uploaded_file = SimpleUploadedFile('face.jpg', b'fake-image-bytes', content_type='image/jpeg')
        face_file_path = default_storage.save('student_faces/face.jpg', uploaded_file)
        face_data.image_path = face_file_path
        face_data.save(update_fields=['image_path'])

        response = self.client.delete(f'/api/students/students/{student.student_id}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Student.objects.filter(student_id=student.student_id).exists())
        self.assertFalse(Contact.objects.filter(student_id=student.student_id).exists())
        self.assertFalse(Notification.objects.filter(student_id=student.student_id).exists())
        self.assertFalse(FaceData.objects.filter(student_id=student.student_id).exists())
        self.assertFalse(default_storage.exists(face_file_path))

        updated_system_id = SystemID.objects.get(pk=system_id.pk)
        self.assertIsNone(updated_system_id.assigned_student)
        self.assertEqual(updated_system_id.status, 'generated')

    def test_deleting_assigned_student_id_removes_student_and_account(self):
        student = Student.objects.create(first_name='Jane', last_name='Doe', gender='Female')
        Contact.objects.create(student=student, email_address='jane@example.com')
        student_user = get_user_model().objects.create_user(
            username='S-54321',
            email='jane.account@example.com',
            password='password123',
            role='student',
            student_profile=student,
        )
        system_id = SystemID.objects.create(
            code='S-54321',
            id_type='student',
            assigned_student=student,
        )

        response = self.client.delete(f'/api/students/system-ids/{system_id.pk}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(SystemID.objects.filter(pk=system_id.pk).exists())
        self.assertFalse(Student.objects.filter(pk=student.student_id).exists())
        self.assertFalse(Contact.objects.filter(student_id=student.student_id).exists())
        self.assertFalse(get_user_model().objects.filter(pk=student_user.pk).exists())

    def test_deleting_assigned_parent_id_removes_parent_but_not_linked_student(self):
        child = Student.objects.create(first_name='Casey', last_name='Lee', gender='Other')
        parent = get_user_model().objects.create_user(
            username='P-54321',
            email='parent@example.com',
            password='password123',
            role='parent',
        )
        ParentStudent.objects.create(parent=parent, student=child)
        system_id = SystemID.objects.create(code='P-54321', id_type='parent', status='assigned')

        response = self.client.delete(f'/api/students/system-ids/{system_id.pk}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(get_user_model().objects.filter(pk=parent.pk).exists())
        self.assertFalse(ParentStudent.objects.filter(parent_id=parent.pk).exists())
        self.assertTrue(Student.objects.filter(pk=child.student_id).exists())

    def test_deleting_unassigned_student_id_does_not_remove_unlinked_account(self):
        unlinked_user = get_user_model().objects.create_user(
            username='S-54321',
            email='unrelated@example.com',
            password='password123',
            role='student',
        )
        system_id = SystemID.objects.create(code='S-54321', id_type='student')

        response = self.client.delete(f'/api/students/system-ids/{system_id.pk}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(SystemID.objects.filter(pk=system_id.pk).exists())
        self.assertTrue(get_user_model().objects.filter(pk=unlinked_user.pk).exists())

    def test_non_admin_cannot_delete_system_id_or_assigned_account(self):
        student_user = get_user_model().objects.create_user(
            username='S-54321',
            email='student@example.com',
            password='password123',
            role='student',
        )
        system_id = SystemID.objects.create(code='S-54321', id_type='student')
        self.client.force_authenticate(user=student_user)

        response = self.client.delete(f'/api/students/system-ids/{system_id.pk}/')

        self.assertEqual(response.status_code, 403)
        self.assertTrue(SystemID.objects.filter(pk=system_id.pk).exists())
        self.assertTrue(get_user_model().objects.filter(pk=student_user.pk).exists())

    def test_delete_rejects_account_with_mismatched_id_type(self):
        mismatched_user = get_user_model().objects.create_user(
            username='P-54321',
            email='mismatched@example.com',
            password='password123',
            role='student',
        )
        system_id = SystemID.objects.create(code='P-54321', id_type='parent', status='assigned')

        response = self.client.delete(f'/api/students/system-ids/{system_id.pk}/')

        self.assertEqual(response.status_code, 409)
        self.assertTrue(SystemID.objects.filter(pk=system_id.pk).exists())
        self.assertTrue(get_user_model().objects.filter(pk=mismatched_user.pk).exists())


class StudentProfileSerializerTests(TestCase):
    def test_profile_includes_registration_details_and_uploaded_photo_url(self):
        student = Student.objects.create(
            first_name='Alex',
            last_name='Santos',
            gender='Female',
            current_belt_rank='Purple Belt',
        )
        PersonalInfo.objects.create(
            student=student,
            birth_date='2010-04-03',
            height='150.00',
            weight='45.00',
            occupation='Student',
            civil_status='Single',
            build='Athletic',
            complexion='Medium',
            nationality='Philippines',
        )
        photo_path = 'student_photos/alex/profile.jpg'
        FaceData.objects.create(student=student, face_angle='front', image_path=photo_path)

        serialized = StudentSerializer(student).data

        self.assertEqual(serialized['gender'], 'Female')
        self.assertEqual(serialized['current_belt_rank'], 'Purple Belt')
        self.assertEqual(
            serialized['personal_info'],
            {
                'birth_date': '2010-04-03',
                'height': '150.00',
                'weight': '45.00',
                'occupation': 'Student',
                'civil_status': 'Single',
                'build': 'Athletic',
                'complexion': 'Medium',
                'nationality': 'Philippines',
                'hair_color': '',
            },
        )
        self.assertEqual(serialized['photo_url'], default_storage.url(photo_path))


class StudentRegistrationPhotoTests(TestCase):
    def test_registration_persists_photo_for_student_profile(self):
        SystemID.objects.create(code='S-54321', id_type='student')
        photo_file = SimpleUploadedFile('portrait.jpg', b'portrait-bytes', content_type='image/jpeg')

        def enroll_face(_service, student, _image_file, angle='front'):
            FaceData.objects.create(student=student, face_encoding='test-encoding', face_angle=angle)
            return True

        with patch(
            'apps.students.views.FacialRecognitionService.enroll_student_face',
            autospec=True,
            side_effect=enroll_face,
        ):
            response = APIClient().post(
                '/api/students/register/',
                {
                    'student_id': 'S-54321',
                    'email': 'alex.santos@example.com',
                    'password': 'StrongPass!482',
                    'password2': 'StrongPass!482',
                    'first_name': 'Alex',
                    'last_name': 'Santos',
                    'gender': 'Female',
                    'emergency_name': 'Jamie Santos',
                    'relationship': 'Parent',
                    'emergency_contact_number': '09123456789',
                    'photo': photo_file,
                },
                format='multipart',
            )

        self.assertEqual(response.status_code, 201, response.data)
        student = Student.objects.get(first_name='Alex', last_name='Santos')
        face_record = student.face_data.get()
        try:
            self.assertTrue(face_record.image_path.startswith(f'student_photos/{student.student_id}/'))
            self.assertTrue(default_storage.exists(face_record.image_path))
            self.assertTrue(
                StudentSerializer(student).data['photo_url'].endswith(face_record.image_path)
            )
        finally:
            default_storage.delete(face_record.image_path)


class EnrolledFaceLoadingTests(TestCase):
    def test_load_enrolled_faces_fetches_once_and_skips_invalid_encodings(self):
        student = Student.objects.create(
            first_name='Mina',
            last_name='Sato',
            gender='Female',
        )
        encoding = base64.b64encode(np.arange(128, dtype=np.float32).tobytes()).decode('utf-8')
        FaceData.objects.create(student=student, face_encoding=encoding)
        FaceData.objects.create(student=student, face_encoding='invalid-encoding')
        service = FacialRecognitionService.__new__(FacialRecognitionService)

        with self.assertNumQueries(1):
            encodings, student_ids, student_names = service._load_enrolled_faces()

        self.assertEqual(len(encodings), 1)
        self.assertEqual(student_ids, [student.student_id])
        self.assertEqual(student_names[student.student_id], 'Mina Sato')

class GamificationServiceTests(TestCase):
    def test_attendance_streak_counts_consecutive_dates_and_stops_at_a_gap(self):
        student = Student.objects.create(first_name='Kai', last_name='Sato', gender='Male')
        session = Session.objects.create(
            date='2025-06-10',
            start_time='09:00',
            end_time='10:00',
            venue='Dojo',
            session_type='regular',
        )
        for attendance_date in ('2025-06-10', '2025-06-09', '2025-06-08', '2025-06-06'):
            Attendance.objects.create(
                student=student,
                session=session,
                date=attendance_date,
                time_in=datetime.time(9, 0),
            )

        with patch(
            'apps.students.performance.services.timezone.now',
            return_value=datetime.datetime(2025, 6, 10, 12, tzinfo=datetime.timezone.utc),
        ):
            metrics = GamificationService._build_student_metrics(student)

        self.assertEqual(metrics['attendance_total'], 4)
        self.assertEqual(metrics['streak_days'], 3)
        self.assertEqual(metrics['last_activity_date'], '2025-06-10')

    def test_sparring_serializer_calculates_match_metrics_without_database_columns(self):
        student_a = Student.objects.create(
            first_name='Ari',
            last_name='Tan',
            gender='Male',
            current_belt_rank='White Belt',
        )
        student_b = Student.objects.create(
            first_name='Bea',
            last_name='Lim',
            gender='Female',
            current_belt_rank='Yellow Belt',
        )
        PersonalInfo.objects.create(
            student=student_a,
            birth_date=datetime.date(2000, 5, 1),
            height=170,
            weight=65,
        )
        PersonalInfo.objects.create(
            student=student_b,
            birth_date=datetime.date(2002, 5, 1),
            height=180,
            weight=75,
        )
        match = SparringMatch.objects.create(
            student_a=student_a,
            student_b=student_b,
            match_date=datetime.date(2026, 10, 31),
        )

        data = SparringMatchSerializer(match).data

        self.assertEqual(data['height_diff'], 10)
        self.assertEqual(data['weight_diff'], 10)
        self.assertEqual(data['age_diff'], 2)
        self.assertEqual(data['belt_diff'], 1)
        self.assertFalse(data['same_sex'])

    def test_leaderboard_ranks_by_earned_badges_and_includes_students_with_zero(self):
        first = Student.objects.create(first_name='Ari', last_name='Tan', gender='Male')
        second = Student.objects.create(first_name='Bea', last_name='Lim', gender='Female')
        third = Student.objects.create(first_name='Cal', last_name='Rey', gender='Male')
        badges = [
            BadgeDefinition.objects.create(
                name=f'Badge {index}',
                slug=f'badge-{index}',
                criteria_type='attendance',
                threshold=1,
            )
            for index in range(2)
        ]
        StudentBadge.objects.create(student=first, badge=badges[0], earned_at='2025-06-10')
        StudentBadge.objects.create(student=first, badge=badges[1], earned_at='2025-06-10')
        StudentBadge.objects.create(student=second, badge=badges[0], earned_at='2025-06-10')
        StudentBadge.objects.create(student=third, badge=badges[0])

        leaderboard = GamificationService.get_leaderboard()

        self.assertEqual(
            [(entry['student_id'], entry['badge_count']) for entry in leaderboard],
            [(first.student_id, 2), (second.student_id, 1), (third.student_id, 0)],
        )

    def test_monthly_leaderboard_uses_badges_earned_this_month(self):
        first = Student.objects.create(first_name='Ari', last_name='Tan', gender='Male')
        second = Student.objects.create(first_name='Bea', last_name='Lim', gender='Female')
        monthly_badges = [
            BadgeDefinition.objects.create(
                name=f'Monthly Badge {index}',
                slug=f'monthly-badge-{index}',
                criteria_type='attendance',
                threshold=1,
            )
            for index in range(2)
        ]
        old_badge = BadgeDefinition.objects.create(
            name='Previous Badge',
            slug='previous-badge',
            criteria_type='attendance',
            threshold=1,
        )
        inactive_badge = BadgeDefinition.objects.create(
            name='Inactive Badge',
            slug='inactive-badge',
            criteria_type='attendance',
            threshold=1,
            active=False,
        )
        StudentBadge.objects.create(student=first, badge=old_badge, earned_at='2025-05-30')
        StudentBadge.objects.create(student=first, badge=monthly_badges[0], earned_at='2025-06-02')
        StudentBadge.objects.create(student=first, badge=monthly_badges[1], earned_at='2025-06-12')
        StudentBadge.objects.create(student=first, badge=inactive_badge, earned_at='2025-06-13')
        StudentBadge.objects.create(student=second, badge=monthly_badges[0], earned_at='2025-06-05')

        with patch(
            'apps.students.performance.services.timezone.localdate',
            return_value=datetime.date(2025, 6, 15),
        ):
            leaderboard = GamificationService.get_monthly_leaderboard()

        self.assertEqual(
            [
                (
                    entry['student_id'],
                    entry['previous_badge_count'],
                    entry['badge_count'],
                    entry['monthly_badge_count'],
                )
                for entry in leaderboard
            ],
            [(first.student_id, 1, 3, 2), (second.student_id, 0, 1, 1)],
        )


class StudentPerformanceDashboardTests(TestCase):
    def test_dashboard_excludes_pre_promotion_scores_and_summaries(self):
        admin = get_user_model().objects.create_user(
            username='new-belt-dashboard-admin',
            email='new-belt-dashboard-admin@example.com',
            password='password123',
            role='admin',
        )
        student = Student.objects.create(
            first_name='Mika',
            last_name='Ito',
            gender='Female',
            current_belt_rank='Yellow Belt',
        )
        today = timezone.localdate()
        promotion_date = today - datetime.timedelta(days=2)
        archive = BeltProgressionArchive.objects.create(
            student=student,
            archived_belt='White Belt',
        )
        BeltProgressionArchive.objects.filter(pk=archive.pk).update(
            promotion_date=promotion_date,
        )
        KataRating.objects.create(
            student=student,
            pose_evaluation_avg=90,
            instructor_kata_score=85,
            combined_kata_score=87.5,
            date_recorded=promotion_date - datetime.timedelta(days=1),
        )
        PerformanceSummary.objects.create(
            student=student,
            period='monthly',
            start_date=promotion_date - datetime.timedelta(days=30),
            end_date=promotion_date,
            overall_average=90,
        )
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.get(
            f'/api/students/students/{student.student_id}/performance-dashboard/',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['kata_rating']['combined_kata_score'], 0)
        self.assertIsNone(response.data['performance_summary'])

    def test_dashboard_sparring_record_counts_completed_matches_in_current_belt(self):
        admin = get_user_model().objects.create_user(
            username='belt-record-admin',
            email='belt-record-admin@example.com',
            password='password123',
            role='admin',
        )
        student = Student.objects.create(first_name='Mika', last_name='Ito', gender='Female')
        opponent = Student.objects.create(first_name='Ren', last_name='Kato', gender='Male')
        archive = BeltProgressionArchive.objects.create(
            student=student,
            archived_belt='White Belt',
        )
        BeltProgressionArchive.objects.filter(pk=archive.pk).update(
            promotion_date=datetime.date(2025, 6, 1),
        )
        SparringMatch.objects.create(
            student_a=student,
            student_b=opponent,
            match_date='2025-05-31',
            status='completed',
            score_a=3,
            score_b=1,
        )
        SparringMatch.objects.create(
            student_a=student,
            student_b=opponent,
            match_date='2025-06-02',
            status='completed',
            score_a=3,
            score_b=1,
        )
        SparringMatch.objects.create(
            student_a=opponent,
            student_b=student,
            match_date='2025-06-03',
            status='completed',
            score_a=2,
            score_b=1,
        )
        SparringMatch.objects.create(
            student_a=student,
            student_b=opponent,
            match_date='2025-06-04',
            status='completed',
            score_a=2,
            score_b=2,
        )
        SparringMatch.objects.create(
            student_a=student,
            student_b=opponent,
            match_date='2025-06-05',
            status='scheduled',
            score_a=3,
            score_b=1,
        )
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.get(f'/api/students/students/{student.student_id}/performance-dashboard/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data['current_belt_sparring_record'],
            {'match_average': 2.0, 'wins': 1, 'losses': 1},
        )

    def test_performance_dashboard_returns_only_completed_matches_for_student(self):
        admin = get_user_model().objects.create_user(
            username='dashboard-admin',
            email='dashboard-admin@example.com',
            password='password123',
            role='admin',
        )
        student = Student.objects.create(first_name='Mika', last_name='Ito', gender='Female')
        opponent = Student.objects.create(first_name='Ren', last_name='Kato', gender='Male')
        other_student = Student.objects.create(first_name='Aki', last_name='Sato', gender='Male')
        completed_match = SparringMatch.objects.create(
            student_a=student,
            student_b=opponent,
            match_date='2025-06-10',
            status='completed',
            score_a=3,
            score_b=1,
        )
        SparringMatch.objects.create(
            student_a=student,
            student_b=opponent,
            match_date='2025-06-11',
            status='scheduled',
        )
        SparringMatch.objects.create(
            student_a=other_student,
            student_b=opponent,
            match_date='2025-06-12',
            status='completed',
        )
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.get(f'/api/students/students/{student.student_id}/performance-dashboard/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [match['match_id'] for match in response.data['sparring_matches']],
            [completed_match.match_id],
        )
