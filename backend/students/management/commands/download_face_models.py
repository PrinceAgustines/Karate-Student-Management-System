"""
Management command to download OpenCV DNN face detection models.
"""

import os
import urllib.request
import logging
from django.core.management.base import BaseCommand
from django.conf import settings

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Download OpenCV DNN face detection model files'

    def handle(self, *args, **options):
        model_path = os.path.join(settings.BASE_DIR, 'models')
        os.makedirs(model_path, exist_ok=True)

        # OpenCV DNN face detector model URLs
        model_urls = {
            'opencv_face_detector_uint8.pb': 'https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/opencv_face_detector_uint8.pb',
            'opencv_face_detector.pbtxt': 'https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/opencv_face_detector.pbtxt'
        }

        for filename, url in model_urls.items():
            filepath = os.path.join(model_path, filename)
            if os.path.exists(filepath):
                self.stdout.write(f'Model file {filename} already exists, skipping...')
                continue

            self.stdout.write(f'Downloading {filename}...')
            try:
                urllib.request.urlretrieve(url, filepath)
                self.stdout.write(self.style.SUCCESS(f'Successfully downloaded {filename}'))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Failed to download {filename}: {e}'))