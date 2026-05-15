"""TensorFlow face encoding helper for Karate Student Management System."""

import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

try:
    import tensorflow as tf
    import tensorflow_hub as hub
    import numpy as np
    TF_AVAILABLE = True
except ImportError:
    tf = None
    hub = None
    np = None
    TF_AVAILABLE = False


class TensorFlowFaceEncoder:
    """Wrapper around a TensorFlow face embedding model."""

    MODEL_URL = 'https://tfhub.dev/google/facenet/1'
    IMAGE_SIZE = 160

    def __init__(self):
        self.available = TF_AVAILABLE
        self.model = None

        if self.available:
            try:
                self.model = hub.load(self.MODEL_URL)
                logger.info('Loaded TensorFlow FaceNet model from TensorFlow Hub')
            except Exception as exc:
                self.available = False
                logger.warning(f'Failed to load TensorFlow FaceNet model: {exc}')

    def preprocess_face(self, image: "np.ndarray", face_location: Tuple[int, int, int, int]) -> "np.ndarray":
        top, right, bottom, left = face_location
        face = image[top:bottom, left:right]
        face = tf.image.resize(face, (self.IMAGE_SIZE, self.IMAGE_SIZE))
        face = tf.cast(face, tf.float32) / 255.0
        return tf.expand_dims(face, axis=0)

    def encode(self, image: "np.ndarray", face_location: Tuple[int, int, int, int]) -> Optional["np.ndarray"]:
        if not self.available or self.model is None:
            raise ImportError('TensorFlow face encoder is not available')

        if image is None:
            return None

        face_tensor = self.preprocess_face(image, face_location)
        embeddings = self.model(face_tensor)
        if embeddings is None:
            return None

        embedding = tf.reshape(embeddings, [-1]).numpy()
        return np.asarray(embedding, dtype=np.float64)
