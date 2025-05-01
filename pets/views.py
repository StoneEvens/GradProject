from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from datetime import date
from .models import *
from .serializers import *
from media.models import * 
from rest_framework import generics

#取今日熱門病程紀錄
class TodayPopularIllnessArchiveAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        archives = IllnessArchive.objects.filter(post_date=today).order_by('-popularity')[:4]
        serializer = IllnessArchiveSerializer(archives, many=True)
        return Response(serializer.data)

#取得寵物資料加頭像
class UserPetsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        pets = Pet.objects.filter(owner=user)

        result = []
        for pet in pets:
            illness_names = list(set(
                relation.illness.illness_name
                for archive in pet.illness_archives.all()
                for relation in archive.illnesses.all()
            ))

            # 嘗試取得頭像圖片
            try:
                headshot_url = pet.headshot.img_url
            except PetHeadshot.DoesNotExist:
                headshot_url = None

            result.append({
                "pet_id": pet.id,
                "pet_name": pet.pet_name,
                "pet_type": pet.pet_type,
                "weight": pet.weight,
                "height": pet.height,
                "age": pet.age,
                "breed": pet.breed,
                "pet_stage": pet.pet_stage,
                "predicted_adult_weight": pet.predicted_adult_weight,
                "illnesses": illness_names,
                "headshot_url": headshot_url
            })

        return Response(result)

#列出某 user 的所有病程紀錄 (IllnessArchive)
class UserIllnessArchiveListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = IllnessArchiveSerializer

    def get_queryset(self):
        user_id = self.kwargs['pk']
        return IllnessArchive.objects.filter(user_id=user_id).order_by('-post_date')