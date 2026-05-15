import random
import uuid

from django.conf import settings
from django.db import models


class Student(models.Model):
    ROLE_CHOICES = [
        ('Student', 'Student'),
        ('Instructor', 'Instructor'),
    ]

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    ]

    student_id = models.AutoField(primary_key=True)
    application_number = models.CharField(max_length=128, unique=True, blank=True)
    first_name = models.CharField(max_length=128)
    middle_name = models.CharField(max_length=128, blank=True)
    last_name = models.CharField(max_length=128)
    gender = models.CharField(max_length=32)
    role = models.CharField(max_length=24, choices=ROLE_CHOICES, default='Student')
    date_enrolled = models.DateField(auto_now_add=True)
    current_belt_rank = models.CharField(max_length=128, blank=True)
    club_branch = models.CharField(max_length=128, blank=True)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default='active')

    def save(self, *args, **kwargs):
        if not self.application_number:
            self.application_number = f"APP-{uuid.uuid4().hex[:10].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student_id} - {self.first_name} {self.last_name}"


class SystemID(models.Model):
    ID_TYPE_CHOICES = [
        ('student', 'Student'),
        ('instructor', 'Instructor'),
        ('admin', 'Admin'),
        ('parent', 'Parent'),
    ]

    STATUS_CHOICES = [
        ('generated', 'Generated'),
        ('assigned', 'Assigned'),
    ]

    code = models.CharField(max_length=32, unique=True)
    id_type = models.CharField(max_length=32, choices=ID_TYPE_CHOICES)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='generated')
    assigned_student = models.ForeignKey(
        Student,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='system_ids',
    )
    date_issued = models.DateField(auto_now_add=True)

    class Meta:
        ordering = ['-date_issued', 'code']

    def save(self, *args, **kwargs):
        if self.assigned_student and self.status != 'assigned':
            self.status = 'assigned'
        if not self.assigned_student and self.status != 'generated':
            self.status = 'generated'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} ({self.get_id_type_display()})"

    @classmethod
    def generate_unique_code(cls, id_type):
        prefix_map = {
            'student': 'S',
            'instructor': 'I',
            'admin': 'A',
            'parent': 'P',
        }
        prefix = prefix_map.get(id_type, 'X')
        while True:
            code = f"{prefix}-{random.randint(0, 99999):05d}"
            if not cls.objects.filter(code=code).exists():
                return code


class PersonalInfo(models.Model):
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='personal_info')
    birth_date = models.DateField(null=True, blank=True)
    height = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    weight = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    occupation = models.CharField(max_length=128, blank=True)
    civil_status = models.CharField(max_length=64, blank=True)
    build = models.CharField(max_length=64, blank=True)
    complexion = models.CharField(max_length=64, blank=True)
    nationality = models.CharField(max_length=128, blank=True)
    hair_color = models.CharField(max_length=128, blank=True)

    def __str__(self):
        return f"PersonalInfo for {self.student}"


class Address(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='addresses')
    house_number = models.CharField(max_length=128, blank=True)
    street = models.CharField(max_length=256, blank=True)
    city = models.CharField(max_length=128, blank=True)
    full_address = models.TextField(blank=True)

    def __str__(self):
        return f"Address for {self.student}"


class Contact(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='contacts')
    contact_number = models.CharField(max_length=64, blank=True)
    email_address = models.EmailField(blank=True)

    def __str__(self):
        return f"Contact for {self.student}"


class EmergencyContact(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='emergency_contacts')
    emergency_name = models.CharField(max_length=256)
    relationship = models.CharField(max_length=128)
    emergency_address = models.TextField(blank=True)
    emergency_contact_number = models.CharField(max_length=64)

    def __str__(self):
        return f"EmergencyContact for {self.student}"


class KarateBackground(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='karate_backgrounds')
    previous_club = models.CharField(max_length=256, blank=True)
    karate_style = models.CharField(max_length=256, blank=True)
    previous_rank = models.CharField(max_length=128, blank=True)

    def __str__(self):
        return f"KarateBackground for {self.student}"


class Membership(models.Model):
    MEMBERSHIP_TYPE_CHOICES = [
        ('New', 'New'),
        ('Renewal', 'Renewal'),
        ('Competitor', 'Competitor'),
    ]
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='memberships')
    membership_type = models.CharField(max_length=32, choices=MEMBERSHIP_TYPE_CHOICES)
    membership_status = models.CharField(max_length=64)
    membership_year = models.IntegerField()
    membership_fee = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"Membership for {self.student}"


