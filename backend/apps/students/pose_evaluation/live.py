import logging
import threading
from typing import Any, Dict

import cv2
import numpy as np
from django.core.files.uploadedfile import UploadedFile
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .service import PoseEvaluationService, get_pose_evaluation_service

logger = logging.getLogger(__name__)
MAX_FRAME_SIZE = 5 * 1024 * 1024
MAX_FRAME_PIXELS = 3_145_728

_service_lock = threading.RLock()


def get_live_pose_service() -> PoseEvaluationService:
    return get_pose_evaluation_service()


def process_live_pose_frame(frame_bytes: bytes) -> Dict[str, Any]:
    if not frame_bytes:
        raise ValueError('A camera frame is required.')
    if len(frame_bytes) > MAX_FRAME_SIZE:
        raise ValueError('Camera frame must be 5 MB or smaller.')

    image = cv2.imdecode(np.frombuffer(frame_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError('Camera frame must be a valid image.')
    height, width = image.shape[:2]
    if width * height > MAX_FRAME_PIXELS:
        raise ValueError('Camera frame dimensions are too large.')

    with _service_lock:
        service = get_live_pose_service()
        if not service.supports_pose():
            detail = service.pose_init_error or 'Pose detection is unavailable on the server.'
            raise RuntimeError(detail)

        landmarks = service.extract_pose_landmarks(image)
        if not landmarks:
            return {
                'has_pose': False,
                'landmarks': [],
                'stance_type': None,
                'confidence': 0,
            }

        stance_type, confidence, reference_match = service.classify_landmarks_with_reference(landmarks)

        return {
            'has_pose': True,
            'landmarks': landmarks,
            'stance_type': stance_type,
            'confidence': confidence,
            'reference_match': reference_match,
        }


class LivePoseFrameView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if getattr(request.user, 'role', None) not in {'admin', 'instructor'}:
            return Response(
                {'detail': 'Only instructors can use live pose evaluation.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        frame = request.FILES.get('frame')
        if not isinstance(frame, UploadedFile):
            return Response(
                {'detail': 'Camera frame is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if frame.size > MAX_FRAME_SIZE:
            return Response(
                {'detail': 'Camera frame must be 5 MB or smaller.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = process_live_pose_frame(frame.read())
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.exception('Live pose frame analysis failed.')
            return Response(
                {'detail': f'Live pose analysis failed: {exc}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(result, status=status.HTTP_200_OK)
