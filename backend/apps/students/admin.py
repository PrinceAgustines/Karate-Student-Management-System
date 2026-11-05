from django.contrib import admin
from .models import (
    Student,
    PersonalInfo,
    Address,
    Contact,
    EmergencyContact,
    KarateBackground,
    FaceData,
    PoseTemplate,
    Session,
    Attendance,
    StanceEvaluation,
    InstructorRating,
    KataRating,
    KumiteRating,
    PerformanceSummary,
    Inventory,
    SystemID,
    Notification,
)

models_to_register = [
    Student,
    PersonalInfo,
    Address,
    Contact,
    EmergencyContact,
    KarateBackground,
    FaceData,
    PoseTemplate,
    Session,
    Attendance,
    StanceEvaluation,
    InstructorRating,
    KataRating,
    KumiteRating,
    PerformanceSummary,
    Inventory,
    SystemID,
    Notification,
]

for model in models_to_register:
    admin.site.register(model)