class FaceData(models.Model):
    FACE_ANGLE_CHOICES = [
        ('Front', 'Front'),
        ('Left', 'Left'),
        ('Right', 'Right'),
    ]
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='face_data')
    face_encoding = models.TextField(blank=True)
    image_path = models.CharField(max_length=512, blank=True)
    face_angle = models.CharField(max_length=32, choices=FACE_ANGLE_CHOICES, blank=True)
    date_registered = models.DateField(auto_now_add=True)

    def __str__(self):
        return f"FaceData for {self.student}"


class PoseTemplate(models.Model):
    POSE_LABEL_CHOICES = [
        ('Kiba-dachi / Horse riding stance', 'Kiba-dachi / Horse riding stance'),
        ('Nekoashi-dachi / Cat stance', 'Nekoashi-dachi / Cat stance'),
        ('Sanchin-dachi / Hourglass/three-point stance', 'Sanchin-dachi / Hourglass/three-point stance'),
        ('Heisoku-dachi / Formal attention stance', 'Heisoku-dachi / Formal attention stance'),
        ('Age-uke / Rising block', 'Age-uke / Rising block'),
        ('Gedan-barai / Downward block', 'Gedan-barai / Downward block'),
        ('Soto-uke / Outside-to-inside block', 'Soto-uke / Outside-to-inside block'),
        ('Uchi-uke / Inside-to-outside block', 'Uchi-uke / Inside-to-outside block'),
        ('Shuto-uke / Knife hand block', 'Shuto-uke / Knife hand block'),
        ('Morote-uke / Augmented/two-hand block', 'Morote-uke / Augmented/two-hand block'),
        ('Choku-zuki / Straight punch', 'Choku-zuki / Straight punch'),
        ('Oi-zuki / Lunge punch', 'Oi-zuki / Lunge punch'),
        ('Gyaku-zuki / Reverse punch', 'Gyaku-zuki / Reverse punch'),
        ('Kizami-zuki / Jab punch', 'Kizami-zuki / Jab punch'),
        ('Uraken-uchi / Backfist strike', 'Uraken-uchi / Backfist strike'),
        ('Shuto-uchi / Knife hand strike', 'Shuto-uchi / Knife hand strike'),
        ('Empi-uchi / Elbow strike', 'Empi-uchi / Elbow strike'),
        ('Haito-uchi / Ridge hand strike', 'Haito-uchi / Ridge hand strike'),
        ('Mae-geri / Front kick', 'Mae-geri / Front kick'),
        ('Mawashi-geri / Roundhouse kick', 'Mawashi-geri / Roundhouse kick'),
        ('Yoko-geri Keage / Side snap kick', 'Yoko-geri Keage / Side snap kick'),
        ('Yoko-geri Kekomi / Side thrust kick', 'Yoko-geri Kekomi / Side thrust kick'),
        ('Ushiro-geri / Back kick', 'Ushiro-geri / Back kick'),
        ('Fumikomi / Stomp kick', 'Fumikomi / Stomp kick'),
        ('Hiza-geri / Knee kick', 'Hiza-geri / Knee kick'),
        ('Tobi-geri / Jumping kick', 'Tobi-geri / Jumping kick'),
    ]
    SUPPORTED_POSE_LABELS = [label for label, _ in POSE_LABEL_CHOICES]

    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='pose_templates')
    stance_label = models.CharField(max_length=128, choices=POSE_LABEL_CHOICES)
    media_file = models.FileField(upload_to='pose_templates/', null=True, blank=True)
    landmarks = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def get_stance_label_choices(cls):
        return cls.SUPPORTED_POSE_LABELS

    def __str__(self):
        return f"PoseTemplate({self.stance_label})"


class Session(models.Model):
    SESSION_TYPE_CHOICES = [
        ('regular', 'Regular'),
        ('seminar', 'Seminar'),
        ('tournament', 'Tournament'),
        ('competition prep', 'Competition Prep'),
    ]
    session_id = models.AutoField(primary_key=True)
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    venue = models.CharField(max_length=256)
    session_type = models.CharField(max_length=64, choices=SESSION_TYPE_CHOICES)
    instructor = models.ForeignKey(Student, null=True, blank=True, on_delete=models.CASCADE, related_name='sessions')

    def __str__(self):
        return f"Session {self.session_id} on {self.date}"


