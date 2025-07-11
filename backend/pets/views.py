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
from rest_framework.parsers import MultiPartParser, FormParser
import logging

logger = logging.getLogger(__name__)

# 創建寵物 API
class CreatePetAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    @transaction.atomic
    def post(self, request):
        """
        創建新寵物
        
        請求資料格式:
        {
            "pet_name": "寵物名稱",
            "pet_type": "cat" 或 "dog",
            "breed": "品種",
            "age": 年齡(數字),
            "weight": 體重(數字),
            "height": 身高(數字),
            "pet_stage": "幼年" 或 "成年",
            "predicted_adult_weight": 預測成年體重(數字),
            "headshot": 頭像檔案(可選)
        }
        """
        try:
            # 提取資料
            pet_data = {
                'pet_name': request.data.get('pet_name'),
                'pet_type': request.data.get('pet_type'),
                'breed': request.data.get('breed'),
                'age': request.data.get('age'),
                'weight': request.data.get('weight'),
                'height': request.data.get('height'),
                'pet_stage': request.data.get('pet_stage', 'adult'),
                'predicted_adult_weight': request.data.get('predicted_adult_weight'),
                'description': request.data.get('description', ''),
                'owner': request.user.id  # 使用用戶 ID 而不是用戶對象
            }
            
            # 驗證必要欄位
            required_fields = ['pet_name', 'pet_type', 'breed', 'age', 'weight', 'height']
            missing_fields = [field for field in required_fields if not pet_data.get(field)]
            
            if missing_fields:
                return APIResponse(
                    message=f"缺少必要欄位: {', '.join(missing_fields)}",
                    code=400,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            # 創建寵物
            serializer = PetSerializer(data=pet_data)
            if serializer.is_valid():
                pet = serializer.save()
                
                # 處理頭像上傳
                headshot_file = request.FILES.get('headshot')
                if headshot_file:
                    try:
                        # 使用 Firebase 服務上傳頭像
                        from media.models import PetHeadshot
                        from utils.firebase_service import firebase_storage_service
                        
                        # 上傳到 Firebase Storage
                        success, message, firebase_url, firebase_path = firebase_storage_service.upload_pet_photo(
                            user_id=request.user.id,
                            pet_id=pet.id,
                            photo_file=headshot_file,
                            photo_type='headshot'
                        )
                        
                        if success:
                            # 儲存頭像記錄
                            PetHeadshot.objects.create(
                                pet=pet,
                                firebase_path=firebase_path,
                                firebase_url=firebase_url
                            )
                        else:
                            logger.error(f"上傳寵物頭像失敗: {message}")
                        
                    except Exception as e:
                        logger.error(f"上傳寵物頭像失敗: {str(e)}")
                        # 頭像上傳失敗不影響寵物創建
                
                # 返回包含頭像的寵物資料
                pet_data = PetSerializer(pet).data
                
                # 添加頭像 URL
                if hasattr(pet, 'headshot') and pet.headshot:
                    pet_data['headshot_url'] = pet.headshot.url
                
                return APIResponse(
                    message="寵物創建成功",
                    data=pet_data
                )
            else:
                # 記錄詳細的驗證錯誤
                logger.error(f"寵物創建驗證失敗 - 用戶: {request.user.id}, 錯誤: {serializer.errors}")
                logger.error(f"提交的資料: {pet_data}")
                
                return APIResponse(
                    message="資料驗證失敗",
                    code=400,
                    status=drf_status.HTTP_400_BAD_REQUEST,
                    errors=serializer.errors
                )
                
        except Exception as e:
            logger.error(f"創建寵物時發生錯誤: {str(e)}", exc_info=True)
            return APIResponse(
                message=f"創建寵物失敗: {str(e)}",
                code=500,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
# 更新寵物資料 API
class UpdatePetAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    @transaction.atomic
    def put(self, request, pet_id):
        """
        更新寵物資料
        
        請求資料格式:
        {
            "pet_name": "寵物名稱",
            "pet_type": "cat" 或 "dog",
            "breed": "品種",
            "age": 年齡(數字),
            "weight": 體重(數字),
            "height": 身高(數字),
            "pet_stage": "幼年" 或 "成年",
            "predicted_adult_weight": 預測成年體重(數字),
            "description": "描述",
            "headshot": 頭像檔案(可選)
        }
        """
        try:
            # 獲取寵物物件，確保是當前用戶的
            try:
                pet = Pet.objects.get(id=pet_id, owner=request.user)
            except Pet.DoesNotExist:
                return APIResponse(
                    message="找不到寵物或沒有權限編輯",
                    code=404,
                    status=drf_status.HTTP_404_NOT_FOUND
                )
            
            # 準備更新資料
            update_data = {}
            
            # 只更新有提供的欄位
            fields_to_update = [
                'pet_name', 'pet_type', 'breed', 'age', 'weight', 
                'height', 'pet_stage', 'predicted_adult_weight', 'description'
            ]
            
            for field in fields_to_update:
                if field in request.data and request.data[field] != '':
                    update_data[field] = request.data[field]
            
            # 驗證必要欄位
            if 'pet_name' in update_data and not update_data['pet_name']:
                return APIResponse(
                    message="寵物名稱不能為空",
                    code=400,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            # 使用序列化器更新
            serializer = PetSerializer(pet, data=update_data, partial=True)
            if serializer.is_valid():
                updated_pet = serializer.save()
                
                # 處理頭像更新
                headshot_file = request.FILES.get('headshot')
                if headshot_file:
                    try:
                        from media.models import PetHeadshot
                        from utils.firebase_service import firebase_storage_service
                        
                        # 刪除舊的頭像記錄
                        if hasattr(updated_pet, 'headshot') and updated_pet.headshot:
                            old_headshot = updated_pet.headshot
                            # 可以選擇是否從 Firebase 刪除舊圖片
                            try:
                                firebase_storage_service.delete_image(old_headshot.firebase_path)
                            except Exception as e:
                                logger.warning(f"刪除舊頭像失敗: {str(e)}")
                            old_headshot.delete()
                        
                        # 上傳新頭像到 Firebase Storage
                        success, message, firebase_url, firebase_path = firebase_storage_service.upload_pet_photo(
                            user_id=request.user.id,
                            pet_id=updated_pet.id,
                            photo_file=headshot_file,
                            photo_type='headshot'
                        )
                        
                        if success:
                            # 創建新的頭像記錄
                            PetHeadshot.objects.create(
                                pet=updated_pet,
                                firebase_path=firebase_path,
                                firebase_url=firebase_url
                            )
                        else:
                            logger.error(f"上傳新寵物頭像失敗: {message}")
                        
                    except Exception as e:
                        logger.error(f"更新寵物頭像失敗: {str(e)}")
                        # 頭像更新失敗不影響寵物資料更新
                
                # 返回更新後的寵物資料
                response_data = PetSerializer(updated_pet).data
                
                # 添加頭像 URL
                if hasattr(updated_pet, 'headshot') and updated_pet.headshot:
                    response_data['headshot_url'] = updated_pet.headshot.url
                
                return APIResponse(
                    message="寵物資料更新成功",
                    data=response_data
                )
            else:
                logger.error(f"寵物更新驗證失敗 - 用戶: {request.user.id}, 錯誤: {serializer.errors}")
                return APIResponse(
                    message="資料驗證失敗",
                    code=400,
                    status=drf_status.HTTP_400_BAD_REQUEST,
                    errors=serializer.errors
                )
                
        except Exception as e:
            logger.error(f"更新寵物時發生錯誤: {str(e)}", exc_info=True)
            return APIResponse(
                message=f"更新寵物失敗: {str(e)}",
                code=500,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

#取今日熱門病程紀錄
class TodayPopularIllnessArchiveAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        archives = ForumContent.objects.filter(post_date=today).order_by('-popularity')[:4]
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
            'headshot',  # 預加載 PetHeadshot (OneToOneField)
            Prefetch(
            'illness_archives',  # Pet -> IllnessArchive (related_name)
            queryset=ForumContent.objects.prefetch_related(
                'illnesses__illness'  # IllnessArchive -> ArchiveIllnessRelation (related_name='illnesses') -> Illness
            )
            )
        )

        username = request.user

        pets = Pet.get_pet(user=username)
        archives = ForumContent.get_content(pets=pets)
        illnesses = ArchiveIllnessRelation.get_illnesses(archives=archives)

        # 你可以這樣獲取每隻寵物的所有疾病名稱
        # 假設 Pet model 有一個 @property all_illness_names
        # 否則你可以這樣取得:
        # illness_names = set()
        # for archive in pet_instance.illness_archives.all():
        #     for rel in archive.illnesses.all():
        #         illness_names.add(rel.illness.name)
        # illness_names = list(illness_names)

        result = []
        for pet in pets:
            headshot_url_str = None
            if hasattr(pet, 'headshot') and pet.headshot:
                headshot_url_str = pet.headshot.url # 使用 PetHeadshot 的 url 屬性（現在是 property）

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
                "description": pet.description,
                "illnesses": illnesses, # 使用新的屬性方法
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
    
    # 覆寫 list 方法以使用標準化響應格式（如果不使用分頁）
    def list(self, request, *args, **kwargs):
        username = self.kwargs['pk']
        user = CustomUser.get_user(username=username)
        forumContents = ForumContent.get_content(user=user)
        
        # 如果使用分頁，分頁類會處理響應格式
        page = self.paginate_queryset(forumContents)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        # 如果不使用分頁，手動使用 APIResponse
        serializer = self.get_serializer(forumContents, many=True)
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