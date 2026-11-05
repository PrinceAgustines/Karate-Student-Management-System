from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve


def serve_media_file(request, path):
    return serve(request, path, document_root=settings.MEDIA_ROOT)


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('apps.users.urls')),
    path('api/students/', include('apps.students.urls')),
]

urlpatterns += [
    re_path(
        r'^media/(?P<path>inventory_images/.*)$',
        serve_media_file,
    ),
    re_path(
        r'^media/(?P<path>student_photos/.*)$',
        serve_media_file,
    ),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
