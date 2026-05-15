from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.password_validation import validate_password
from .models import CustomUser
from students.models import SystemID


class UserSerializer(serializers.ModelSerializer):
    student_id = serializers.SerializerMethodField()
    current_belt_rank = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ['id', 'email', 'username', 'first_name', 'last_name', 'role', 'student_id', 'current_belt_rank']

    def get_student_id(self, obj):
        if obj.role != 'student':
            return None
        try:
            system_id = SystemID.objects.get(code__iexact=obj.username, id_type='student', assigned_student__isnull=False)
            return system_id.assigned_student.student_id
        except SystemID.DoesNotExist:
            return None

    def get_current_belt_rank(self, obj):
        if obj.role != 'student':
            return None
        try:
            system_id = SystemID.objects.get(code__iexact=obj.username, id_type='student', assigned_student__isnull=False)
            return system_id.assigned_student.current_belt_rank
        except SystemID.DoesNotExist:
            return None


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = CustomUser
        fields = ['email', 'username', 'first_name', 'last_name', 'role', 'password', 'password2']
        extra_kwargs = {
            'email': {'required': False, 'allow_blank': True},
            'username': {'required': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
            'role': {'required': True},
        }

    def validate(self, attrs):
        role = attrs.get('role')
        password = attrs.get('password', '') or ''
        password2 = attrs.get('password2', '') or ''

        if not password or not password2:
            raise serializers.ValidationError({
                'password': 'Password and confirmation are required for this account type.'
            })

        if password != password2:
            raise serializers.ValidationError({
                'password': 'Password fields did not match.'
            })

        try:
            validate_password(password)
        except serializers.ValidationError as exc:
            raise serializers.ValidationError({'password': exc.messages})

        username = attrs.get('username', '').strip().upper()
        attrs['username'] = username

        if role == 'parent':
            try:
                parent_id = SystemID.objects.get(code__iexact=username)
            except SystemID.DoesNotExist:
                raise serializers.ValidationError({
                    'username': 'A valid parent ID is required for parent registration.'
                })

            if parent_id.id_type != 'parent':
                raise serializers.ValidationError({
                    'username': 'The provided ID is not a parent ID.'
                })

            if parent_id.status == 'assigned':
                raise serializers.ValidationError({
                    'username': 'This parent ID has already been used.'
                })

            # Mark the parent ID as assigned when registering
            parent_id.status = 'assigned'
            parent_id.save()

            if not attrs.get('email'):
                attrs['email'] = username

        if role != 'parent' and not attrs.get('email'):
            raise serializers.ValidationError({
                'email': 'Email is required for non-parent accounts.'
            })

        return attrs

    def create(self, validated_data):
        validated_data.pop('password2', None)
        password = validated_data.pop('password', '') or ''
        if validated_data.get('role') == 'parent' and not validated_data.get('email'):
            validated_data['email'] = validated_data.get('username')

        user = CustomUser(**validated_data)
        user.set_password(password)
        user.save()
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = CustomUser.USERNAME_FIELD
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def validate(self, attrs):
        # Try standard email-based authentication first.
        credentials = {
            self.username_field: attrs.get(self.username_field),
            'password': attrs.get('password'),
        }
        user = authenticate(**credentials)

        # If that fails, allow login using the username field (system-generated ID).
        if user is None and attrs.get(self.username_field):
            username = attrs.get(self.username_field)
            try:
                user_obj = CustomUser.objects.get(username__iexact=username)
            except CustomUser.DoesNotExist:
                user_obj = None
            if user_obj is not None:
                if user_obj.role == 'parent' and (not attrs.get('password')):
                    user = user_obj
                elif user_obj.check_password(attrs.get('password')):
                    user = user_obj
                if user is not None:
                    attrs[self.username_field] = getattr(user, self.username_field)

        if user is None or not user.is_active:
            raise AuthenticationFailed(
                self.error_messages['no_active_account'],
                'no_active_account',
            )

        attrs[self.username_field] = getattr(user, self.username_field)
        self.user = user
        return super().validate(attrs)