class Attendance(models.Model):
    attendance_id = models.AutoField(primary_key=True)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='attendances')
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='attendances')
    date = models.DateField()
    time_in = models.TimeField(null=True, blank=True)
    time_out = models.TimeField(null=True, blank=True)
    recognition_confidence = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    def __str__(self):
        return f"Attendance {self.attendance_id}"


class StanceEvaluation(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='stance_evaluations')
    stance_type = models.CharField(max_length=128)
    score = models.IntegerField()
    remarks = models.TextField(blank=True)
    analysis_details = models.JSONField(null=True, blank=True)
    evaluated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='stance_evaluations_given')
    date_evaluated = models.DateField()

    def __str__(self):
        return f"StanceEvaluation for {self.student}"


class Match(models.Model):
    student_a = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='matches_as_a')
    student_b = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='matches_as_b')
    score_a = models.IntegerField()
    score_b = models.IntegerField()
    winner = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='matches_won')
    match_date = models.DateField()
    category = models.CharField(max_length=128)

    def __str__(self):
        return f"Match {self.id} - {self.student_a} vs {self.student_b}"


class InstructorRating(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='instructor_ratings')
    kata_score = models.IntegerField()
    kumite_score = models.IntegerField()
    discipline_score = models.IntegerField()
    remarks = models.TextField(blank=True)
    date_evaluated = models.DateField()

    def __str__(self):
        return f"InstructorRating for {self.student}"


class KataRating(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='kata_ratings')
    pose_evaluation_avg = models.FloatField(default=0.0)
    instructor_kata_score = models.FloatField(default=0.0)
    combined_kata_score = models.FloatField(default=0.0)
    date_recorded = models.DateField(auto_now_add=True)
    month_year = models.CharField(max_length=7, blank=True)

    class Meta:
        ordering = ['-date_recorded']
        indexes = [
            models.Index(fields=['student', 'date_recorded']),
        ]

    def save(self, *args, **kwargs):
        if not self.month_year and self.date_recorded:
            self.month_year = self.date_recorded.strftime('%Y-%m')
        super().save(*args, **kwargs)

    def __str__(self):
        return f"KataRating for {self.student} on {self.date_recorded}"


class KumiteRating(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='kumite_ratings')
    match_avg_score = models.FloatField(default=0.0)
    instructor_kumite_score = models.FloatField(default=0.0)
    combined_kumite_score = models.FloatField(default=0.0)
    wins = models.IntegerField(default=0)
    losses = models.IntegerField(default=0)
    date_recorded = models.DateField(auto_now_add=True)
    month_year = models.CharField(max_length=7, blank=True)

    class Meta:
        ordering = ['-date_recorded']
        indexes = [
            models.Index(fields=['student', 'date_recorded']),
        ]

    def save(self, *args, **kwargs):
        if not self.month_year and self.date_recorded:
            self.month_year = self.date_recorded.strftime('%Y-%m')
        super().save(*args, **kwargs)

    def __str__(self):
        return f"KumiteRating for {self.student} on {self.date_recorded}"


