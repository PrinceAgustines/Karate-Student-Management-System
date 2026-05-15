from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .models import CustomUser
from .serializers import CustomTokenObtainPairSerializer, RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class ParentTokenObtainView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        parent_id = request.data.get('parent_id', '').strip().upper()
        password = request.data.get('password', '') or ''

        if not parent_id:
            return Response({'parent_id': 'Parent ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if not password:
            return Response({'password': 'Password is required for parent login.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = CustomUser.objects.get(username__iexact=parent_id, role='parent')
        except CustomUser.DoesNotExist:
            return Response({'parent_id': 'Parent account not found.'}, status=status.HTTP_400_BAD_REQUEST)

        if not user.is_active:
            return Response({'detail': 'Parent account is inactive.'}, status=status.HTTP_403_FORBIDDEN)

        if not user.check_password(password):
            return Response({'password': 'Invalid password for this Parent ID.'}, status=status.HTTP_400_BAD_REQUEST)

        refresh = RefreshToken.for_user(user)
        return Response({'refresh': str(refresh), 'access': str(refresh.access_token)}, status=status.HTTP_200_OK)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user
