from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    AnalyticsOverviewView,
    AttendanceRiskView,
    AttendanceViewSet,
    BeltProgressionArchiveViewSet,
    BeltProgressionIndicatorViewSet,
    CartViewSet,
    FacialRecognitionViewSet,
    InstructorRatingViewSet,
    InventoryViewSet,
    KataRatingViewSet,
    KumiteRatingViewSet,
    NotificationViewSet,
    OrderViewSet,
    ParentStudentViewSet,
    PerformanceSummaryViewSet,
    PoseTemplateViewSet,
    ProductViewSet,
    ReportsDataView,
    SessionViewSet,
    SparringMatchViewSet,
    StanceEvaluationViewSet,
    StudentRegistrationView,
    StudentViewSet,
    SystemIDViewSet,
    VerifySystemIDView,
)
from .pose_evaluation.live import LivePoseFrameView

router = DefaultRouter()
router.register(r'students', StudentViewSet)
router.register(r'sessions', SessionViewSet)
router.register(r'attendances', AttendanceViewSet)
router.register(r'stance-evaluations', StanceEvaluationViewSet)
router.register(r'pose-templates', PoseTemplateViewSet)
router.register(r'instructor-ratings', InstructorRatingViewSet)
router.register(r'kata-ratings', KataRatingViewSet)
router.register(r'kumite-ratings', KumiteRatingViewSet)
router.register(r'performance-summaries', PerformanceSummaryViewSet)
router.register(
    r'belt-progression-indicators',
    BeltProgressionIndicatorViewSet,
    basename='belt-progression-indicator',
)
router.register(r'belt-progression-archives', BeltProgressionArchiveViewSet)
router.register(r'sparring-matches', SparringMatchViewSet)
router.register(r'inventories', InventoryViewSet)
router.register(r'notifications', NotificationViewSet)
router.register(r'parent-students', ParentStudentViewSet)
router.register(r'system-ids', SystemIDViewSet)
router.register(r'facial-recognition', FacialRecognitionViewSet, basename='facial-recognition')
# E-Commerce routes
router.register(r'products', ProductViewSet, basename='product')
router.register(r'cart', CartViewSet, basename='cart')
router.register(r'orders', OrderViewSet, basename='order')

urlpatterns = [
    path('register/', StudentRegistrationView.as_view(), name='student-register'),
    path('verify-id/', VerifySystemIDView.as_view(), name='verify-system-id'),
    path('analytics/overview/', AnalyticsOverviewView.as_view(), name='analytics-overview'),
    path('analytics/attendance-risk/', AttendanceRiskView.as_view(), name='analytics-attendance-risk'),
    path('analytics/reports/', ReportsDataView.as_view(), name='analytics-reports'),
    path('pose-evaluation/live-frame/', LivePoseFrameView.as_view(), name='live-pose-frame'),
    path('', include(router.urls)),
]