class PerformanceSummary(models.Model):
    PERIOD_CHOICES = [
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('yearly', 'Yearly'),
        ('overall', 'Overall'),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='performance_summaries')
    period = models.CharField(max_length=16, choices=PERIOD_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    kata_average = models.FloatField(default=0.0)
    kumite_average = models.FloatField(default=0.0)
    discipline_average = models.FloatField(default=0.0)
    overall_average = models.FloatField(default=0.0)
    kata_trend = models.FloatField(default=0.0)
    kumite_trend = models.FloatField(default=0.0)
    discipline_trend = models.FloatField(default=0.0)
    overall_trend = models.FloatField(default=0.0)
    sessions_attended = models.IntegerField(default=0)
    evaluations_count = models.IntegerField(default=0)
    matches_participated = models.IntegerField(default=0)
    strength_area = models.CharField(max_length=64, blank=True)
    improvement_area = models.CharField(max_length=64, blank=True)
    generated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-generated_at']
        indexes = [
            models.Index(fields=['student', 'period', 'start_date']),
        ]

    def __str__(self):
        return f"{self.student} {self.period.title()} Performance Summary"


class BeltProgressionIndicator(models.Model):
    READINESS_STATUS_CHOICES = [
        ('not_ready', 'Not Ready'),
        ('in_progress', 'In Progress'),
        ('ready', 'Ready for Testing'),
        ('tested', 'Tested - Awaiting Decision'),
        ('promoted', 'Promoted'),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='belt_progression_indicators')
    current_belt = models.CharField(max_length=128, blank=True)
    target_belt = models.CharField(max_length=128, blank=True)
    readiness_status = models.CharField(max_length=32, choices=READINESS_STATUS_CHOICES, default='not_ready')
    kata_readiness = models.FloatField(default=0.0)
    kumite_readiness = models.FloatField(default=0.0)
    discipline_readiness = models.FloatField(default=0.0)
    attendance_readiness = models.FloatField(default=0.0)
    overall_readiness_percentage = models.FloatField(default=0.0)
    kata_requirement = models.FloatField(default=75.0)
    kumite_requirement = models.FloatField(default=70.0)
    discipline_requirement = models.FloatField(default=80.0)
    attendance_requirement = models.FloatField(default=85.0)
    eligible_since = models.DateField(null=True, blank=True)
    last_assessment_date = models.DateField(auto_now=True)
    estimated_promotion_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-last_assessment_date']
        indexes = [
            models.Index(fields=['student', 'readiness_status']),
        ]

    def __str__(self):
        return f"Belt progression for {self.student} ({self.readiness_status})"


class ProgressionInsight(models.Model):
    INSIGHT_TYPE_CHOICES = [
        ('strength', 'Strength'),
        ('weakness', 'Weakness'),
        ('trend', 'Trend'),
        ('recommendation', 'Recommendation'),
        ('milestone', 'Milestone'),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='progression_insights')
    insight_type = models.CharField(max_length=32, choices=INSIGHT_TYPE_CHOICES)
    title = models.CharField(max_length=256)
    description = models.TextField()
    metric_name = models.CharField(max_length=128, blank=True)
    metric_value = models.FloatField(default=0.0)
    metric_history = models.JSONField(default=dict, blank=True)
    confidence_score = models.FloatField(default=0.0)
    generated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-generated_at']
        indexes = [
            models.Index(fields=['student', 'insight_type']),
        ]

    def __str__(self):
        return f"Insight for {self.student}: {self.title}"


class Payment(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='payments')
    enrollment_fee = models.FloatField(default=0.0)
    monthly_fee = models.FloatField(default=0.0)
    testing_fee = models.FloatField(default=0.0)
    due_date = models.DateField(null=True, blank=True)
    paid_date = models.DateField(null=True, blank=True)
    amount_paid = models.FloatField(default=0.0)
    payment_status = models.CharField(max_length=64, blank=True)
    payment_mode = models.CharField(max_length=64, blank=True)

    def __str__(self):
        return f"Payment for {self.student}"


class Inventory(models.Model):
    CATEGORY_CHOICES = [
        ('uniform', 'Uniform'),
        ('equipment', 'Equipment'),
        ('accessory', 'Accessory'),
        ('apparel', 'Apparel'),
        ('other', 'Other'),
    ]

    item_id = models.AutoField(primary_key=True)
    item_name = models.CharField(max_length=256)
    category = models.CharField(max_length=32, choices=CATEGORY_CHOICES, default='other')
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.IntegerField(default=0)
    supplier = models.CharField(max_length=256, blank=True)
    borrowed = models.BooleanField(default=False)
    image_url = models.URLField(blank=True, null=True)
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['item_name']
        indexes = [
            models.Index(fields=['category', 'is_available']),
            models.Index(fields=['quantity']),
        ]

    def __str__(self):
        return self.item_name

    def get_available_quantity(self):
        """Get actual available quantity (total quantity - items in pending orders)"""
        pending_quantity = OrderItem.objects.filter(
            order__inventory_item=self,
            order__order_status__in=['pending', 'confirmed']
        ).aggregate(models.Sum('quantity'))['quantity__sum'] or 0
        return self.quantity - pending_quantity


class Sale(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='sales')
    item = models.ForeignKey(Inventory, on_delete=models.CASCADE, related_name='sales')
    quantity = models.IntegerField()
    total_price = models.FloatField()
    sale_date = models.DateField()

    def __str__(self):
        return f"Sale {self.id} - {self.item}"


class Cart(models.Model):
    """Shopping cart for students/parents"""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cart')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Carts"

    def __str__(self):
        return f"Cart for {self.user}"

    def get_total_price(self):
        """Calculate total price of all items in cart"""
        return sum(item.get_subtotal() for item in self.items.all())

    def get_item_count(self):
        """Get total number of items in cart"""
        return sum(item.quantity for item in self.items.all())


class CartItem(models.Model):
    """Items in shopping cart"""
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    inventory_item = models.ForeignKey(Inventory, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['cart', 'inventory_item']
        verbose_name_plural = "Cart Items"

    def __str__(self):
        return f"{self.quantity}x {self.inventory_item.item_name}"

    def get_subtotal(self):
        """Calculate subtotal for this cart item"""
        return float(self.inventory_item.price) * self.quantity


class Order(models.Model):
    ORDER_STATUS_CHOICES = [
        ('pending', 'Pending - Awaiting Confirmation'),
        ('confirmed', 'Confirmed by Admin'),
        ('completed', 'Completed - Paid by Customer'),
        ('cancelled', 'Cancelled'),
    ]

    order_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders')
    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True, related_name='product_orders')
    order_status = models.CharField(max_length=32, choices=ORDER_STATUS_CHOICES, default='pending')

    # Delivery Information
    recipient_name = models.CharField(max_length=256)
    recipient_contact = models.CharField(max_length=64)
    delivery_address = models.TextField()
    delivery_city = models.CharField(max_length=128, blank=True)

    # Order Metadata
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='confirmed_orders')

    # Notes
    admin_notes = models.TextField(blank=True)
    customer_notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'order_status']),
            models.Index(fields=['order_status', 'created_at']),
        ]

    def __str__(self):
        return f"Order #{self.order_id} - {self.user} ({self.order_status})"

    def get_total_amount(self):
        """Calculate total from order items"""
        from django.db.models import Sum, F
        total = OrderItem.objects.filter(order=self).aggregate(
            total=Sum(F('quantity') * F('price_at_order'), output_field=models.DecimalField())
        )['total'] or 0
        return total


