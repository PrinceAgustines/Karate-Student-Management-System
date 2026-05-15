import json
import logging
import math
import os
import sys
import tempfile
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from students.models import PoseTemplate


class PoseEvaluationService:
    """TensorFlow + MediaPipe pose evaluation service."""

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
        self.tf = None
        self.yolo = None
        self.use_mediapipe = False
        self.use_tensorflow = False
        self.use_yolo = False
        self.pose_model_path = os.path.join(self.models_dir, 'pose_landmarker.task')
        self._initialize_libraries()

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
            import tensorflow as tf  # type: ignore[import-not-found]
            self.tf = tf
            self.use_tensorflow = True
        except Exception as exc:
            logger.warning('TensorFlow import failed: %s', exc)
            self.use_tensorflow = False

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

        try:
            from ultralytics import YOLO  # type: ignore[import-not-found]
            self.yolo = YOLO('yolov8n.pt')
            self.use_yolo = True
        except Exception as exc:
            logger.warning('YOLO initialization failed: %s', exc)
            self.use_yolo = False

    def supports_pose(self) -> bool:
        return self.use_mediapipe and self.pose is not None

    def _crop_person(self, image: np.ndarray) -> np.ndarray:
        if not self.use_yolo or self.yolo is None:
            return image
        try:
            results = self.yolo(image, verbose=False)
            if results and len(results) > 0:
                boxes = results[0].boxes
                if len(boxes) > 0:
                    # Get the box with highest confidence for person (class 0)
                    person_boxes = [box for box in boxes if int(box.cls[0]) == 0]
                    if person_boxes:
                        box = max(person_boxes, key=lambda b: b.conf[0])
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
                        # Add some padding
                        h, w = image.shape[:2]
                        pad = 20
                        x1 = max(0, x1 - pad)
                        y1 = max(0, y1 - pad)
                        x2 = min(w, x2 + pad)
                        y2 = min(h, y2 + pad)
                        if x2 <= x1 or y2 <= y1:
                            return image
                        cropped = image[y1:y2, x1:x2]
                        if cropped.size == 0:
                            return image
                        return cropped
        except Exception:
            pass
        return image

    def _rgb_image(self, image: np.ndarray) -> np.ndarray:
        if image.ndim == 3 and image.shape[2] == 3:
            return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        if image.ndim == 3 and image.shape[2] == 4:
            return cv2.cvtColor(image, cv2.COLOR_BGRA2RGB)
        return image

    def extract_pose_landmarks(self, image: np.ndarray) -> Optional[List[Dict[str, float]]]:
        if not self.supports_pose():
            return None

        image_rgb = self._rgb_image(image)
        cropped = self._crop_person(image_rgb)

        for input_image in (cropped, image_rgb):
            try:
                if self.pose_source == 'tasks' and self.mp_image is not None:
                    mp_image = self.mp_image.Image(
                        self.mp_image.ImageFormat.SRGB,
                        input_image,
                    )
                    results = self.pose.detect(mp_image)
                    pose_landmarks = getattr(results, 'pose_landmarks', None)
                else:
                    results = self.pose.process(input_image)
                    pose_landmarks = getattr(results, 'pose_landmarks', None)
            except Exception:
                continue

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
            if landmarks:
                return landmarks

            if np.array_equal(input_image, image_rgb):
                break

        return None

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

    def _landmarks_to_vector(self, landmarks: List[Dict[str, float]]) -> np.ndarray:
        vector = []
        for landmark in landmarks:
            vector.extend([landmark['x'], landmark['y'], landmark['z'], landmark['visibility']])
        return np.array(vector, dtype=np.float32)

    def calculate_similarity(self, landmarks1: List[Dict[str, float]], landmarks2: List[Dict[str, float]]) -> Tuple[float, float]:
        pose1 = np.array([[lm['x'], lm['y'], lm['z'], lm['visibility']] for lm in landmarks1])
        pose2 = np.array([[lm['x'], lm['y'], lm['z'], lm['visibility']] for lm in landmarks2])

        # Cosine similarity
        flat1 = pose1.flatten()
        flat2 = pose2.flatten()
        dot = np.dot(flat1, flat2)
        norm1 = np.linalg.norm(flat1)
        norm2 = np.linalg.norm(flat2)
        cosine_sim = dot / (norm1 * norm2 + 1e-6)

        # Weighted similarity based on visibility
        vis1 = pose1[:, 3]
        vis2 = pose2[:, 3]
        weights = (vis1 + vis2) / 2
        diff = np.abs(pose1 - pose2)
        weighted_diff = np.sum(weights[:, None] * diff) / (np.sum(weights) + 1e-6)
        weighted_sim = 1 / (1 + weighted_diff)

        return cosine_sim, weighted_sim

    def _compute_angle(self, a: Tuple[float, float], b: Tuple[float, float], c: Tuple[float, float]) -> float:
        a = np.array(a)
        b = np.array(b)
        c = np.array(c)
        ba = a - b
        bc = c - b
        cosine = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
        return float(np.degrees(np.arccos(np.clip(cosine, -1.0, 1.0))))

    def extract_angle_features(self, landmarks: List[Dict[str, float]]) -> Dict[str, float]:
        def coord(index: int) -> Tuple[float, float]:
            point = landmarks[index]
            return point['x'], point['y']

        left_hip = coord(23)
        right_hip = coord(24)
        left_knee = coord(25)
        right_knee = coord(26)
        left_ankle = coord(27)
        right_ankle = coord(28)
        left_shoulder = coord(11)
        right_shoulder = coord(12)

        hip_width = abs(left_hip[0] - right_hip[0])
        shoulder_width = abs(left_shoulder[0] - right_shoulder[0])
        ankle_width = abs(left_ankle[0] - right_ankle[0])

        features = {
            'left_knee_angle': self._compute_angle(left_hip, left_knee, left_ankle),
            'right_knee_angle': self._compute_angle(right_hip, right_knee, right_ankle),
            'hip_width': hip_width,
            'shoulder_width': shoulder_width,
            'ankle_width': ankle_width,
            'stance_ratio': float(ankle_width / (shoulder_width + 1e-6)),
            'hip_alignment': abs(left_hip[1] - right_hip[1]),
            'shoulder_tilt': abs(left_shoulder[1] - right_shoulder[1]),
        }

    def extract_leg_features(self, landmarks: List[Dict[str, float]]) -> Dict[str, float]:
        def coord(index: int) -> Tuple[float, float, float]:
            point = landmarks[index]
            return point['x'], point['y'], point['z']

        left_hip = coord(23)
        right_hip = coord(24)
        left_knee = coord(25)
        right_knee = coord(26)
        left_ankle = coord(27)
        right_ankle = coord(28)

        return {
            'left_ankle_height': left_ankle[1],
            'right_ankle_height': right_ankle[1],
            'left_knee_height': left_knee[1],
            'right_knee_height': right_knee[1],
            'left_hip_height': left_hip[1],
            'right_hip_height': right_hip[1],
            'left_knee_raised': left_knee[1] < left_hip[1] - 0.08,
            'right_knee_raised': right_knee[1] < right_hip[1] - 0.08,
            'left_foot_forward': left_ankle[2] < left_hip[2] - 0.03,
            'right_foot_forward': right_ankle[2] < right_hip[2] - 0.03,
        }

    def extract_arm_features(self, landmarks: List[Dict[str, float]]) -> Dict[str, float]:
        def coord(index: int) -> Tuple[float, float, float]:
            point = landmarks[index]
            return point['x'], point['y'], point['z']

        left_shoulder = coord(11)
        right_shoulder = coord(12)
        left_elbow = coord(13)
        right_elbow = coord(14)
        left_wrist = coord(15)
        right_wrist = coord(16)
        left_hip = coord(23)
        right_hip = coord(24)

        left_elbow_angle = self._compute_angle(left_shoulder[:2], left_elbow[:2], left_wrist[:2])
        right_elbow_angle = self._compute_angle(right_shoulder[:2], right_elbow[:2], right_wrist[:2])

        left_arm_extended = abs(left_elbow_angle - 180) < 45
        right_arm_extended = abs(right_elbow_angle - 180) < 45

        left_arm_raised = left_wrist[1] < left_shoulder[1]
        right_arm_raised = right_wrist[1] < right_shoulder[1]

        shoulder_width = abs(left_shoulder[0] - right_shoulder[0])
        left_arm_forward = left_arm_extended and (
            left_wrist[2] < left_shoulder[2] - 0.03 or left_wrist[0] < left_shoulder[0] - shoulder_width * 0.1
        )
        right_arm_forward = right_arm_extended and (
            right_wrist[2] < right_shoulder[2] - 0.03 or right_wrist[0] > right_shoulder[0] + shoulder_width * 0.1
        )

        left_arm_punched = left_arm_extended and left_arm_forward
        right_arm_punched = right_arm_extended and right_arm_forward

        return {
            'left_elbow_angle': left_elbow_angle,
            'right_elbow_angle': right_elbow_angle,
            'left_arm_extended': left_arm_extended,
            'right_arm_extended': right_arm_extended,
            'left_arm_raised': left_arm_raised,
            'right_arm_raised': right_arm_raised,
            'left_wrist_height': left_wrist[1],
            'right_wrist_height': right_wrist[1],
            'left_shoulder_height': left_shoulder[1],
            'right_shoulder_height': right_shoulder[1],
            'left_hip_height': left_hip[1],
            'right_hip_height': right_hip[1],
            'left_wrist_z': left_wrist[2],
            'right_wrist_z': right_wrist[2],
            'left_shoulder_z': left_shoulder[2],
            'right_shoulder_z': right_shoulder[2],
            'left_wrist_offset_x': left_wrist[0] - left_shoulder[0],
            'right_wrist_offset_x': right_wrist[0] - right_shoulder[0],
            'left_arm_punched': left_arm_punched,
            'right_arm_punched': right_arm_punched,
        }

    def get_template_classification(self, landmarks: List[Dict[str, float]]) -> Optional[Tuple[str, float]]:
        templates = list(PoseTemplate.objects.exclude(landmarks__isnull=True).exclude(landmarks__exact=[]))
        if not templates:
            return None

        best_match = None
        best_sim = 0.0

        for template in templates:
            try:
                template_landmarks = template.landmarks  # list of dicts
                cosine_sim, weighted_sim = self.calculate_similarity(landmarks, template_landmarks)
                sim = (cosine_sim + weighted_sim) / 2  # average of both similarities
                if sim > best_sim:
                    best_sim = sim
                    best_match = template
            except Exception:
                continue

        if best_match is None:
            return None

        # Return the best match with its actual similarity score
        # The calling function will decide if it's good enough
        return best_match.stance_label, best_sim

    def improved_heuristic_classify(self, landmarks: List[Dict[str, float]]) -> Tuple[str, float]:
        logger = logging.getLogger(__name__)
        features = self.extract_angle_features(landmarks)
        arm_features = self.extract_arm_features(landmarks)
        leg_features = self.extract_leg_features(landmarks)

        shoulder_width = features['shoulder_width']
        left_outside_block = arm_features['left_wrist_offset_x'] < -0.1 * shoulder_width
        right_outside_block = arm_features['right_wrist_offset_x'] > 0.1 * shoulder_width

        # Detect low block first
        if (arm_features['left_arm_extended'] and arm_features['left_wrist_height'] > arm_features['left_hip_height'] + 0.02) or \
           (arm_features['right_arm_extended'] and arm_features['right_wrist_height'] > arm_features['right_hip_height'] + 0.02):
            logger.debug('Heuristic: Gedan-barai matched')
            return 'Gedan-barai / Downward block', 0.75

        # Detect rising block
        if (arm_features['left_arm_extended'] and arm_features['left_arm_raised'] and 40 < arm_features['left_elbow_angle'] < 140) or \
           (arm_features['right_arm_extended'] and arm_features['right_arm_raised'] and 40 < arm_features['right_elbow_angle'] < 140):
            logger.debug('Heuristic: Age-uke matched')
            return 'Age-uke / Rising block', 0.75

        # Detect outside-to-inside block
        if (arm_features['left_arm_extended'] and abs(arm_features['left_elbow_angle'] - 90) < 35 and left_outside_block) or \
           (arm_features['right_arm_extended'] and abs(arm_features['right_elbow_angle'] - 90) < 35 and right_outside_block):
            logger.debug('Heuristic: Soto-uke matched')
            return 'Soto-uke / Outside-to-inside block', 0.70

        # Detect inside-to-outside block
        if (arm_features['left_arm_extended'] and abs(arm_features['left_elbow_angle'] - 90) < 35 and not left_outside_block) or \
           (arm_features['right_arm_extended'] and abs(arm_features['right_elbow_angle'] - 90) < 35 and not right_outside_block):
            logger.debug('Heuristic: Uchi-uke matched')
            return 'Uchi-uke / Inside-to-outside block', 0.70

        # Detect two-hand block
        if arm_features['left_arm_extended'] and arm_features['right_arm_extended'] and \
           abs(arm_features['left_wrist_height'] - arm_features['right_wrist_height']) < 0.12 and \
           not arm_features['left_arm_punched'] and not arm_features['right_arm_punched']:
            logger.debug('Heuristic: Morote-uke matched')
            return 'Morote-uke / Augmented/two-hand block', 0.70

        # Detect knife hand block or strike
        if (arm_features['left_arm_extended'] and abs(arm_features['left_wrist_height'] - arm_features['left_shoulder_height']) < 0.12) or \
           (arm_features['right_arm_extended'] and abs(arm_features['right_wrist_height'] - arm_features['right_shoulder_height']) < 0.12):
            logger.debug('Heuristic: Shuto-uke matched')
            return 'Shuto-uke / Knife hand block', 0.68

        # Detect strikes or punches
        if arm_features['left_arm_punched'] or arm_features['right_arm_punched']:
            if features['stance_ratio'] >= 1.2:
                logger.debug('Heuristic: Oi-zuki matched')
                return 'Oi-zuki / Lunge punch', 0.72
            logger.debug('Heuristic: Choku-zuki matched')
            return 'Choku-zuki / Straight punch', 0.68

        # Detect kicks
        if leg_features['left_knee_raised'] or leg_features['right_knee_raised'] or \
           leg_features['left_foot_forward'] or leg_features['right_foot_forward']:
            if features['stance_ratio'] < 0.8:
                logger.debug('Heuristic: Mae-geri matched')
                return 'Mae-geri / Front kick', 0.65
            logger.debug('Heuristic: Mawashi-geri matched')
            return 'Mawashi-geri / Roundhouse kick', 0.65

        is_kiba = (
            features['stance_ratio'] >= 1.35 and
            140 < features['left_knee_angle'] < 170 and
            140 < features['right_knee_angle'] < 170 and
            abs(features['hip_alignment']) < 0.12 and
            abs(features['shoulder_tilt']) < 0.12 and
            not arm_features['left_arm_punched'] and
            not arm_features['right_arm_punched'] and
            not arm_features['left_arm_raised'] and
            not arm_features['right_arm_raised'] and
            not left_outside_block and
            not right_outside_block
        )
        if is_kiba:
            logger.debug('Heuristic: Kiba-dachi matched')
            return 'Kiba-dachi / Horse riding stance', 0.85

        if features['stance_ratio'] < 0.22 and abs(features['hip_alignment']) < 0.05:
            logger.debug('Heuristic: Heisoku-dachi matched')
            return 'Heisoku-dachi / Formal attention stance', 0.80

        if 0.25 <= features['stance_ratio'] < 0.75 and features['left_knee_angle'] > 135 and features['right_knee_angle'] > 135:
            logger.debug('Heuristic: Sanchin-dachi matched')
            return 'Sanchin-dachi / Hourglass/three-point stance', 0.75

        if 0.3 <= features['stance_ratio'] < 1.1 and (
            features['left_knee_angle'] < 150 or features['right_knee_angle'] < 150
        ):
            logger.debug('Heuristic: Nekoashi-dachi matched')
            return 'Nekoashi-dachi / Cat stance', 0.70

        logger.debug('Heuristic: Unknown Technique')
        return 'Unknown Technique', 0.30

    def classify_landmarks(self, landmarks: List[Dict[str, float]]) -> Tuple[str, float]:
        template_result = self.get_template_classification(landmarks)
        if template_result:
            template_label, similarity_score = template_result
            if similarity_score > 0.35:
                confidence = float(round(min(0.95, similarity_score), 2))
                return template_label, confidence

        # Only return a learned/template-based pose. Otherwise, do not classify.
        templates = PoseTemplate.objects.filter(landmarks__isnull=False)
        has_templates = False
        for template in templates:
            if template.landmarks:
                has_templates = True
                break

        if not has_templates:
            return 'Unknown Technique', 0.30

        return 'Unknown Technique', 0.30

    def parse_uploaded_image(self, uploaded_file) -> Optional[np.ndarray]:
        raw_bytes = uploaded_file.read()
        arr = np.frombuffer(raw_bytes, np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return image

    def parse_uploaded_video(self, uploaded_file) -> Optional[str]:
        raw_bytes = uploaded_file.read()
        suffix = os.path.splitext(uploaded_file.name)[1] or '.mp4'
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        temp_file.write(raw_bytes)
        temp_file.close()
        return temp_file.name

    def create_pose_template(self, uploaded_file, stance_label: str, uploaded_by=None) -> Dict[str, Any]:
        if not self.supports_pose():
            message = 'Pose learning is unavailable because MediaPipe failed to initialize.'
            if self.pose_init_error:
                message = f"{message} {self.pose_init_error}"
            raise ValueError(message)

        landmarks = None
        media_bytes = uploaded_file.read()
        try:
            image = self.parse_uploaded_image(ContentFile(media_bytes))
            if image is not None:
                image_rgb = self._rgb_image(image)
                cropped = self._crop_person(image_rgb)
                landmarks = self._extract_landmarks_from_image(cropped)
        except Exception:
            landmarks = None

        if landmarks is None:
            temp_path = self.parse_uploaded_video(ContentFile(media_bytes))
            cap = cv2.VideoCapture(temp_path)
            while cap.isOpened() and landmarks is None:
                ret, frame = cap.read()
                if not ret:
                    break
                landmarks = self.extract_pose_landmarks(frame)
            cap.release()
            try:
                os.remove(temp_path)
            except OSError:
                pass

        logging.info(f"Extracted {len(landmarks)} landmarks for template {stance_label}")
        landmark_vector = self._landmarks_to_vector(landmarks).tolist()
        template = PoseTemplate(stance_label=stance_label, uploaded_by=uploaded_by, landmarks=landmarks)  # store as list of dicts
        template.media_file.save(uploaded_file.name, ContentFile(media_bytes), save=False)
        template.save()
        logging.info(f"Template saved with ID {template.id}, landmarks length: {len(landmarks) if landmarks else 0}")
        return {
            'id': template.id,
            'stance_label': template.stance_label,
            'created_at': template.created_at.isoformat(),
            'landmarks': template.landmarks,
        }

    def analyze_pose_media(self, uploaded_file, student_id: int, target_stance: Optional[str] = None, evaluator=None) -> Dict[str, Any]:
        if not self.supports_pose():
            message = 'Pose analysis is unavailable because MediaPipe failed to initialize.'
            if self.pose_init_error:
                message = f"{message} {self.pose_init_error}"
            raise ValueError(message)

        raw_bytes = uploaded_file.read()
        extension = os.path.splitext(uploaded_file.name)[1].lower()
        is_video = extension in {'.mp4', '.mov', '.avi', '.mkv', '.webm'}

        frames = []
        temp_video_path = None

        if is_video:
            temp_video_path = tempfile.NamedTemporaryFile(delete=False, suffix=extension).name
            with open(temp_video_path, 'wb') as f:
                f.write(raw_bytes)
            cap = cv2.VideoCapture(temp_video_path)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            fps = cap.get(cv2.CAP_PROP_FPS) or 1
            step = max(1, int(fps))
            index = 0
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                if index % step == 0:
                    frames.append(frame)
                index += 1
            cap.release()
            if os.path.exists(temp_video_path):
                try:
                    os.remove(temp_video_path)
                except OSError:
                    pass
        else:
            image = cv2.imdecode(np.frombuffer(raw_bytes, np.uint8), cv2.IMREAD_COLOR)
            if image is not None:
                frames.append(image)

        if not frames:
            raise ValueError('Unable to parse the uploaded media for pose extraction.')

        target_landmarks = None
        if target_stance:
            try:
                template = PoseTemplate.objects.filter(stance_label=target_stance).first()
                if template and template.landmarks:
                    target_landmarks = template.landmarks
            except Exception:
                pass

        frame_results = []
        for idx, frame in enumerate(frames):
            landmarks = self.extract_pose_landmarks(frame)
            if landmarks is None:
                continue
            label, confidence = self.classify_landmarks(landmarks)
            frame_results.append({
                'frame_index': idx,
                'stance_type': label,
                'confidence': float(round(confidence, 2)),
                'timestamp': idx / (len(frames) - 1) if len(frames) > 1 else 0,  # normalized timestamp
            })

        if not frame_results:
            raise ValueError('No valid pose landmarks were detected in the media.')

        # Group by stance type and calculate statistics
        from collections import defaultdict
        stance_stats = defaultdict(list)

        for result in frame_results:
            stance_stats[result['stance_type']].append(result)

        # Create chronological list of detected stances
        detected_stances = []
        seen_stances = set()

        for result in frame_results:
            stance = result['stance_type']
            if stance not in seen_stances:
                seen_stances.add(stance)
                stance_frames = stance_stats[stance]
                avg_confidence = sum(f['confidence'] for f in stance_frames) / len(stance_frames)
                first_appearance = min(f['frame_index'] for f in stance_frames)
                duration_frames = len(stance_frames)

                detected_stances.append({
                    'stance_type': stance,
                    'score': int(min(100, max(0, round(avg_confidence * 100)))),
                    'confidence': float(round(avg_confidence, 2)),
                    'first_frame': first_appearance,
                    'frame_count': duration_frames,
                    'duration_ratio': duration_frames / len(frame_results),
                })

        # Sort by first appearance (chronological order)
        detected_stances.sort(key=lambda x: x['first_frame'])

        # Overall analysis
        total_frames = len(frame_results)
        primary_stance = detected_stances[0]['stance_type'] if detected_stances else 'Unknown Stance'
        overall_score = detected_stances[0]['score'] if detected_stances else 0

        remarks = f"Detected {len(detected_stances)} unique stance(s). Primary stance: {primary_stance}."

        analysis_details = {
            'detected_stances': detected_stances,
            'total_frames_analyzed': total_frames,
            'frames_with_pose': len(frame_results),
            'frame_results': frame_results,
            'evaluation_source': 'TensorFlow MediaPipe Pose Analysis with YOLO cropping',
        }

        return {
            'student_id': student_id,
            'stance_type': primary_stance,  # Keep for backward compatibility
            'score': overall_score,  # Keep for backward compatibility
            'remarks': remarks,
            'analysis_details': analysis_details,
        }
