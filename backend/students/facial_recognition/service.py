"""
Facial Recognition Service for Karate Student Management System

This module handles face detection, encoding, and matching for attendance tracking.
Uses MediaPipe for face detection and face-recognition library for encoding when available.
"""

import base64
import os
import numpy as np
import cv2
from PIL import Image
import logging
from typing import List, Tuple, Optional, Dict
from django.conf import settings
from students.models import FaceData, Student
import urllib.request

logger = logging.getLogger(__name__)

class FacialRecognitionService:
    """
    Service for handling facial recognition operations.
    Uses MediaPipe for face detection and face-recognition library for encoding.
    """

    def __init__(self):
        self.model_path = os.path.join(settings.BASE_DIR, 'models')
        os.makedirs(self.model_path, exist_ok=True)

        # Initialize MediaPipe face detection
        self.mediapipe_detector = None
        self.mediapipe_image = None
        self.use_mediapipe = False
        self.use_ml = False

        try:
            import mediapipe as mp
            from mediapipe.tasks import python
            from mediapipe.tasks.python.vision.core import image as mp_image_module

            # Download model file if it doesn't exist
            model_file = os.path.join(self.model_path, 'face_detection_short_range.tflite')
            if not os.path.exists(model_file):
                logger.info("Downloading MediaPipe face detection model...")
                try:
                    url = 'https://storage.googleapis.com/mediapipe-assets/face_detection_short_range.tflite'
                    urllib.request.urlretrieve(url, model_file)
                    logger.info(f"Downloaded face detection model to {model_file}")
                except Exception as e:
                    logger.warning(f"Failed to download face detection model: {e}. Will use Haar cascades.")
                    model_file = None

            if model_file and os.path.exists(model_file):
                base_options = python.BaseOptions(model_asset_path=model_file)
                options = python.vision.FaceDetectorOptions(
                    base_options=base_options,
                    running_mode=python.vision.RunningMode.IMAGE
                )
                self.mediapipe_detector = python.vision.FaceDetector.create_from_options(options)
                self.mediapipe_image = mp_image_module
                self.use_mediapipe = True
                self.use_ml = True
                logger.info("Using MediaPipe tasks API for face detection")
            else:
                raise RuntimeError("Face detection model file not available")
        except Exception as e:
            logger.warning(f"MediaPipe tasks API initialization failed ({e}) - will use Haar cascades")

        # Try to import face-recognition for encoding
        self.face_recognition = None
        # Temporarily disabled due to Python 3.14 compatibility issues
        # try:
        #     import face_recognition
        #     self.face_recognition = face_recognition
        #     logger.info("face-recognition library available for face encoding")
        # except ImportError:
        #     logger.warning("face-recognition library not available for encoding")



    def detect_faces(self, image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Detect faces in an image using MediaPipe (or Haar cascades as fallback).

        Args:
            image: numpy array of image (BGR or RGB)

        Returns:
            List of face locations as (top, right, bottom, left) tuples
        """
        # Try MediaPipe first (more accurate than Haar cascades)
        if self.use_mediapipe and self.mediapipe_detector is not None:
            try:
                # Convert BGR to RGB if needed
                if image.ndim == 3 and image.shape[2] == 3:
                    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                elif image.ndim == 3 and image.shape[2] == 4:
                    image_rgb = cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)
                else:
                    image_rgb = image

                if hasattr(self.mediapipe_detector, 'detect') and self.mediapipe_image is not None:
                    mp_image = self.mediapipe_image.Image(
                        self.mediapipe_image.ImageFormat.SRGB,
                        image_rgb,
                    )
                    results = self.mediapipe_detector.detect(mp_image)
                else:
                    raise RuntimeError('Unsupported MediaPipe detector interface')

                face_locations = []

                if results and getattr(results, 'detections', None):
                    h, w, _ = image_rgb.shape
                    for detection in results.detections:
                        bbox = detection.location_data.relative_bounding_box
                        # Convert relative coordinates to absolute
                        left = int(bbox.xmin * w)
                        top = int(bbox.ymin * h)
                        right = int((bbox.xmin + bbox.width) * w)
                        bottom = int((bbox.ymin + bbox.height) * h)

                        # Ensure coordinates are within bounds
                        left = max(0, left)
                        top = max(0, top)
                        right = min(w, right)
                        bottom = min(h, bottom)

                        face_locations.append((top, right, bottom, left))

                logger.info(f"MediaPipe detected {len(face_locations)} faces")
                return face_locations
            except Exception as exc:
                logger.warning(f"MediaPipe detection failed: {exc}")

        # Fallback to OpenCV Haar cascades
        logger.info("Using Haar cascades fallback for face detection")
        if image.ndim == 3 and image.shape[2] == 4:
            image = cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)

        if image.ndim == 3 and image.shape[2] == 3:
            # If image is RGB, convert to grayscale
            if isinstance(image, np.ndarray) and image.dtype == np.uint8:
                # Detect if it's BGR or RGB by trying to convert
                try:
                    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
                except Exception as e:
                    logger.warning(f"RGB to gray conversion failed, trying BGR: {e}")
                    try:
                        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                    except Exception as e2:
                        logger.error(f"Both RGB and BGR to gray conversion failed: {e2}")
                        raise
            else:
                gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        else:
            gray = image

        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.05,
            minNeighbors=5,
            flags=cv2.CASCADE_SCALE_IMAGE,
            minSize=(40, 40)
        )

        if len(faces) == 0:
            # Try with adjusted parameters for smaller/harder-to-detect faces
            faces = face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.03,
                minNeighbors=4,
                flags=cv2.CASCADE_SCALE_IMAGE,
                minSize=(30, 30)
            )

        if len(faces) == 0:
            # Try alternative cascade classifier
            alt_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml'
            )
            if not alt_cascade.empty():
                faces = alt_cascade.detectMultiScale(
                    gray,
                    scaleFactor=1.05,
                    minNeighbors=4,
                    flags=cv2.CASCADE_SCALE_IMAGE,
                    minSize=(30, 30)
                )

        face_locations = []
        for (x, y, w, h) in faces:
            face_locations.append((y, x + w, y + h, x))

        logger.info(f"Haar cascades detected {len(face_locations)} faces")
        return face_locations

    def encode_face(self, image: np.ndarray, face_location: Tuple[int, int, int, int]) -> Optional[np.ndarray]:
        """
        Generate face encoding for a detected face.

        Args:
            image: numpy array of image
            face_location: (top, right, bottom, left) tuple

        Returns:
            Face encoding as numpy array, or None if encoding fails
        """
        if self.face_recognition is not None:
            try:
                # Try using face-recognition if available
                encodings = self.face_recognition.face_encodings(image, [face_location])
                if encodings:
                    return encodings[0]
            except Exception as e:
                logger.warning(f"face-recognition encoding failed: {e}")

        # Fallback: Use MediaPipe face landmarks as features for encoding
        if self.use_mediapipe and self.mediapipe_detector is not None:
            try:
                top, right, bottom, left = face_location
                face_image = image[top:bottom, left:right]

                # Convert to RGB
                if face_image.ndim == 3 and face_image.shape[2] == 3:
                    face_rgb = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
                elif face_image.ndim == 3 and face_image.shape[2] == 4:
                    face_rgb = cv2.cvtColor(face_image, cv2.COLOR_RGBA2RGB)
                else:
                    face_rgb = face_image

                if hasattr(self.mediapipe_detector, 'detect') and self.mediapipe_image is not None:
                    mp_image = self.mediapipe_image.Image(
                        self.mediapipe_image.ImageFormat.SRGB,
                        face_rgb,
                    )
                    results = self.mediapipe_detector.detect(mp_image)
                else:
                    raise RuntimeError('Unsupported MediaPipe detector interface')

                if results and getattr(results, 'detections', None):
                    detection = results.detections[0]
                    landmarks = getattr(detection.location_data, 'relative_keypoints', None)
                    if landmarks:
                        encoding = []
                        for kp in landmarks:
                            encoding.extend([kp.x, kp.y, getattr(kp, 'z', 0.0)])
                        return np.array(encoding, dtype=np.float32)
            except Exception as e:
                logger.warning(f"MediaPipe encoding failed: {e}")

        # Fallback: Create simple hash-based encoding from pixel data
        try:
            top, right, bottom, left = face_location
            face_crop = image[top:bottom, left:right]
            # Resize to 32x32 for consistent encoding
            face_small = cv2.resize(face_crop, (32, 32))
            # Flatten and normalize
            encoding = face_small.flatten().astype(np.float32) / 255.0
            return encoding
        except Exception as e:
            logger.error(f"Error generating fallback encoding: {e}")
            return None

    def match_face(self, face_encoding: np.ndarray, known_encodings: List[np.ndarray],
                   known_students: List[int], threshold: float = 0.3) -> Tuple[Optional[int], float]:
        """
        Match a face encoding against known encodings using optimized vectorized operations.

        Args:
            face_encoding: Face encoding to match
            known_encodings: List of known face encodings
            known_students: List of corresponding student IDs
            threshold: Distance threshold for matching

        Returns:
            Tuple of (student_id, confidence) or (None, 0.0) if no match
        """
        if not known_encodings or face_encoding is None:
            return None, 0.0

        try:
            # Try using face-recognition if available
            if self.face_recognition is not None:
                distances = self.face_recognition.face_distance(known_encodings, face_encoding)
                min_distance_idx = np.argmin(distances)
                min_distance = distances[min_distance_idx]
                confidence = 1.0 - min_distance

                if min_distance <= threshold:
                    return known_students[min_distance_idx], confidence
                else:
                    return None, confidence

            # Fallback: Use optimized cosine similarity with vectorized operations
            # Convert to numpy array for vectorized operations
            known_encodings_array = np.array([enc for enc in known_encodings if enc is not None])

            if len(known_encodings_array) == 0:
                return None, 0.0

            # Filter out None values and keep track of indices
            valid_indices = [i for i, enc in enumerate(known_encodings) if enc is not None]
            valid_students = [known_students[i] for i in valid_indices]

            # Ensure same length for all encodings
            min_len = min(known_encodings_array.shape[1], len(face_encoding))
            known_trimmed = known_encodings_array[:, :min_len]
            face_trimmed = face_encoding[:min_len]

            # Vectorized cosine similarity calculation
            dot_products = np.dot(known_trimmed, face_trimmed)
            norm_known = np.linalg.norm(known_trimmed, axis=1)
            norm_face = np.linalg.norm(face_trimmed)

            # Avoid division by zero
            valid_norms = norm_known > 0
            similarities = np.zeros(len(known_trimmed))
            similarities[valid_norms] = dot_products[valid_norms] / (norm_known[valid_norms] * norm_face)

            # Convert similarity to distance
            distances = 1.0 - similarities

            # Find best and second-best matches
            sorted_indices = np.argsort(distances)
            min_distance_idx = sorted_indices[0]
            min_distance = distances[min_distance_idx]
            confidence = max(0.0, min(1.0, 1.0 - min_distance))

            # Require a clear margin between the best and second-best match
            if len(distances) > 1:
                second_best = distances[sorted_indices[1]]
                if second_best - min_distance < 0.08:
                    return None, confidence

            # If only a single known encoding exists, require stronger confidence
            if len(valid_students) == 1 and min_distance > 0.15:
                return None, confidence

            if min_distance <= threshold:
                return valid_students[min_distance_idx], confidence
            else:
                return None, confidence

        except Exception as e:
            logger.error(f"Error matching face: {e}")
            return None, 0.0

    def process_group_photo(self, image_file) -> Dict:
        """
        Process a group photo for attendance.

        Args:
            image_file: Uploaded image file

        Returns:
            Dict with detected faces, matches, and unmatched faces
        """
        try:
            # Convert uploaded file to numpy array with size limits
            image = Image.open(image_file)

            # Resize large images to prevent memory issues (max 1920x1080)
            max_width, max_height = 1920, 1080
            if image.width > max_width or image.height > max_height:
                image.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)

            image_array = np.array(image)

            # Detect faces
            face_locations = self.detect_faces(image_array)

            results = {
                'total_faces': len(face_locations),
                'confirmed_matches': [],
                'ambiguous_matches': [],
                'unmatched_faces': [],
                'face_locations': face_locations
            }

            if not face_locations:
                return results

            # Get all enrolled face data - optimize query
            face_data = FaceData.objects.filter(
                face_encoding__isnull=False
            ).select_related('student').only(
                'face_encoding', 'student__student_id',
                'student__first_name', 'student__middle_name', 'student__last_name'
            )

            known_encodings = []
            known_students = []

            for face in face_data:
                try:
                    decoded = base64.b64decode(face.face_encoding)
                    encoding = np.frombuffer(decoded, dtype=np.float32)
                    known_encodings.append(encoding)
                    known_students.append(face.student.student_id)
                except Exception as exc:
                    logger.warning(f"Skipping invalid face encoding for student {face.student.student_id}: {exc}")

            # Process each detected face and collect candidate matches
            candidate_matches = []
            for i, face_location in enumerate(face_locations):
                face_encoding = self.encode_face(image_array, face_location)

                if face_encoding is not None:
                    student_id, confidence = self.match_face(
                        face_encoding, known_encodings, known_students
                    )

                    if student_id:
                        # Get student name from pre-fetched data to avoid additional queries
                        student_name = 'Unknown'
                        for face in face_data:
                            if face.student.student_id == student_id:
                                student_name = f"{face.student.first_name} {face.student.middle_name + ' ' if face.student.middle_name else ''}{face.student.last_name}".strip()
                                break

                        student_payload = {
                            'id': student_id,
                            'name': student_name,
                            'student_id': student_id
                        }

                        candidate_matches.append({
                            'face_index': i,
                            'student': student_payload,
                            'confidence': confidence,
                            'location': face_location
                        })
                    else:
                        results['unmatched_faces'].append({
                            'face_index': i,
                            'confidence': confidence,
                            'location': face_location
                        })
                else:
                    results['unmatched_faces'].append({
                        'face_index': i,
                        'confidence': 0.0,
                        'location': face_location
                    })

            # Remove duplicate student matches, keeping only the best match for each student
            best_matches_by_student = {}
            for match in candidate_matches:
                sid = match['student']['student_id']
                existing = best_matches_by_student.get(sid)
                if existing is None or match['confidence'] > existing['confidence']:
                    if existing is not None:
                        results['unmatched_faces'].append({
                            'face_index': existing['face_index'],
                            'confidence': existing['confidence'],
                            'location': existing['location'],
                            'reason': 'duplicate student match'
                        })
                    best_matches_by_student[sid] = match
                else:
                    results['unmatched_faces'].append({
                        'face_index': match['face_index'],
                        'confidence': match['confidence'],
                        'location': match['location'],
                        'reason': 'duplicate student match'
                    })

            # Categorize matches by confidence
            for match in best_matches_by_student.values():
                if match['confidence'] >= 0.8:
                    results['confirmed_matches'].append(match)
                else:
                    results['ambiguous_matches'].append(match)

            return results

        except Exception as e:
            logger.error(f"Error processing group photo: {e}")
            return {
                'total_faces': 0,
                'confirmed_matches': [],
                'ambiguous_matches': [],
                'unmatched_faces': [],
                'error': str(e)
            }

    def extract_faces_from_photo(self, image_file) -> Dict:
        """
        Extract faces from a group photo for enrollment purposes.

        Args:
            image_file: Uploaded group photo

        Returns:
            Dict with extracted face data
        """
        try:
            # Convert uploaded file to numpy array
            image = Image.open(image_file)
            image_array = np.array(image)

            # Detect faces
            face_locations = self.detect_faces(image_array)

            results = {
                'total_faces': len(face_locations),
                'faces': []
            }

            if not face_locations:
                return results

            # Process each detected face
            for i, face_location in enumerate(face_locations):
                face_encoding = self.encode_face(image_array, face_location)
                encoded_text = None

                if face_encoding is not None:
                    encoded_text = base64.b64encode(face_encoding.tobytes()).decode('utf-8')

                # Convert face_location to bounding box format (x, y, width, height)
                top, right, bottom, left = face_location
                bounding_box = [left, top, right - left, bottom - top]

                results['faces'].append({
                    'face_index': i,
                    'bounding_box': bounding_box,  # [x, y, width, height]
                    'location': face_location,
                    'encoding': encoded_text
                })

                if face_encoding is None:
                    logger.warning(f"Face {i} detected but face encoding unavailable")

            return results

        except Exception as e:
            logger.error(f"Error extracting faces from photo: {e}")
            return {'total_faces': 0, 'faces': []}

    def enroll_student_face(self, student: Student, image_file, angle: str = 'front') -> bool:
        """
        Enroll a student's face data with size limits and validation.

        Args:
            student: Student instance
            image_file: Uploaded face image
            angle: Face angle ('front', 'left', 'right')

        Returns:
            True if enrollment successful
        """
        try:
            image = Image.open(image_file)

            # Validate image size (max 5MB)
            max_size_bytes = 5 * 1024 * 1024
            if hasattr(image_file, 'size') and image_file.size > max_size_bytes:
                logger.warning(f"Image too large for student {student.student_id}: {image_file.size} bytes")
                return False

            # Resize large images to prevent memory issues
            max_dimension = 1024
            if image.width > max_dimension or image.height > max_dimension:
                image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

            image_array = np.array(image)

            # Detect faces
            face_locations = self.detect_faces(image_array)

            if not face_locations:
                logger.warning(f"No faces detected in enrollment image for student {student.student_id}")
                return False

            # Use the first (largest) face
            face_location = face_locations[0]
            face_encoding = self.encode_face(image_array, face_location)

            if face_encoding is None:
                logger.error(f"Failed to encode face for student {student.student_id}")
                return False

            encoded_text = base64.b64encode(face_encoding.tobytes()).decode('utf-8')

            FaceData.objects.create(
                student=student,
                face_encoding=encoded_text,
                face_angle=angle,
                image_path='',
            )

            logger.info(f"Successfully enrolled face data for student {student.student_id}")
            return True

        except Exception as e:
            logger.error(f"Error enrolling student face: {e}")
            return False

    def save_face_encoding(self, student: Student, encoding_b64: str, angle: str = 'group') -> bool:
        """
        Save a face encoding directly (used for group photo enrollment).

        Args:
            student: Student instance
            encoding_b64: Base64 encoded face encoding
            angle: Face angle description

        Returns:
            True if save successful
        """
        try:
            FaceData.objects.create(
                student=student,
                face_encoding=encoding_b64,
                face_angle=angle,
                image_path='',
            )

            logger.info(f"Successfully saved face encoding for student {student.student_id}")
            return True

        except Exception as e:
            logger.error(f"Error saving face encoding for student {student.student_id}: {e}")
            return False