class OrderItem(models.Model):
    """Items in an order"""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    inventory_item = models.ForeignKey(Inventory, on_delete=models.SET_NULL, null=True, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    price_at_order = models.DecimalField(max_digits=10, decimal_places=2)  # Store price snapshot
    item_name = models.CharField(max_length=256)  # Store item name snapshot

    class Meta:
        verbose_name_plural = "Order Items"

    def __str__(self):
        return f"{self.quantity}x {self.item_name}"

    def get_subtotal(self):
        """Calculate subtotal for this order item"""
        return float(self.price_at_order) * self.quantity



class ParentStudent(models.Model):
    """Relationship between parents and their children (students)"""
    parent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='parent_students')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='parent_relationships')
    relationship = models.CharField(max_length=64, choices=[
        ('mother', 'Mother'),
        ('father', 'Father'),
        ('guardian', 'Guardian'),
        ('other', 'Other'),
    ], default='guardian')
    is_primary_contact = models.BooleanField(default=False)
    added_at = models.DateTimeField(auto_now_add=True)
    added_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='added_parent_relationships')

    class Meta:
        unique_together = ['parent', 'student']
        ordering = ['-added_at']

    def __str__(self):
        return f"{self.parent.get_full_name()} - {self.student.first_name} {self.student.last_name} ({self.relationship})"


