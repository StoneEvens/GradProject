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
from django.contrib.contenttypes.models import ContentType
from rest_framework import status as drf_status
from django.db import transaction

#取今日熱門病程紀錄
class TodayPopularIllnessArchiveAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        archives = IllnessArchive.objects.filter(post_date=today).order_by('-popularity')[:4]
        serializer = IllnessArchiveSerializer(archives, many=True, context={'request': request})
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

# 建立異常記錄(AbnormalPost)
class CreateAbnormalPostAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request):
        """
        建立寵物異常記錄
        
        前端預期發送的資料格式:
        {
            "pet_id": 1,
            "content": "描述內容",
            "weight": 3.5,
            "body_temperature": 38.5,
            "water_amount": 500,
            "symptoms": [1, 2, 3],  # 症狀ID列表
            "images": [
                {"image_data": "base64編碼或URL"}, 
                {"image_data": "base64編碼或URL"}
            ]
        }
        """
        try:
            # 獲取基本資料
            pet_id = request.data.get('pet_id')
            content = request.data.get('content')
            weight = request.data.get('weight')
            body_temperature = request.data.get('body_temperature')
            water_amount = request.data.get('water_amount')
            symptoms_ids = request.data.get('symptoms', [])
            images_data = request.data.get('images', [])
            
            # 驗證必要資料
            if not pet_id:
                return APIResponse(
                    message="缺少寵物ID",
                    code=400,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            # 驗證寵物存在且屬於當前使用者
            try:
                pet = Pet.objects.get(id=pet_id, owner=request.user)
            except Pet.DoesNotExist:
                return APIResponse(
                    message="找不到指定的寵物或該寵物不屬於當前使用者",
                    code=404,
                    status=drf_status.HTTP_404_NOT_FOUND
                )
            
            # 建立異常記錄
            abnormal_post = AbnormalPost.objects.create(
                pet=pet,
                user=request.user,
                content=content,
                weight=float(weight) if weight else 0,
                body_temperature=float(body_temperature) if body_temperature else 0,
                water_amount=int(water_amount) if water_amount else 0
            )
            
            # 新增症狀關聯
            if symptoms_ids:
                for symptom_id in symptoms_ids:
                    try:
                        symptom = Symptom.objects.get(id=symptom_id)
                        PostSymptomsRelation.objects.create(
                            post=abnormal_post,
                            symptom=symptom
                        )
                    except Symptom.DoesNotExist:
                        # 記錄錯誤但繼續處理
                        logger.warning(f"嘗試關聯不存在的症狀ID: {symptom_id}")
            
            # 處理圖片
            if images_data:
                content_type = ContentType.objects.get_for_model(AbnormalPost)
                for index, image_data in enumerate(images_data):
                    img_url = image_data.get('image_data')
                    if img_url:
                        Image.objects.create(
                            content_type=content_type,
                            object_id=abnormal_post.id,
                            img_url=img_url,
                            sort_order=index
                        )
            
            # 獲取完整的異常記錄資料（包括關聯的症狀）
            serializer = AbnormalPostSerializer(abnormal_post)
            
            return APIResponse(
                message="異常記錄建立成功",
                data=serializer.data
            )
            
        except Exception as e:
            logger.error(f"建立異常記錄時發生錯誤: {str(e)}", exc_info=True)
            return APIResponse(
                message=f"建立異常記錄失敗: {str(e)}",
                code=500,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# 獲取所有症狀列表
class SymptomListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Symptom.objects.all()
    serializer_class = SymptomSerializer
    
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return APIResponse(
            data=serializer.data,
            message="獲取症狀列表成功"
        )

# 獲取使用者的所有異常記錄
class UserAbnormalPostListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AbnormalPostSerializer
    
    @log_queries
    def get_queryset(self):
        user = self.request.user
        # 使用select_related減少資料庫查詢
        return AbnormalPost.objects.filter(user=user).select_related(
            'pet', 'user'
        ).order_by('-created_at')
    
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        
        # 處理分頁
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return APIResponse(
            data=serializer.data,
            message="獲取異常記錄成功"
        )

# === 寵物異常貼文列表 API ===
class PetAbnormalPostsAPIView(generics.ListAPIView):
    """
    獲取特定寵物的所有異常貼文，按照時間排序
    """
    permission_classes = [IsAuthenticated]
    serializer_class = AbnormalPostSerializer
    
    @log_queries
    def get_queryset(self):
        pet_id = self.kwargs.get('pet_id')
        
        # 優化查詢 - 使用 select_related 減少數據庫查詢
        queryset = AbnormalPost.objects.filter(
            pet_id=pet_id,
            pet__owner=self.request.user  # 確保只能獲取自己寵物的記錄
        ).select_related(
            'pet', 'user'
        ).order_by('-created_at')  # 按創建時間降序排列（最新的先顯示）
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        try:
            # 確認寵物存在且屬於當前用戶
            pet_id = self.kwargs.get('pet_id')
            
            try:
                pet = Pet.objects.get(id=pet_id, owner=request.user)
            except Pet.DoesNotExist:
                return APIResponse(
                    status=drf_status.HTTP_404_NOT_FOUND,
                    message="寵物不存在或不屬於當前用戶",
                    errors={"pet_id": "寵物不存在或不屬於您"}
                )
            
            # 獲取過濾後的查詢集
            queryset = self.filter_queryset(self.get_queryset())
            
            # 處理分頁
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            
            # 如果不使用分頁
            serializer = self.get_serializer(queryset, many=True)
            
            # 構建響應
            return APIResponse(
                data=serializer.data,
                message=f"成功獲取 {pet.pet_name} 的異常貼文列表"
            )
            
        except Exception as e:
            return APIResponse(
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=f"獲取異常貼文列表失敗: {str(e)}",
                errors={"detail": str(e)}
            )