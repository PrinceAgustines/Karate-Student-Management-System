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
        try:
            import face_recognition
            self.face_recognition = face_recognition
            logger.info("face-recognition library available for face encoding")
        except ImportError as e:
            logger.warning(f"face-recognition library not available for encoding: {e}")

    def _decode_face_encoding(self, encoding_b64: str) -> Optional[np.ndarray]:
        """Decode stored face encodings safely, handling float32 and legacy float64 encodings."""
        if not encoding_b64:
            return None
        try:
            decoded = base64.b64decode(encoding_b64)
        except Exception as e:
            logger.warning(f"Failed to decode face encoding from base64: {e}")
            return None

        if len(decoded) == 0:
            return None

        arr32 = None
        try:
            arr32 = np.frombuffer(decoded, dtype=np.float32)
        except Exception:
            arr32 = None

        if arr32 is not None and arr32.size == 128:
            return arr32

        try:
            arr64 = np.frombuffer(decoded, dtype=np.float64)
            if arr64.size == 128:
                return arr64.astype(np.float32)
        except Exception:
            pass

        if arr32 is not None and arr32.size > 0:
            return arr32

        return None


    def detect_faces(self, image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Detect faces in an image using MediaPipe (or Haar cascades as fallback).

        Args:
            image: numpy array of image (BGR or RGB)

        Returns:
            List of face locations as (top, right, bottom, left) tuples
        """
        # Convert images loaded through PIL to RGB; keep alpha if present
        if image.ndim == 3 and image.shape[2] == 4:
            image_rgb = cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)
        elif image.ndim == 3 and image.shape[2] == 3:
            image_rgb = image
        else:
            image_rgb = image

        # Try MediaPipe first (more accurate than Haar cascades)
        if self.use_mediapipe and self.mediapipe_detector is not None:
            try:
                if hasattr(self.mediapipe_detector, 'detect') and self.mediapipe_image is not None:
                    mp_image = self.mediapipe_image.Image(
                        self.mediapipe_image.ImageFormat.SRGB,
                        (image_rgb if image_rgb.dtype == np.uint8 else
                         (image_rgb * 255).astype(np.uint8) if np.nanmax(image_rgb) <= 1.0 else image_rgb.astype(np.uint8)),
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
                if face_locations:
                    return face_locations
            except Exception as exc:
                logger.warning(f"MediaPipe detection failed: {exc}")

        # Fallback to face_recognition detection if available
        if self.face_recognition is not None:
            try:
                face_locations = self.face_recognition.face_locations(image_rgb)
                logger.info(f"face_recognition detected {len(face_locations)} faces")
                if face_locations:
                    return face_locations
            except Exception as exc:
                logger.warning(f"face_recognition detection failed: {exc}")

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
        Primary: face-recognition library (128-element)
        Fallback: MediaPipe landmarks (consistent with detection)

        Args:
            image: numpy array of image
            face_location: (top, right, bottom, left) tuple

        Returns:
            Face encoding as numpy array, or None if encoding fails
        """
        # PRIMARY METHOD: Use face-recognition library (128-element encoding)
        logger.debug(f"encode_face called. face_recognition available: {self.face_recognition is not None}")
        if self.face_recognition is not None:
            try:
                # Ensure image is proper format for face-recognition
                if image.ndim != 3 or image.shape[2] not in [3, 4]:
                    logger.warning(f"Invalid image format for face-recognition: shape={image.shape}")
                else:
                    # Convert to RGB if needed
                    if image.shape[2] == 4:
                        image_rgb = cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)
                    elif image.dtype != np.uint8:
                        # Ensure uint8 type
                        if image.max() <= 1.0:
                            image_rgb = (image * 255).astype(np.uint8)
                        else:
                            image_rgb = image.astype(np.uint8)
                    else:
                        image_rgb = image
                    
                    # Generate encoding using face-recognition
                    encodings = self.face_recognition.face_encodings(image_rgb, [face_location])
                    if encodings and len(encodings) > 0:
                        encoding = np.asarray(encodings[0], dtype=np.float32)
                        if encoding is not None and len(encoding) == 128:
                            logger.info(f"✓ encode_face: Using PRIMARY METHOD - face-recognition (128-element)")
                            return encoding
                        else:
                            logger.warning(f"encode_face: face-recognition returned invalid encoding: {len(encoding) if encoding is not None else 'None'}")
            except Exception as e:
                logger.warning(f"encode_face: face-recognition encoding failed: {e}, trying fallback")

        # FALLBACK METHOD: Use MediaPipe face landmarks as features
        if self.use_mediapipe and self.mediapipe_detector is not None:
            try:
                top, right, bottom, left = face_location
                face_image = image[top:bottom, left:right]

                # Convert to RGB
                if face_image.ndim == 3 and face_image.shape[2] == 3:
                    face_rgb = face_image
                elif face_image.ndim == 3 and face_image.shape[2] == 4:
                    face_rgb = cv2.cvtColor(face_image, cv2.COLOR_RGBA2RGB)
                else:
                    face_rgb = face_image

                # Ensure uint8 type
                if face_rgb.dtype != np.uint8:
                    if face_rgb.max() <= 1.0:
                        face_rgb = (face_rgb * 255).astype(np.uint8)
                    else:
                        face_rgb = face_rgb.astype(np.uint8)

                if hasattr(self.mediapipe_detector, 'detect') and self.mediapipe_image is not None:
                    mp_image = self.mediapipe_image.Image(
                        self.mediapipe_image.ImageFormat.SRGB,
                        face_rgb,
                    )
                    results = self.mediapipe_detector.detect(mp_image)
                else:
                    raise RuntimeError('Unsupported MediaPipe detector interface')

                if results and getattr(results, 'detections', None) and len(results.detections) > 0:
                    detection = results.detections[0]
                    landmarks = getattr(detection.location_data, 'relative_keypoints', None)
                    if landmarks and len(landmarks) > 0:
                        encoding = []
                        for kp in landmarks:
                            encoding.extend([kp.x, kp.y, getattr(kp, 'z', 0.0)])
                        result_encoding = np.array(encoding, dtype=np.float32)
                        logger.info(f"✓ encode_face: Using FALLBACK 1 - MediaPipe landmarks ({len(result_encoding)} elements)")
                        return result_encoding
            except Exception as e:
                logger.warning(f"encode_face: MediaPipe encoding failed: {e}")

        # LAST RESORT: Create simple hash-based encoding from pixel data
        try:
            top, right, bottom, left = face_location
            face_crop = image[top:bottom, left:right]
            # Resize to 32x32 for consistent encoding
            face_small = cv2.resize(face_crop, (32, 32))
            # Flatten and normalize
            encoding = face_small.flatten().astype(np.float32) / 255.0
            logger.info(f"✓ encode_face: Using FALLBACK 2 - pixel-hash ({len(encoding)} elements)")
            return encoding
        except Exception as e:
            logger.error(f"Error generating fallback encoding: {e}")
            return None

    def match_face(self, face_encoding: np.ndarray, known_encodings: List[np.ndarray],
                   known_students: List[int], threshold: float = 0.6) -> Tuple[Optional[int], float]:
        """
        Match a face encoding against known encodings using face-recognition distance if available.

        Args:
            face_encoding: Face encoding to match
            known_encodings: List of known face encodings
            known_students: List of corresponding student IDs
            threshold: Distance threshold for matching (default 0.6 for face-recognition, 0.5 for fallback)

        Returns:
            Tuple of (student_id, confidence) or (None, 0.0) if no match
        """
        if not known_encodings or face_encoding is None:
            logger.debug("No encodings to match against")
            return None, 0.0

        try:
            # Try using face-recognition library if available
            if self.face_recognition is not None and len(face_encoding) == 128:
                # Check if we have 128-element known encodings (from face-recognition)
                valid_encodings = []
                valid_students = []
                
                for enc, student_id in zip(known_encodings, known_students):
                    if enc is not None and len(enc) == 128:
                        valid_encodings.append(enc)
                        valid_students.append(student_id)
                
                logger.info(f"Using face-recognition: {len(valid_encodings)} valid 128-element enrolled encodings, {len(known_encodings) - len(valid_encodings)} invalid")
                
                if valid_encodings:
                    try:
                        # Build a 2D float32 matrix for distance calculation to avoid ragged arrays
                        enc_matrix = np.vstack([np.asarray(e, dtype=np.float32) for e in valid_encodings])
                        face_vec = np.asarray(face_encoding, dtype=np.float32)

                        # Use face-recognition distance for 128-element encodings
                        distances = self.face_recognition.face_distance(enc_matrix, face_vec)
                        min_distance_idx = np.argmin(distances)
                        min_distance = float(distances[min_distance_idx])
                        confidence = float(max(0.0, 1.0 - min_distance))

                        # Log all distances for debugging
                        logger.info(f"face-recognition distances: {[f'{d:.4f}' for d in distances]}")
                        logger.info(f"face-recognition match: min_distance={min_distance:.4f}, confidence={confidence:.2f}, threshold={threshold}, student_id={valid_students[min_distance_idx]}")

                        if min_distance <= threshold:
                            logger.info(f"MATCH ACCEPTED: distance {min_distance:.4f} <= threshold {threshold}")
                            return valid_students[min_distance_idx], confidence
                        logger.info(f"MATCH REJECTED: distance {min_distance:.4f} > threshold {threshold}")
                        return None, confidence
                    except Exception as e:
                        logger.warning(f"face-recognition distance calculation failed: {e}, falling back to cosine similarity")

            # FALLBACK: Use cosine similarity for all other encoding types
            logger.debug("Using cosine similarity fallback for matching")
            
            # Filter out None values and keep track of indices
            valid_encodings = []
            valid_students = []
            
            for enc, student_id in zip(known_encodings, known_students):
                if enc is not None and len(enc) > 0:
                    valid_encodings.append(enc)
                    valid_students.append(student_id)

            if not valid_encodings:
                logger.warning("No valid encodings available for matching")
                return None, 0.0

            # Ensure same length for all encodings by using minimum length
            # Build a clean 2D float32 array trimmed to minimum length to avoid ragged objects
            min_len = min(min(len(enc) for enc in valid_encodings), len(face_encoding))
            logger.info(f"Cosine similarity fallback: {len(valid_encodings)} encodings, min_len={min_len}, face_encoding size={len(face_encoding)}")

            known_trimmed = np.vstack([np.asarray(enc[:min_len], dtype=np.float32) for enc in valid_encodings])
            face_trimmed = np.asarray(face_encoding[:min_len], dtype=np.float32)

            # Normalize vectors to prevent overflow and allow cosine similarity
            norm_known = np.linalg.norm(known_trimmed, axis=1)
            norm_face = np.linalg.norm(face_trimmed)
            if norm_face <= 1e-10:
                logger.warning("Cosine similarity fallback: detected face vector has zero norm")
                return None, 0.0

            normalized_known = np.zeros_like(known_trimmed, dtype=np.float32)
            normalized_known[norm_known > 0] = known_trimmed[norm_known > 0] / norm_known[norm_known > 0, None]
            normalized_face = face_trimmed / norm_face

            similarities = np.dot(normalized_known, normalized_face)

            # Convert similarity to distance (1 - similarity)
            distances = 1.0 - similarities

            # Find best and second-best matches
            sorted_indices = np.argsort(distances)
            min_distance_idx = sorted_indices[0]
            min_distance = distances[min_distance_idx]
            confidence = max(0.0, min(1.0, 1.0 - min_distance))

            # Use a moderate threshold for fallback encodings
            fallback_threshold = 0.5
            
            logger.info(f"Cosine similarity distances: {[f'{d:.4f}' for d in distances]}")
            logger.info(f"Cosine match: distance={min_distance:.4f}, confidence={confidence:.2f}, threshold={fallback_threshold}, student_id={valid_students[min_distance_idx]}")

            # Require a clear margin between the best and second-best match
            if len(distances) > 1:
                second_best = distances[sorted_indices[1]]
                margin = second_best - min_distance
                logger.info(f"Margin between best and second match: {margin:.4f}")
                if margin < 0.08:
                    logger.info("Ambiguous match: margin too small")
                    return None, confidence

            # If only a single known encoding exists, require stronger confidence
            if len(valid_students) == 1 and min_distance > 0.15:
                logger.info("Single enrollment with high distance")
                return None, confidence

            if min_distance <= fallback_threshold:
                logger.info(f"MATCH ACCEPTED: distance {min_distance:.4f} <= threshold {fallback_threshold}")
                return valid_students[min_distance_idx], confidence
            else:
                logger.info(f"MATCH REJECTED: distance {min_distance:.4f} > threshold {fallback_threshold}")
                return None, confidence

        except Exception as e:
            logger.error(f"Error matching face: {e}", exc_info=True)
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
            
            logger.info(f"Retrieved {face_data.count()} face data records from database")

            for face in face_data:
                encoding = self._decode_face_encoding(face.face_encoding)
                if encoding is None:
                    logger.warning(f"Skipping invalid face encoding for student {face.student.student_id}")
                    continue
                known_encodings.append(encoding)
                known_students.append(face.student.student_id)
                logger.info(f"Loaded enrolled face for student {face.student.student_id}: encoding shape={encoding.shape}, size={encoding.size}")

            logger.info(f"Loaded {len(known_encodings)} valid encodings from database for matching")

            # Process each detected face and collect candidate matches
            candidate_matches = []
            for i, face_location in enumerate(face_locations):
                face_encoding = self.encode_face(image_array, face_location)

                if face_encoding is not None:
                    logger.info(f"Detected face {i}: encoding shape={face_encoding.shape}, size={face_encoding.size}")
                    student_id, confidence = self.match_face(
                        face_encoding, known_encodings, known_students
                    )
                    logger.info(f"Face {i} match result: student_id={student_id}, confidence={confidence:.4f}")

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
                if match['confidence'] >= 0.55:
                    results['confirmed_matches'].append(match)
                else:
                    results['ambiguous_matches'].append(match)

            # Summary logging
            logger.info(f"=== PROCESS GROUP PHOTO SUMMARY ===")
            logger.info(f"Total faces detected: {len(face_locations)}")
            logger.info(f"Enrolled students in database: {len(known_students)}")
            logger.info(f"Confirmed matches (confidence >= 0.55): {len(results['confirmed_matches'])}")
            logger.info(f"Ambiguous matches (<0.55): {len(results['ambiguous_matches'])}")
            logger.info(f"Unmatched faces: {len(results['unmatched_faces'])}")
            logger.info(f"=== END SUMMARY ===")

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
                    face_encoding = np.asarray(face_encoding, dtype=np.float32)
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

            face_encoding = np.asarray(face_encoding, dtype=np.float32)
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