class Notification(models.Model):
    NOTIFICATION_TYPE_CHOICES = [
        ('sms', 'SMS'),
        ('email', 'Email'),
        ('announcement', 'Announcement'),
        ('alert', 'Alert'),
        ('success', 'Success'),
        ('info', 'Info'),
        ('product_ordered', 'Product Ordered'),
        ('student_registered', 'Student Registered'),
        ('staff_registered', 'Staff Registered'),
        ('parent_registered', 'Parent Registered'),
        ('schedule_created', 'Schedule Created'),
        ('schedule_updated', 'Schedule Updated'),
        ('class_cancelled', 'Class Cancelled'),
        ('tournament_announcement', 'Tournament Announcement'),
        ('belt_exam_scheduled', 'Belt Exam Scheduled'),
        ('belt_exam_reminder', 'Belt Exam Reminder'),
        ('marked_absent', 'Marked Absent'),
        ('attendance_streak_achieved', 'Attendance Streak Achieved'),
        ('grade_posted', 'Grade Posted'),
        ('belt_promotion_eligibility_achieved', 'Belt Promotion Eligibility Achieved'),
        ('new_rank_achieved', 'New Rank Achieved'),
        ('level_increased', 'Level Increased'),
        ('achievement_unlocked', 'Achievement Unlocked'),
        ('streak_bonus_earned', 'Streak Bonus Earned'),
        ('leaderboard_rank_increased', 'Leaderboard Rank Increased'),
        ('profile_updated', 'Profile Updated'),
        ('tournament_added', 'Tournament Added'),
        ('seminar_added', 'Seminar Added'),
        ('attendance_recorded', 'Attendance Recorded'),
        ('pose_evaluation_completed', 'Pose Evaluation Completed'),
        ('grading_submitted', 'Grading Submitted'),
        ('promotion_eligible', 'Promotion Eligible'),
        ('grade_updated', 'Grade Updated'),
        ('match_result_recorded', 'Match Result Recorded'),
        ('top_performers_identified', 'Top Performers Identified'),
        ('weekly_report_generated', 'Weekly Report Generated'),
        # Parent notifications
        ('child_upcoming_class', 'Child Has Upcoming Class'),
        ('child_schedule_changed', 'Child Schedule Changed'),
        ('child_attended_class', 'Child Attended Class'),
        ('child_was_absent', 'Child Was Absent'),
        ('child_grading_available', 'Child Grading Available'),
        ('child_promotion_eligible', 'Child Promotion Eligible'),
        ('child_promotion_achieved', 'Child Promotion Achieved'),
        ('child_achievement_earned', 'Child Achievement Earned'),
        ('child_leaderboard_improved', 'Child Leaderboard Improved'),
    ]
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=64, choices=NOTIFICATION_TYPE_CHOICES)
    message = models.TextField()
    date_sent = models.DateField()
    recipient = models.CharField(max_length=256)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"Notification for {self.student}"


class GamificationProfile(models.Model):
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='gamification_profile')
    total_xp = models.IntegerField(default=0)
    level = models.IntegerField(default=1)
    current_xp = models.IntegerField(default=0)
    next_level_xp = models.IntegerField(default=500)
    streak_days = models.IntegerField(default=0)
    last_activity_date = models.DateField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"GamificationProfile for {self.student}"


class BadgeDefinition(models.Model):
    CRITERIA_TYPE_CHOICES = [
        ('attendance', 'Attendance'),
        ('kata_score', 'Kata Score'),
        ('overall_score', 'Overall Score'),
        ('belt_readiness', 'Belt Readiness'),
        ('streak', 'Consistency Streak'),
    ]

    name = models.CharField(max_length=128)
    slug = models.CharField(max_length=128, unique=True)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=16, blank=True)
    criteria_type = models.CharField(max_length=32, choices=CRITERIA_TYPE_CHOICES)
    threshold = models.FloatField(default=0.0)
    reward_xp = models.IntegerField(default=0)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"BadgeDefinition({self.name})"


class StudentBadge(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='student_badges')
    badge = models.ForeignKey(BadgeDefinition, on_delete=models.CASCADE, related_name='student_badges')
    earned_at = models.DateField(null=True, blank=True)
    progress_value = models.FloatField(default=0.0)
    note = models.CharField(max_length=256, blank=True)

    class Meta:
        unique_together = [('student', 'badge')]

    def __str__(self):
        return f"{self.badge.name} earned by {self.student}"


class ChallengeDefinition(models.Model):
    name = models.CharField(max_length=128)
    slug = models.CharField(max_length=128, unique=True)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=16, blank=True)
    target_value = models.FloatField(default=0.0)
    reward_xp = models.IntegerField(default=0)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"ChallengeDefinition({self.name})"


class StudentChallenge(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='student_challenges')
    challenge = models.ForeignKey(ChallengeDefinition, on_delete=models.CASCADE, related_name='student_challenges')
    progress = models.FloatField(default=0.0)
    completed_at = models.DateField(null=True, blank=True)
    reward_claimed = models.BooleanField(default=False)

    class Meta:
        unique_together = [('student', 'challenge')]

    def __str__(self):
        return f"{self.challenge.name} progress for {self.student}"
