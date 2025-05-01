from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from datetime import date
from .models import *
from .serializers import *
from media.models import * 
from rest_framework import generics
from utils.api_response import APIResponse
from django.db.models import Prefetch
from utils.query_optimization import log_queries

#取今日熱門病程紀錄
class TodayPopularIllnessArchiveAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        archives = IllnessArchive.objects.filter(post_date=today).order_by('-popularity')[:4]
        serializer = IllnessArchiveSerializer(archives, many=True)
        return APIResponse(data=serializer.data)

#取得寵物資料加頭像
class UserPetsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @log_queries
    def get(self, request):
        user = request.user
        # 使用 prefetch_related 預加載相關數據，避免 N+1 查詢
        pets = Pet.objects.filter(owner=user).prefetch_related(
            'headshot',
            Prefetch(
                'illness_archives',
                queryset=IllnessArchive.objects.prefetch_related('illnesses__illness')
            )
        )

        result = []
        for pet in pets:
            # 由於已經預加載了相關數據，這裡的查詢不會觸發額外的數據庫請求
            illness_names = set()
            for archive in pet.illness_archives.all():
                for relation in archive.illnesses.all():
                    illness_names.add(relation.illness.illness_name)

            # 嘗試取得頭像圖片
            headshot_url = None
            if hasattr(pet, 'headshot') and pet.headshot:
                headshot_url = pet.headshot.img_url

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
                "illnesses": list(illness_names),
                "headshot_url": headshot_url
            })

        return APIResponse(data=result)

#列出某 user 的所有病程紀錄 (IllnessArchive)
class UserIllnessArchiveListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = IllnessArchiveSerializer
    
    @log_queries
    def get_queryset(self):
        user_id = self.kwargs['pk']
        # 正確使用 select_related 和 prefetch_related
        return IllnessArchive.objects.filter(user_id=user_id).select_related(
            'pet', 'user'
        ).prefetch_related(
            'illnesses__illness'
        ).order_by('-post_date')
    
    # 覆寫 list 方法以使用標準化響應格式（如果不使用分頁）
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        
        # 如果使用分頁，分頁類會處理響應格式
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        # 如果不使用分頁，手動使用 APIResponse
        serializer = self.get_serializer(queryset, many=True)
        return APIResponse(
            data=serializer.data,
            message="獲取病程紀錄成功"
        )