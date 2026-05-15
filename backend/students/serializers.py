import re

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import (
    Address,
    Attendance,
    BadgeDefinition,
    Cart,
    CartItem,
    ChallengeDefinition,
    Contact,
    EmergencyContact,
    GamificationProfile,
    InstructorRating,
    KarateBackground,
    Membership,
    Notification,
    Order,
    OrderItem,
    ParentStudent,
    PersonalInfo,
    PoseTemplate,
    Session,
    StanceEvaluation,
    Student,
    StudentBadge,
    StudentChallenge,
    KataRating,
    KumiteRating,
    PerformanceSummary,
    BeltProgressionIndicator,
    ProgressionInsight,
    Inventory,
    SystemID,
)

User = get_user_model()


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ['contact_number', 'email_address']


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ['house_number', 'street', 'city', 'full_address']


class PersonalInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonalInfo
        fields = ['birth_date', 'height', 'weight']


class EmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyContact
        fields = ['emergency_name', 'relationship', 'emergency_address', 'emergency_contact_number']


class StudentSerializer(serializers.ModelSerializer):
    personal_info = PersonalInfoSerializer(read_only=True)
    contacts = ContactSerializer(many=True, read_only=True)
    addresses = AddressSerializer(many=True, read_only=True)
    emergency_contacts = EmergencyContactSerializer(many=True, read_only=True)
    system_ids = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = '__all__'
        read_only_fields = ['emergency_contacts', 'contacts', 'addresses', 'personal_info', 'system_ids']

    def get_system_ids(self, obj):
        return SystemIDSerializer(obj.system_ids.all(), many=True).data


class SessionSerializer(serializers.ModelSerializer):
    instructor = serializers.StringRelatedField(read_only=True)
    instructor_id = serializers.PrimaryKeyRelatedField(
        source='instructor',
        queryset=Student.objects.filter(role='Instructor'),
        required=False,
    )
    enrolled = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = [
            'session_id',
            'date',
            'start_time',
            'end_time',
            'venue',
            'session_type',
            'instructor',
            'instructor_id',
            'enrolled',
        ]

    def get_enrolled(self, obj):
        return obj.attendances.count()


class AttendanceSerializer(serializers.ModelSerializer):
    student = serializers.IntegerField(source='student.student_id', read_only=True)
    student_name = serializers.CharField(source='student.__str__', read_only=True)
    session = serializers.IntegerField(source='session.session_id', read_only=True)
    session_name = serializers.CharField(source='session.__str__', read_only=True)
    session_type = serializers.CharField(source='session.session_type', read_only=True)

    class Meta:
        model = Attendance
        fields = [
            'attendance_id',
            'student',
            'student_name',
            'session',
            'session_name',
            'session_type',
            'date',
            'time_in',
            'time_out',
            'recognition_confidence',
        ]


class StanceEvaluationSerializer(serializers.ModelSerializer):
    student = serializers.IntegerField(source='student.student_id', read_only=True)
    student_name = serializers.CharField(source='student.__str__', read_only=True)
    evaluator_name = serializers.CharField(source='evaluated_by.__str__', read_only=True)

    class Meta:
        model = StanceEvaluation
        fields = [
            'id',
            'student',
            'student_name',
            'stance_type',
            'score',
            'remarks',
            'analysis_details',
            'evaluator_name',
            'date_evaluated',
        ]


class PoseTemplateSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.__str__', read_only=True)

    class Meta:
        model = PoseTemplate
        fields = [
            'id',
            'stance_label',
            'media_file',
            'landmarks',
            'uploaded_by_name',
            'created_at',
        ]


class InstructorRatingSerializer(serializers.ModelSerializer):
    student = serializers.IntegerField(source='student.student_id', read_only=True)
    student_name = serializers.CharField(source='student.__str__', read_only=True)

    class Meta:
        model = InstructorRating
        fields = [
            'id',
            'student',
            'student_name',
            'kata_score',
            'kumite_score',
            'discipline_score',
            'remarks',
            'date_evaluated',
        ]


class KataRatingSerializer(serializers.ModelSerializer):
    student = serializers.IntegerField(source='student.student_id', read_only=True)
    student_name = serializers.CharField(source='student.__str__', read_only=True)

    class Meta:
        model = KataRating
        fields = [
            'id',
            'student',
            'student_name',
            'pose_evaluation_avg',
            'instructor_kata_score',
            'combined_kata_score',
            'date_recorded',
            'month_year',
        ]


