import logging
import os
import sys
import tempfile
import threading
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from django.conf import settings
from django.core.files.base import ContentFile
from apps.students.models import PoseTemplate


class PoseEvaluationService:
    """MediaPipe-based pose evaluation with saved-reference matching."""

    REFERENCE_MATCH_THRESHOLD = 0.65

    def __init__(self):
        self.models_dir = os.path.join(settings.BASE_DIR, 'models')
        os.makedirs(self.models_dir, exist_ok=True)

        self.current_python = sys.executable
        self.mp = None
        self.mp_tasks = None
        self.mp_vision = None
        self.mp_image = None
        self.pose = None
        self.pose_source = None
        self.pose_init_error = None
        self._reference_landmarks_cache: Dict[int, Optional[List[Dict[str, float]]]] = {}
        self.use_mediapipe = False
        self.pose_model_path = os.path.join(self.models_dir, 'pose_landmarker.task')
        self._libraries_initialized = False
        self._initialization_lock = threading.Lock()
        self._inference_lock = threading.RLock()

    def _download_pose_model(self):
        model_url = (
            'https://storage.googleapis.com/mediapipe-models/'
            'pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task'
        )
        os.makedirs(self.models_dir, exist_ok=True)
        try:
            with urllib.request.urlopen(model_url) as response:
                model_data = response.read()
            with open(self.pose_model_path, 'wb') as f:
                f.write(model_data)
        except Exception as exc:
            raise RuntimeError(f'Could not download Pose Landmarker model: {exc}')

    def _find_venv_tf_hint(self) -> Optional[str]:
        venv_tf_python = Path(settings.BASE_DIR) / '.venv-tf' / 'Scripts' / 'python.exe'
        if venv_tf_python.exists() and str(venv_tf_python) != self.current_python:
            return (
                f"The current Python interpreter is {self.current_python}. "
                f"MediaPipe is available when you run with {venv_tf_python}. "
                "Activate backend/.venv-tf or run the server with that interpreter."
            )
        return None

    def _initialize_libraries(self):
        logger = logging.getLogger(__name__)
        try:
            import mediapipe as mp
            self.mp = mp
        except Exception as exc:
            hint = self._find_venv_tf_hint() or ''
            self.pose_init_error = (
                f'MediaPipe import failed: {exc}. {hint}'.strip()
            )
            logger.error(self.pose_init_error)
            self.use_mediapipe = False
            self.mp = None
        else:
            try:
                from mediapipe.tasks import python
                from mediapipe.tasks.python import vision
                from mediapipe.tasks.python.vision.core import image as mp_image_module

                self.mp_tasks = python
                self.mp_vision = vision
                self.mp_image = mp_image_module

                if not os.path.exists(self.pose_model_path):
                    self._download_pose_model()

                base_options = self.mp_tasks.BaseOptions(model_asset_path=self.pose_model_path)
                pose_options = self.mp_vision.PoseLandmarkerOptions(
                    base_options=base_options,
                    running_mode=self.mp_vision.RunningMode.IMAGE,
                )
                self.pose = self.mp_vision.PoseLandmarker.create_from_options(pose_options)
                self.pose_source = 'tasks'
                self.use_mediapipe = True
            except Exception as exc_task:
                logger.warning('MediaPipe Tasks initialization failed: %s', exc_task)
                try:
                    self.pose = self.mp.solutions.pose.Pose(
                        static_image_mode=True,
                        min_detection_confidence=0.5,
                        model_complexity=1,
                    )
                    self.pose_source = 'solutions'
                    self.use_mediapipe = True
                except Exception as exc_legacy:
                    self.pose_init_error = (
                        f'MediaPipe Tasks init failed: {exc_task}; '
                        f'legacy Pose init failed: {exc_legacy}'
                    )
                    logger.error(self.pose_init_error)
                    self.use_mediapipe = False

    def supports_pose(self) -> bool:
        if not getattr(self, '_libraries_initialized', True):
            with self._initialization_lock:
                if not self._libraries_initialized:
                    self._initialize_libraries()
                    self._libraries_initialized = True
        return self.use_mediapipe and self.pose is not None

    @staticmethod
    def _build_detected_stances_from_frame_results(frame_results: List[Dict[str, Any]], total_frames: Optional[int] = None) -> List[Dict[str, Any]]:
        if not frame_results:
            return []

        total_frames = total_frames if total_frames is not None else len(frame_results)
        segments: List[Dict[str, Any]] = []
        current_stance: Optional[str] = None
        current_frames: List[Dict[str, Any]] = []

        for result in frame_results:
            stance = result.get('stance_type')
            if current_stance is None:
                current_stance = stance
                current_frames = [result]
                continue

            if stance == current_stance:
                current_frames.append(result)
                continue

            segments.append({
                'stance_type': current_stance,
                'score': int(min(100, max(0, round(sum(frame['confidence'] for frame in current_frames) / len(current_frames) * 100)))),
                'confidence': float(round(sum(frame['confidence'] for frame in current_frames) / len(current_frames), 2)),
                'first_frame': min(frame['frame_index'] for frame in current_frames),
                'frame_count': len(current_frames),
                'duration_ratio': len(current_frames) / total_frames,
            })
            current_stance = stance
            current_frames = [result]

        if current_stance is not None:
            segments.append({
                'stance_type': current_stance,
                'score': int(min(100, max(0, round(sum(frame['confidence'] for frame in current_frames) / len(current_frames) * 100)))),
                'confidence': float(round(sum(frame['confidence'] for frame in current_frames) / len(current_frames), 2)),
                'first_frame': min(frame['frame_index'] for frame in current_frames),
                'frame_count': len(current_frames),
                'duration_ratio': len(current_frames) / total_frames,
            })

        return sorted(segments, key=lambda item: item['first_frame'])

    def _rgb_image(self, image: np.ndarray) -> np.ndarray:
        if image.ndim == 3 and image.shape[2] == 3:
            return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        if image.ndim == 3 and image.shape[2] == 4:
            return cv2.cvtColor(image, cv2.COLOR_BGRA2RGB)
        return image

    def extract_pose_landmarks(self, image: np.ndarray) -> Optional[List[Dict[str, float]]]:
        if not self.supports_pose():
            return None

        inference_lock = getattr(self, '_inference_lock', None)
        if inference_lock is None:
            return self._extract_pose_landmarks(image)
        with inference_lock:
            return self._extract_pose_landmarks(image)

    def _extract_pose_landmarks(self, image: np.ndarray) -> Optional[List[Dict[str, float]]]:
        image_rgb = self._rgb_image(image)
        return self._extract_landmarks_from_image(image_rgb)

    def _extract_landmarks_from_image(self, image_rgb: np.ndarray) -> Optional[List[Dict[str, float]]]:
        """Extract landmarks from a pre-processed RGB image without additional cropping."""
        if not self.supports_pose():
            return None

        try:
            if self.pose_source == 'tasks' and self.mp_image is not None:
                mp_image = self.mp_image.Image(
                    self.mp_image.ImageFormat.SRGB,
                    image_rgb,
                )
                results = self.pose.detect(mp_image)
                pose_landmarks = getattr(results, 'pose_landmarks', None)
            else:
                results = self.pose.process(image_rgb)
                pose_landmarks = getattr(results, 'pose_landmarks', None)
        except Exception:
            return None

        landmarks = []
        if pose_landmarks:
            if isinstance(pose_landmarks, list):
                landmark_collections = pose_landmarks
            else:
                landmark_collections = [pose_landmarks]

            for pose_landmark_list in landmark_collections:
                landmark_items = getattr(pose_landmark_list, 'landmark', None) or pose_landmark_list
                for landmark in landmark_items:
                    landmarks.append({
                        'x': float(getattr(landmark, 'x', 0.0)),
                        'y': float(getattr(landmark, 'y', 0.0)),
                        'z': float(getattr(landmark, 'z', 0.0)),
                        'visibility': float(getattr(landmark, 'visibility', 0.0)),
                    })
        return landmarks if landmarks else None

    def calculate_similarity(self, landmarks1: List[Dict[str, float]], landmarks2: List[Dict[str, float]]) -> Tuple[float, float]:
        pose1 = self._normalize_landmarks(landmarks1)
        pose2 = self._normalize_landmarks(landmarks2)
        if pose1.shape != pose2.shape or pose1.size == 0:
            raise ValueError('Pose landmarks must have matching, non-empty shapes.')

        flat1 = pose1[:, :3].flatten()
        flat2 = pose2[:, :3].flatten()
        dot = np.dot(flat1, flat2)
        norm1 = np.linalg.norm(flat1)
        norm2 = np.linalg.norm(flat2)
        cosine_sim = float(np.clip(dot / (norm1 * norm2 + 1e-6), -1.0, 1.0))

        vis1 = pose1[:, 3]
        vis2 = pose2[:, 3]
        weights = (vis1 + vis2) / 2
        diff = np.abs(pose1[:, :3] - pose2[:, :3])
        weighted_diff = np.sum(weights[:, None] * diff) / (np.sum(weights) + 1e-6)
        weighted_sim = float(1 / (1 + weighted_diff))

        return cosine_sim, weighted_sim

    @staticmethod
    def _normalize_landmarks(landmarks: List[Dict[str, float]]) -> np.ndarray:
        pose = np.array(
            [
                [
                    float(landmark['x']),
                    float(landmark['y']),
                    float(landmark.get('z', 0.0)),
                    float(landmark.get('visibility', 0.0)),
                ]
                for landmark in landmarks
            ],
            dtype=np.float32,
        )
        if pose.shape[0] < 33:
            raise ValueError('Pose landmarks must include all 33 body points.')

        hip_center = (pose[23, :3] + pose[24, :3]) / 2
        shoulder_center = (pose[11, :3] + pose[12, :3]) / 2
        torso_scale = float(np.linalg.norm(shoulder_center[:2] - hip_center[:2]))
        if torso_scale <= 1e-6:
            torso_scale = float(np.linalg.norm(pose[11, :2] - pose[12, :2]))
        if torso_scale <= 1e-6:
            raise ValueError('Pose landmarks do not have a usable body scale.')

        pose[:, :3] = (pose[:, :3] - hip_center) / torso_scale
        pose[:, 3] = np.clip(pose[:, 3], 0.0, 1.0)
        return pose

    def get_template_classification(
        self,
        landmarks: List[Dict[str, float]],
    ) -> Optional[Tuple[int, str, float]]:
        templates = list(PoseTemplate.objects.order_by('-created_at'))
        if not templates:
            return None

        best_match = None
        best_sim = float('-inf')

        for template in templates:
            try:
                template_landmarks = self._get_template_landmarks(template)
                if not template_landmarks:
                    continue
                cosine_sim, weighted_sim = self.calculate_similarity(landmarks, template_landmarks)
                sim = (cosine_sim + weighted_sim) / 2
                if sim > best_sim:
                    best_sim = sim
                    best_match = template
            except (KeyError, TypeError, ValueError, IndexError):
                continue

        if best_match is None:
            return None

        return best_match.id, best_match.stance_label, float(best_sim)

    def _get_template_landmarks(
        self,
        template: PoseTemplate,
    ) -> Optional[List[Dict[str, float]]]:
        if isinstance(template.landmarks, list) and template.landmarks:
            return template.landmarks

        cache = getattr(self, '_reference_landmarks_cache', None)
        if cache is None:
            cache = {}
            self._reference_landmarks_cache = cache
        if template.pk in cache:
            return cache[template.pk]
        if not template.media_file:
            cache[template.pk] = None
            return None

        try:
            with template.media_file.open('rb') as reference_file:
                image_bytes = reference_file.read()
            image = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
            if image is None or image.size == 0:
                raise ValueError('Saved pose reference is not a valid image.')
            reference_landmarks = self.extract_pose_landmarks(image)
        except (OSError, cv2.error, ValueError) as exc:
            logging.getLogger(__name__).warning(
                'Could not extract landmarks from saved pose template %s: %s',
                template.pk,
                exc,
            )
            reference_landmarks = None

        cache[template.pk] = reference_landmarks
        return reference_landmarks

    def classify_landmarks_with_reference(
        self,
        landmarks: List[Dict[str, float]],
    ) -> Tuple[str, float, Optional[Dict[str, Any]]]:
        classification = self.get_template_classification(landmarks)
        if classification is None:
            return 'Unknown Stance', 0.0, None

        template_id, stance_label, confidence = classification
        reference_match = {
            'matched': confidence >= self.REFERENCE_MATCH_THRESHOLD,
            'template_id': template_id,
            'stance_label': stance_label,
            'similarity': round(confidence, 4),
            'threshold': self.REFERENCE_MATCH_THRESHOLD,
        }
        if not reference_match['matched']:
            return 'Unknown Stance', confidence, reference_match

        return stance_label, confidence, reference_match

    def parse_uploaded_image(self, uploaded_file) -> Optional[np.ndarray]:
        raw_bytes = uploaded_file.read()
        arr = np.frombuffer(raw_bytes, np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return image

    def create_pose_template(self, uploaded_file, stance_label: str, uploaded_by=None) -> Dict[str, Any]:
        if stance_label not in PoseTemplate.SUPPORTED_POSE_LABELS:
            raise ValueError('Select a supported stance or technique label.')

        original_filename = getattr(uploaded_file, 'name', None) or 'reference image'
        original_extension = os.path.splitext(original_filename)[1].lower()
        if original_extension not in {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}:
            raise ValueError('Upload a JPG, PNG, WEBP, or BMP reference image.')

        media_bytes = uploaded_file.read()
        if not media_bytes:
            raise ValueError('Reference image is empty.')
        if len(media_bytes) > 20 * 1024 * 1024:
            raise ValueError('Reference image must be 20 MB or smaller.')

        try:
            image = self.parse_uploaded_image(ContentFile(media_bytes))
        except cv2.error as exc:
            raise ValueError(f'Could not read reference image {original_filename}: {exc}') from exc
        if image is None or image.size == 0:
            raise ValueError(f'Could not read reference image {original_filename}. Ensure it is a valid image.')

        template = PoseTemplate(
            stance_label=stance_label,
            uploaded_by=uploaded_by,
        )
        template.media_file.save(os.path.basename(original_filename), ContentFile(media_bytes), save=False)
        try:
            template.save()
        except Exception:
            template.media_file.delete(save=False)
            raise

        logging.getLogger(__name__).info(
            'Saved pose reference %s for template %s',
            template.media_file.name,
            template.pk,
        )
        return {
            'id': template.id,
            'stance_label': template.stance_label,
            'created_at': template.created_at.isoformat(),
            'media_file': template.media_file.url,
        }

    def analyze_pose_media(self, uploaded_file, student_id: int) -> Dict[str, Any]:
        if not self.supports_pose():
            message = 'Pose analysis is unavailable because MediaPipe failed to initialize.'
            if self.pose_init_error:
                message = f"{message} {self.pose_init_error}"
            raise ValueError(message)

        # Validate file size (max 500 MB)
        MAX_FILE_SIZE = 500 * 1024 * 1024
        raw_bytes = uploaded_file.read()
        if len(raw_bytes) > MAX_FILE_SIZE:
            raise ValueError('File size exceeds 500 MB limit.')
        if len(raw_bytes) == 0:
            raise ValueError('Uploaded file is empty.')

        # Get filename safely
        filename = getattr(uploaded_file, 'name', 'media_file')
        extension = os.path.splitext(filename)[1].lower() or '.mp4'
        is_video = extension in {'.mp4', '.mov', '.avi', '.mkv', '.webm'}

        frames = []
        temp_video_path = None

        try:
            if is_video:
                temp_video_path = tempfile.NamedTemporaryFile(delete=False, suffix=extension).name
                with open(temp_video_path, 'wb') as f:
                    f.write(raw_bytes)
                cap = cv2.VideoCapture(temp_video_path)
                if not cap.isOpened():
                    raise ValueError(f'Unable to open video file: {filename}')
                
                frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
                if frame_count == 0:
                    raise ValueError('Video file appears to be corrupted or empty.')
                
                fps = cap.get(cv2.CAP_PROP_FPS) or 1
                step = max(1, int(fps))
                
                index = 0
                while cap.isOpened() and len(frames) < 300:  # Limit to 300 frames max
                    ret, frame = cap.read()
                    if not ret:
                        break
                    if index % step == 0:
                        frames.append(frame)
                    index += 1
                cap.release()
            else:
                image = cv2.imdecode(np.frombuffer(raw_bytes, np.uint8), cv2.IMREAD_COLOR)
                if image is None:
                    raise ValueError(f'Unable to decode image file: {filename}. Ensure it is a valid image format.')
                if image.size == 0:
                    raise ValueError('Image file is corrupted or has invalid dimensions.')
                frames.append(image)

            if not frames:
                raise ValueError('Unable to parse the uploaded media for pose extraction.')

            frame_results = []
            for idx, frame in enumerate(frames):
                landmarks = self.extract_pose_landmarks(frame)
                if landmarks is None:
                    continue
                label, confidence, reference_match = self.classify_landmarks_with_reference(landmarks)
                frame_results.append({
                    'frame_index': idx,
                    'stance_type': label,
                    'confidence': float(round(confidence, 2)),
                    'timestamp': idx / (len(frames) - 1) if len(frames) > 1 else 0,
                    'reference_match': reference_match,
                })

            if not frame_results:
                raise ValueError('No valid pose landmarks were detected in the media.')

            detected_stances = self._build_detected_stances_from_frame_results(frame_results, len(frame_results))

            total_frames = len(frame_results)
            primary_stance = detected_stances[0]['stance_type'] if detected_stances else 'Unknown Stance'
            overall_score = detected_stances[0]['score'] if detected_stances else 0

            remarks = f"Analyzed {total_frames} frames across {len(detected_stances)} detected stance occurrence(s). Primary: {primary_stance}."

            analysis_details = {
                'detected_stances': detected_stances,
                'total_frames_analyzed': total_frames,
                'frames_with_pose': len(frame_results),
                'frame_results': frame_results,
                'reference_matches': [
                    frame['reference_match']
                    for frame in frame_results
                    if frame['reference_match'] and frame['reference_match']['matched']
                ],
                'evaluation_source': 'MediaPipe pose landmarks matched against saved pose references',
            }

            logging.info(f'Pose analysis completed for student {student_id}: {len(detected_stances)} stances, score {overall_score}')
            
            return {
                'student_id': student_id,
                'stance_type': primary_stance,
                'score': overall_score,
                'remarks': remarks,
                'analysis_details': analysis_details,
            }
        
        finally:
            # Cleanup temp video file
            if temp_video_path and os.path.exists(temp_video_path):
                try:
                    os.remove(temp_video_path)
                except OSError:
                    pass


_pose_service_lock = threading.Lock()
_pose_service: Optional[PoseEvaluationService] = None


def get_pose_evaluation_service() -> PoseEvaluationService:
    global _pose_service

    if _pose_service is None:
        with _pose_service_lock:
            if _pose_service is None:
                _pose_service = PoseEvaluationService()
    return _pose_service
