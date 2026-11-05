from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    AdminDashboardSummaryView,
    BugReportCollectionView,
    BugReportDetailView,
    CustomTokenObtainPairView,
    MeView,
    ParentTokenObtainView,
    RegisterView,
    UserPresenceHeartbeatView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('parent-login/', ParentTokenObtainView.as_view(), name='parent_token_obtain_pair'),
    path('admin-dashboard-summary/', AdminDashboardSummaryView.as_view(), name='admin_dashboard_summary'),
    path('presence/heartbeat/', UserPresenceHeartbeatView.as_view(), name='user_presence_heartbeat'),
    path('bug-reports/', BugReportCollectionView.as_view(), name='bug_report_collection'),
    path('bug-reports/<int:pk>/', BugReportDetailView.as_view(), name='bug_report_detail'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
]
