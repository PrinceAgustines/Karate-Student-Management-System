from datetime import date, time

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from students.models import (
    Attendance,
    InstructorRating,
    KarateBackground,
    Membership,
    Notification,
    PersonalInfo,
    Sale,
    Session,
    Student,
    Inventory,
    Contact,
    EmergencyContact,
    Address,
)


class Command(BaseCommand):
    help = "Remove demo data and seed fresh sample students, sessions, and related dojo records."

    def handle(self, *args, **options):
        User = get_user_model()

        self.stdout.write("Removing existing demo students, sessions, and users...")
        Attendance.objects.all().delete()
        InstructorRating.objects.all().delete()
        Notification.objects.all().delete()
        Sale.objects.all().delete()
        Session.objects.all().delete()
        PersonalInfo.objects.all().delete()
        EmergencyContact.objects.all().delete()
        Contact.objects.all().delete()
        Address.objects.all().delete()
        KarateBackground.objects.all().delete()
        Membership.objects.all().delete()
        Student.objects.all().delete()
        Inventory.objects.all().delete()
        User.objects.filter(is_superuser=False).delete()

        self.stdout.write("Creating sample instructor and student accounts...")
        instructor = User.objects.create_user(
            username="I-10001",
            email="I-10001",
            password="instructor123",
            first_name="Sensei",
            last_name="Miyagi",
            role="instructor",
        )

        instructor_student = Student.objects.create(
            first_name="Sensei",
            middle_name="",
            last_name="Miyagi",
            gender="Male",
            current_belt_rank="Black",
            club_branch="Downtown Dojo",
            role="Instructor",
        )

        sample_students = [
            {
                "student_id": "S-10001",
                "first_name": "Emma",
                "last_name": "Wilson",
                "gender": "Female",
                "current_belt_rank": "Green",
                "club_branch": "Downtown Dojo",
                "birth_date": date(2012, 3, 15),
                "height": 145.0,
                "weight": 40.0,
                "occupation": "Student",
                "civil_status": "Single",
                "build": "Athletic",
                "complexion": "Fair",
                "nationality": "Filipino",
                "hair_color": "Black",
                "house_number": "123",
                "street": "Main St",
                "city": "Metro Manila",
                "contact_number": "+63 912 345 6789",
                "email": "S-10001",
                "password": "student123",
            },
            {
                "student_id": "S-10002",
                "first_name": "Liam",
                "last_name": "Chen",
                "gender": "Male",
                "current_belt_rank": "Blue",
                "club_branch": "Eastside Dojo",
                "birth_date": date(2010, 7, 4),
                "height": 150.0,
                "weight": 45.0,
                "occupation": "Student",
                "civil_status": "Single",
                "build": "Lean",
                "complexion": "Medium",
                "nationality": "Filipino",
                "hair_color": "Dark Brown",
                "house_number": "456",
                "street": "Second Ave",
                "city": "Quezon City",
                "contact_number": "+63 917 654 3210",
                "email": "S-10002",
                "password": "student123",
            },
        ]

        for student_data in sample_students:
            user = User.objects.create_user(
                username=student_data["student_id"],
                email=student_data["email"],
                password=student_data["password"],
                first_name=student_data["first_name"],
                last_name=student_data["last_name"],
                role="student",
            )

            student = Student.objects.create(
                first_name=student_data["first_name"],
                middle_name="",
                last_name=student_data["last_name"],
                gender=student_data["gender"],
                current_belt_rank=student_data["current_belt_rank"],
                club_branch=student_data["club_branch"],
                role="Student",
            )

            PersonalInfo.objects.create(
                student=student,
                birth_date=student_data["birth_date"],
                height=student_data["height"],
                weight=student_data["weight"],
                occupation=student_data["occupation"],
                civil_status=student_data["civil_status"],
                build=student_data["build"],
                complexion=student_data["complexion"],
                nationality=student_data["nationality"],
                hair_color=student_data["hair_color"],
            )
            Address.objects.create(
                student=student,
                house_number=student_data["house_number"],
                street=student_data["street"],
                city=student_data["city"],
                full_address=f"{student_data['house_number']} {student_data['street']}, {student_data['city']}",
            )
            Contact.objects.create(
                student=student,
                contact_number=student_data["contact_number"],
                email_address=student_data["email"],
            )
            EmergencyContact.objects.create(
                student=student,
                emergency_name="Parent/Guardian",
                relationship="Mother",
                emergency_address="123 Main St, Metro Manila",
                emergency_contact_number=student_data["contact_number"],
            )
            KarateBackground.objects.create(
                student=student,
                previous_club="None",
                karate_style="Traditional",
                previous_rank="White",
            )
            Membership.objects.create(
                student=student,
                membership_type="New",
                membership_status="Active",
                membership_year=date.today().year,
                membership_fee=2000.00,
            )

        Session.objects.create(
            date=date.today(),
            start_time=time(17, 0),
            end_time=time(18, 30),
            venue="Main Dojo Hall",
            session_type="regular",
            instructor=instructor_student,
        )

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully."))
