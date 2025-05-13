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
        pets_queryset = Pet.objects.filter(owner=user).prefetch_related(
            'headshot', # 預加載 PetHeadshot (OneToOneField)
            Prefetch(
                'illness_archives', # Pet -> IllnessArchive (related_name)
                queryset=IllnessArchive.objects.prefetch_related(
                    'illnesses__illness' # IllnessArchive -> ArchiveIllnessRelation (related_name='illnesses') -> Illness
                )
            )
        )

        result = []
        for pet_instance in pets_queryset:
            headshot_url_str = None
            if hasattr(pet_instance, 'headshot') and pet_instance.headshot and hasattr(pet_instance.headshot, 'url'):
                headshot_url_str = pet_instance.headshot.url # 使用 PetHeadshot 的 url 屬性
            
            result.append({
                "pet_id": pet_instance.id,
                "pet_name": pet_instance.pet_name,
                "pet_type": pet_instance.pet_type,
                "weight": pet_instance.weight,
                "height": pet_instance.height,
                "age": pet_instance.age,
                "breed": pet_instance.breed,
                "pet_stage": pet_instance.pet_stage,
                "predicted_adult_weight": pet_instance.predicted_adult_weight,
                "illnesses": pet_instance.all_illness_names, # 使用新的屬性方法
                "headshot_url": headshot_url_str
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
                weight=float(weight) if weight is not None and weight != '' else None, # 允許空值或None
                body_temperature=float(body_temperature) if body_temperature is not None and body_temperature != '' else None,
                water_amount=int(water_amount) if water_amount is not None and water_amount != '' else None
            )
            
            # 新增症狀關聯
            if symptoms_ids:
                abnormal_post.add_symptoms_by_ids(symptoms_ids)
            
            # 處理圖片 (假設使用 ImageService)
            if images_data: # images_data 是 request.FILES.getlist('images') 在序列化器中處理或直接用 request.FILES
                # images_data 應該是 request.FILES.getlist('images')
                # 如果序列化器已處理，這裡的 images_data 可能是文件名或已上傳的實例列表
                # 為保持一致性，假設 View 直接處理 request.FILES
                uploaded_images = request.FILES.getlist('images') # 直接從 request files 獲取
                if uploaded_images:
                    # from utils.image_service import ImageService # 確保 ImageService 被正確導入
                    # from django.contrib.contenttypes.models import ContentType
                    # abnormal_post_content_type = ContentType.objects.get_for_model(AbnormalPost)
                    
                    for index, image_file_obj in enumerate(uploaded_images):
                        try:
                            # 假設 ImageService.save_image 存在且功能如預期
                            ImageService.save_image(
                                image_file=image_file_obj,
                                owner=request.user,
                                content_object=abnormal_post, # 直接傳遞 AbnormalPost 實例
                                image_type='abnormal_post_image', # 定義一個合適的圖片類型
                                sort_order=index,
                                alt_text=f"寵物 {pet.pet_name} 的異常記錄圖片 {index+1}"
                            )
                        except Exception as img_e:
                            logger.error(f"保存異常記錄圖片時出錯: {str(img_e)}", exc_info=True)
                            # 根據需求決定是否因為單張圖片失敗而中止整個請求
            
            # 獲取完整的異常記錄資料（包括關聯的症狀和圖片）
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