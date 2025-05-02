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
from utils.image_service import ImageService

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

        # 預加載所有寵物的頭像
        image_map = {}
        try:
            # 對於每個寵物，獲取頭像
            pet_ids = list(pets.values_list('id', flat=True))
            pet_headshots = {}
            
            if pet_ids:
                from pets.models import PetHeadshot
                # 批量獲取所有頭像
                headshots = PetHeadshot.objects.filter(pet_id__in=pet_ids)
                for headshot in headshots:
                    pet_headshots[headshot.pet_id] = headshot.img_url.url if hasattr(headshot.img_url, 'url') else None
        except Exception as e:
            logger.error(f"預加載寵物頭像時發生錯誤: {str(e)}", exc_info=True)
            # 如果發生錯誤，繼續處理其他數據，僅記錄錯誤

        result = []
        for pet in pets:
            # 由於已經預加載了相關數據，這裡的查詢不會觸發額外的數據庫請求
            illness_names = set()
            for archive in pet.illness_archives.all():
                for relation in archive.illnesses.all():
                    illness_names.add(relation.illness.illness_name)

            # 從預加載的頭像中獲取 URL
            headshot_url = pet_headshots.get(pet.id)

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

        return APIResponse(
            message="成功獲取寵物列表",
            data=result
        )

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