class KumiteRatingSerializer(serializers.ModelSerializer):
    student = serializers.IntegerField(source='student.student_id', read_only=True)
    student_name = serializers.CharField(source='student.__str__', read_only=True)

    class Meta:
        model = KumiteRating
        fields = [
            'id',
            'student',
            'student_name',
            'match_avg_score',
            'instructor_kumite_score',
            'combined_kumite_score',
            'wins',
            'losses',
            'date_recorded',
            'month_year',
        ]


class PerformanceSummarySerializer(serializers.ModelSerializer):
    student = serializers.IntegerField(source='student.student_id', read_only=True)
    student_name = serializers.CharField(source='student.__str__', read_only=True)

    class Meta:
        model = PerformanceSummary
        fields = [
            'id',
            'student',
            'student_name',
            'period',
            'start_date',
            'end_date',
            'kata_average',
            'kumite_average',
            'discipline_average',
            'overall_average',
            'kata_trend',
            'kumite_trend',
            'discipline_trend',
            'overall_trend',
            'sessions_attended',
            'evaluations_count',
            'matches_participated',
            'strength_area',
            'improvement_area',
            'generated_at',
        ]


class BeltProgressionIndicatorSerializer(serializers.ModelSerializer):
    student = serializers.IntegerField(source='student.student_id', read_only=True)
    student_name = serializers.CharField(source='student.__str__', read_only=True)

    class Meta:
        model = BeltProgressionIndicator
        fields = [
            'id',
            'student',
            'student_name',
            'current_belt',
            'target_belt',
            'readiness_status',
            'kata_readiness',
            'kumite_readiness',
            'discipline_readiness',
            'attendance_readiness',
            'overall_readiness_percentage',
            'kata_requirement',
            'kumite_requirement',
            'discipline_requirement',
            'attendance_requirement',
            'eligible_since',
            'last_assessment_date',
            'estimated_promotion_date',
            'notes',
        ]


class ProgressionInsightSerializer(serializers.ModelSerializer):
    student = serializers.IntegerField(source='student.student_id', read_only=True)
    student_name = serializers.CharField(source='student.__str__', read_only=True)

    class Meta:
        model = ProgressionInsight
        fields = [
            'id',
            'student',
            'student_name',
            'insight_type',
            'title',
            'description',
            'metric_name',
            'metric_value',
            'metric_history',
            'confidence_score',
            'generated_at',
        ]


class GamificationProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = GamificationProfile
        fields = [
            'total_xp',
            'level',
            'current_xp',
            'next_level_xp',
            'streak_days',
            'last_activity_date',
            'updated_at',
        ]


class BadgeDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BadgeDefinition
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'icon',
            'criteria_type',
            'threshold',
            'reward_xp',
            'active',
        ]


class StudentBadgeSerializer(serializers.ModelSerializer):
    badge = BadgeDefinitionSerializer(read_only=True)

    class Meta:
        model = StudentBadge
        fields = [
            'id',
            'badge',
            'earned_at',
            'progress_value',
            'note',
        ]


class ChallengeDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChallengeDefinition
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'icon',
            'target_value',
            'reward_xp',
            'active',
        ]


class StudentChallengeSerializer(serializers.ModelSerializer):
    challenge = ChallengeDefinitionSerializer(read_only=True)

    class Meta:
        model = StudentChallenge
        fields = [
            'id',
            'challenge',
            'progress',
            'completed_at',
            'reward_claimed',
        ]


class InventorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Inventory
        fields = '__all__'


class SystemIDSerializer(serializers.ModelSerializer):
    assigned_student = serializers.IntegerField(source='assigned_student.student_id', read_only=True)
    assigned_name = serializers.SerializerMethodField()

    class Meta:
        model = SystemID
        fields = [
            'id',
            'code',
            'id_type',
            'status',
            'assigned_student',
            'assigned_name',
            'date_issued',
        ]

    def get_assigned_name(self, obj):
        if obj.assigned_student is not None:
            return str(obj.assigned_student)

        if obj.id_type in ['instructor', 'admin', 'parent']:
            try:
                user = User.objects.get(username__iexact=obj.code)
            except User.DoesNotExist:
                return None

            name = f"{user.first_name or ''} {user.last_name or ''}".strip()
            return name or user.username

        return None


class ParentStudentSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.get_full_name', read_only=True)
    student_name = serializers.CharField(source='student.__str__', read_only=True)
    added_by_name = serializers.CharField(source='added_by.get_full_name', read_only=True, allow_blank=True)

    class Meta:
        model = ParentStudent
        fields = [
            'id',
            'parent',
            'parent_name',
            'student',
            'student_name',
            'relationship',
            'is_primary_contact',
            'added_at',
            'added_by',
            'added_by_name',
        ]
        read_only_fields = ['id', 'added_at', 'added_by']


class NotificationSerializer(serializers.ModelSerializer):
    student = serializers.IntegerField(source='student.student_id', read_only=True)
    student_name = serializers.CharField(source='student.__str__', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id',
            'student',
            'student_name',
            'notification_type',
            'message',
            'date_sent',
            'recipient',
            'is_read',
        ]


class StudentRegistrationSerializer(serializers.Serializer):
    student_id = serializers.CharField(max_length=64)
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=128)
    middle_name = serializers.CharField(max_length=128, allow_blank=True, required=False)
    last_name = serializers.CharField(max_length=128)
    gender = serializers.CharField(max_length=32)
    current_belt_rank = serializers.CharField(max_length=128, allow_blank=True, required=False)
    club_branch = serializers.CharField(max_length=128, allow_blank=True, required=False)
    birth_date = serializers.DateField(required=False, allow_null=True)
    height = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    weight = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    occupation = serializers.CharField(max_length=128, allow_blank=True, required=False)
    civil_status = serializers.CharField(max_length=64, allow_blank=True, required=False)
    build = serializers.CharField(max_length=64, allow_blank=True, required=False)
    complexion = serializers.CharField(max_length=64, allow_blank=True, required=False)
    nationality = serializers.CharField(max_length=128, allow_blank=True, required=False)
    hair_color = serializers.CharField(max_length=128, allow_blank=True, required=False)
    house_number = serializers.CharField(max_length=128, allow_blank=True, required=False)
    street = serializers.CharField(max_length=256, allow_blank=True, required=False)
    city = serializers.CharField(max_length=128, allow_blank=True, required=False)
    contact_number = serializers.CharField(max_length=64, allow_blank=True, required=False)
    emergency_name = serializers.CharField(max_length=256)
    relationship = serializers.CharField(max_length=128)
    emergency_address = serializers.CharField(allow_blank=True, required=False)
    emergency_contact_number = serializers.CharField(max_length=64)
    previous_club = serializers.CharField(max_length=256, allow_blank=True, required=False)
    karate_style = serializers.CharField(max_length=256, allow_blank=True, required=False)
    previous_rank = serializers.CharField(max_length=128, allow_blank=True, required=False)
    membership_type = serializers.CharField(max_length=32, default='New', required=False)
    membership_status = serializers.CharField(max_length=64, default='Active', required=False)
    membership_year = serializers.IntegerField(default=2026, required=False)
    membership_fee = serializers.DecimalField(max_digits=10, decimal_places=2, default=0.00, required=False)

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({
                'password': 'Password fields did not match.'
            })
        return attrs

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with that email already exists.')
        return value

    def validate_student_id(self, value):
        value = value.strip().upper()
        if not re.match(r'^S-\d{5}$', value):
            raise serializers.ValidationError('Student ID must follow the format S-12345.')

        try:
            system_id = SystemID.objects.get(code=value)
        except SystemID.DoesNotExist:
            raise serializers.ValidationError('Student ID not found. Please use an issued student ID.')

        if system_id.id_type != 'student':
            raise serializers.ValidationError('The provided ID is not a student ID.')

        if system_id.status != 'generated':
            raise serializers.ValidationError('This Student ID has already been used.')

        return value

    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        student_id = validated_data.pop('student_id')
        email = validated_data.pop('email')

        user = User.objects.create_user(
            username=student_id,
            email=email,
            password=password,
            role='student',
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )

        student = Student.objects.create(
            first_name=validated_data.get('first_name', ''),
            middle_name=validated_data.get('middle_name', ''),
            last_name=validated_data.get('last_name', ''),
            gender=validated_data.get('gender', ''),
            current_belt_rank=validated_data.get('current_belt_rank', ''),
            club_branch=validated_data.get('club_branch', ''),
            role='Student',
        )

        PersonalInfo.objects.create(
            student=student,
            birth_date=validated_data.get('birth_date'),
            height=validated_data.get('height'),
            weight=validated_data.get('weight'),
            occupation=validated_data.get('occupation', ''),
            civil_status=validated_data.get('civil_status', ''),
            build=validated_data.get('build', ''),
            complexion=validated_data.get('complexion', ''),
            nationality=validated_data.get('nationality', ''),
            hair_color=validated_data.get('hair_color', ''),
        )

        Address.objects.create(
            student=student,
            house_number=validated_data.get('house_number', ''),
            street=validated_data.get('street', ''),
            city=validated_data.get('city', ''),
            full_address=f"{validated_data.get('house_number', '')} {validated_data.get('street', '')}, {validated_data.get('city', '')}".strip(),
        )

        Contact.objects.create(
            student=student,
            contact_number=validated_data.get('contact_number', ''),
            email_address=email,
        )

        EmergencyContact.objects.create(
            student=student,
            emergency_name=validated_data.get('emergency_name', ''),
            relationship=validated_data.get('relationship', ''),
            emergency_address=validated_data.get('emergency_address', ''),
            emergency_contact_number=validated_data.get('emergency_contact_number', ''),
        )

        KarateBackground.objects.create(
            student=student,
            previous_club=validated_data.get('previous_club', ''),
            karate_style=validated_data.get('karate_style', ''),
            previous_rank=validated_data.get('previous_rank', ''),
        )

        Membership.objects.create(
            student=student,
            membership_type=validated_data.get('membership_type', 'New'),
            membership_status=validated_data.get('membership_status', 'Active'),
            membership_year=validated_data.get('membership_year', 2026),
            membership_fee=validated_data.get('membership_fee', 0.00),
        )

        return student


# E-Commerce Serializers

class CartItemSerializer(serializers.ModelSerializer):
    inventory_item = InventorySerializer(read_only=True)
    inventory_item_id = serializers.PrimaryKeyRelatedField(
        queryset=Inventory.objects.all(),
        write_only=True,
        source='inventory_item'
    )
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = ['id', 'inventory_item', 'inventory_item_id', 'quantity', 'subtotal', 'added_at']
        read_only_fields = ['id', 'added_at']

    def get_subtotal(self, obj):
        return obj.get_subtotal()


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_price = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ['id', 'user', 'items', 'total_price', 'item_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

    def get_total_price(self, obj):
        return obj.get_total_price()

    def get_item_count(self, obj):
        return obj.get_item_count()


class OrderItemSerializer(serializers.ModelSerializer):
    inventory_item = InventorySerializer(read_only=True)
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ['id', 'inventory_item', 'item_name', 'quantity', 'price_at_order', 'subtotal']
        read_only_fields = ['id']

    def get_subtotal(self, obj):
        return obj.get_subtotal()


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    confirmed_by_name = serializers.CharField(source='confirmed_by.get_full_name', read_only=True, allow_blank=True)
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'order_id',
            'user',
            'user_email',
            'student',
            'order_status',
            'recipient_name',
            'recipient_contact',
            'delivery_address',
            'delivery_city',
            'items',
            'total_amount',
            'created_at',
            'confirmed_at',
            'completed_at',
            'confirmed_by',
            'confirmed_by_name',
            'admin_notes',
            'customer_notes',
        ]
        read_only_fields = ['order_id', 'user', 'created_at', 'confirmed_at', 'completed_at', 'confirmed_by']

    def get_total_amount(self, obj):
        return obj.get_total_amount()


class OrderCreateSerializer(serializers.Serializer):
    """Serializer for creating an order from cart"""
    recipient_name = serializers.CharField(max_length=256)
    recipient_contact = serializers.CharField(max_length=64)
    delivery_address = serializers.CharField(allow_blank=True)
    delivery_city = serializers.CharField(max_length=128, required=False, allow_blank=True)
    customer_notes = serializers.CharField(required=False, allow_blank=True)
    use_profile_info = serializers.BooleanField(default=False)

    def validate_recipient_contact(self, value):
        if not value or len(value) < 7:
            raise serializers.ValidationError('Please provide a valid contact number.')
        return value
