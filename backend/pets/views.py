from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from datetime import date
from django.utils import timezone
from django.apps import apps
from interactions.models import UserInteraction
from social.models import PostFrame
from comments.models import Comment
from .models import *
from .serializers import *
from media.models import AbnormalPostImage 
from rest_framework import generics
from utils.api_response import APIResponse
from django.db.models import Prefetch
from utils.query_optimization import log_queries
from utils.image_service import ImageService
from django.contrib.contenttypes.models import ContentType
from rest_framework import status as drf_status
from django.db import transaction
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
import logging
from openai import OpenAI, APIError
from dotenv import load_dotenv
import os

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
        archives = DiseaseArchiveContent.objects.filter(post_date=today).order_by('-popularity')[:4]
        serializer = DiseaseArchiveContentSerializer(archives, many=True, context={'request': request})
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
            queryset=DiseaseArchiveContent.objects.prefetch_related(
                'illnesses__illness'  # IllnessArchive -> ArchiveIllnessRelation (related_name='illnesses') -> Illness
            )
            )
        )

        username = request.user

        pets = Pet.get_pet(user=username)
        archives = DiseaseArchiveContent.get_content(pets=pets)
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
                "headshot_url": headshot_url_str,
                "owner": pet.owner.id if pet.owner else None  # 添加寵物主人ID
            })

        return APIResponse(
            message="成功獲取寵物列表",
            data=result
        )

#列出某 user 的所有病程紀錄 (IllnessArchive)
class UserIllnessArchiveListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DiseaseArchiveContentSerializer
    
    # 覆寫 list 方法以使用標準化響應格式（如果不使用分頁）
    def list(self, request, *args, **kwargs):
        username = self.kwargs['pk']
        user = CustomUser.get_user(username=username)
        forumContents = DiseaseArchiveContent.get_content(user=user)
        
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
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    
    @transaction.atomic
    def post(self, request):
        """
        建立寵物異常記錄
        
        前端預期發送的資料格式:
        {
            "pet": {"id": 1},  # 寵物物件
            "date": "2025-07-22T00:00:00.000Z",  # 日期 
            "isEmergency": true,  # 是否為就醫記錄
            "symptoms": [{"id": 1, "text": "打噴嚏"}],  # 症狀列表
            "bodyStats": {
                "weight": "3.5",
                "waterIntake": "0.5", 
                "temperature": "38.5"
            },
            "description": "描述內容",
            "images": [base64圖片資料]  # 圖片陣列
        }
        """
        try:
            # 獲取前端發送的資料
            pet_data = request.data.get('pet', {})
            pet_id = pet_data.get('id') if isinstance(pet_data, dict) else None
            description = request.data.get('description', '')
            body_stats = request.data.get('bodyStats', {})
            symptoms_data = request.data.get('symptoms', [])
            images_data = request.data.get('images', [])
            is_emergency = request.data.get('isEmergency', False)
            
            # 從 bodyStats 中提取數值
            weight = body_stats.get('weight', '') if body_stats else ''
            water_intake = body_stats.get('waterIntake', '') if body_stats else ''
            temperature = body_stats.get('temperature', '') if body_stats else ''
            
            # 驗證必要資料
            if not pet_id:
                return APIResponse(
                    message="缺少寵物ID",
                    code=400,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            # 驗證症狀資料
            if not symptoms_data:
                return APIResponse(
                    message="請至少選擇一個症狀",
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
            
            # 處理記錄日期
            from datetime import datetime
            record_date = request.data.get('date')
            if record_date:
                try:
                    # 解析 ISO 日期字串
                    parsed_date = datetime.fromisoformat(record_date.replace('Z', '+00:00'))
                except:
                    parsed_date = None
            else:
                parsed_date = None
            
            # 檢查同一天是否已有該寵物的異常記錄
            if parsed_date:
                # 將日期時間轉為當天的開始和結束
                from datetime import timezone
                date_start = parsed_date.replace(hour=0, minute=0, second=0, microsecond=0)
                date_end = parsed_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                
                # 查詢該寵物在該日期是否已有異常記錄
                existing_post = AbnormalPost.objects.filter(
                    pet=pet,
                    record_date__range=(date_start, date_end)
                ).first()
                
                if existing_post:
                    return APIResponse(
                        message=f"該寵物在 {parsed_date.strftime('%Y年%m月%d日')} 已經有異常記錄，每天每隻寵物只能建立一則異常記錄",
                        code=400,
                        status=drf_status.HTTP_400_BAD_REQUEST
                    )
            
            # 建立異常記錄
            abnormal_post = AbnormalPost.objects.create(
                pet=pet,
                user=request.user,
                content=description,
                weight=float(weight) if weight and weight != '' else None,
                body_temperature=float(temperature) if temperature and temperature != '' else None,
                water_amount=int(float(water_intake) * 1000) if water_intake and water_intake != '' else None,  # 轉換公升為毫升
                is_emergency=is_emergency,
                record_date=parsed_date
            )
            
            # 新增症狀關聯
            if symptoms_data:
                for symptom_item in symptoms_data:
                    symptom_text = None
                    
                    if isinstance(symptom_item, dict):
                        # 處理字典格式 {"text": "症狀名稱"}
                        symptom_text = symptom_item.get('text', '').strip()
                    elif isinstance(symptom_item, str):
                        # 處理純字符串格式
                        symptom_text = symptom_item.strip()
                    else:
                        logger.warning(f"不支援的症狀資料格式: {type(symptom_item)} - {symptom_item}")
                        continue
                    
                    # 驗證症狀名稱是否為有效格式（防止JSON字符串被插入）
                    if symptom_text and not symptom_text.startswith('{') and not symptom_text.startswith('[') and len(symptom_text) <= 50:
                        try:
                            # 只查找現有症狀，不創建新症狀
                            symptom = Symptom.objects.filter(symptom_name=symptom_text).first()
                            
                            if symptom:
                                # 建立關聯
                                PostSymptomsRelation.objects.get_or_create(
                                    post=abnormal_post,
                                    symptom=symptom
                                )
                                logger.info(f"建立症狀關聯: {symptom_text}")
                            else:
                                logger.warning(f"找不到對應的症狀: {symptom_text}")
                                
                        except Exception as symptom_e:
                            logger.error(f"建立症狀關聯時出錯: {str(symptom_e)}")
                            continue
                    else:
                        logger.warning(f"無效的症狀名稱被拒絕: {symptom_text}")
            
            # 處理圖片
            if images_data:
                import base64
                import io
                from django.core.files.uploadedfile import InMemoryUploadedFile
                from utils.firebase_service import firebase_storage_service
                
                for index, image_item in enumerate(images_data):
                    try:
                        # 處理前端發送的圖片資料格式
                        if isinstance(image_item, dict):
                            # 格式: {"dataUrl": "data:image/jpeg;base64,/9j/4AAQ...", "name": "image.jpg"}
                            data_url = image_item.get('dataUrl', '')
                            file_name = image_item.get('name', f'abnormal_image_{index}.jpg')
                        else:
                            # 直接是 base64 字串
                            data_url = str(image_item)
                            file_name = f'abnormal_image_{index}.jpg'
                        
                        if data_url and 'base64,' in data_url:
                            # 解析 base64 資料
                            header, data = data_url.split('base64,', 1)
                            
                            # 取得檔案類型
                            if 'image/png' in header:
                                file_extension = '.png'
                                content_type = 'image/png'
                            elif 'image/jpeg' in header or 'image/jpg' in header:
                                file_extension = '.jpg'
                                content_type = 'image/jpeg'
                            else:
                                file_extension = '.jpg'
                                content_type = 'image/jpeg'
                            
                            # 解碼 base64
                            image_data = base64.b64decode(data)
                            image_file = io.BytesIO(image_data)
                            
                            # 建立 Django 檔案物件
                            if not file_name.endswith(file_extension):
                                file_name = f"{file_name.split('.')[0]}{file_extension}"
                            
                            django_file = InMemoryUploadedFile(
                                image_file,
                                None,
                                file_name,
                                content_type,
                                len(image_data),
                                None
                            )
                            
                            # 使用 Firebase Storage 服務上傳圖片
                            success, message, firebase_url, firebase_path = firebase_storage_service.upload_abnormal_record_image(
                                user_id=request.user.id,
                                pet_id=pet.id,
                                image_file=django_file,
                                sort_order=index
                            )
                            
                            if success:
                                # 使用新的 AbnormalPostImage 模型創建圖片記錄
                                AbnormalPostImage.create_from_upload(
                                    abnormal_post=abnormal_post,
                                    firebase_url=firebase_url,
                                    firebase_path=firebase_path,
                                    sort_order=index,
                                    original_filename=file_name,
                                    content_type=content_type,
                                    file_size=len(image_data)
                                )
                                logger.info(f"異常記錄圖片 {index+1} 上傳成功: {firebase_url}")
                            else:
                                logger.error(f"異常記錄圖片 {index+1} 上傳到 Firebase 失敗: {message}")
                            
                    except Exception as img_e:
                        logger.error(f"保存異常記錄圖片時出錯: {str(img_e)}", exc_info=True)
                        # 圖片失敗不影響整體建立，繼續處理
            
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
        user = self.request.user
        
        # 優化查詢 - 使用 select_related 減少數據庫查詢
        queryset = AbnormalPost.objects.filter(
            pet_id=pet_id,
            pet__owner=user  # 確保只能獲取自己寵物的記錄
        ).select_related(
            'pet', 'user'
        ).order_by('-created_at')  # 按創建時間降序排列（最新的先顯示）
        
        # 隱私控制：如果不是記錄的建立者，則過濾掉私人記錄
        if hasattr(self.request, 'viewing_other_user') and self.request.viewing_other_user:
            queryset = queryset.filter(is_private=False)
        else:
            # 如果是寵物主人查看，可以看到所有記錄
            # 但其他用戶只能看到非私人記錄
            try:
                pet = Pet.objects.get(id=pet_id)
                if pet.owner != user:
                    queryset = queryset.filter(is_private=False)
            except Pet.DoesNotExist:
                queryset = queryset.none()
        
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

class PetAbnormalPostsPreviewAPIView(generics.ListAPIView):
    """
    獲取特定寵物的異常貼文預覽列表
    只返回基本信息：症狀、日期、是否為就醫記錄
    """
    permission_classes = [IsAuthenticated]
    serializer_class = AbnormalPostPreviewSerializer
    
    @log_queries
    def get_queryset(self):
        pet_id = self.kwargs.get('pet_id')
        
        # 優化查詢 - 使用 prefetch_related 預載症狀關聯
        queryset = AbnormalPost.objects.filter(
            pet_id=pet_id,
            pet__owner=self.request.user  # 確保只能獲取自己寵物的記錄
        ).select_related('pet').prefetch_related(
            Prefetch('symptoms', 
                    queryset=PostSymptomsRelation.objects.select_related('symptom'))
        ).order_by('-record_date')  # 按記錄日期降序排列
        
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
                    message="找不到指定的寵物或您沒有權限查看",
                    errors={"pet_id": "寵物不存在或無權限"}
                )
            
            # 獲取queryset
            queryset = self.get_queryset()
            
            # 序列化數據
            serializer = self.get_serializer(queryset, many=True)
            
            # 構建響應
            return APIResponse(
                data=serializer.data,
                message=f"成功獲取 {pet.pet_name} 的異常貼文預覽列表"
            )
            
        except Exception as e:
            logger.error(f"獲取異常貼文預覽列表失敗: {str(e)}")
            return APIResponse(
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=f"獲取異常貼文預覽列表失敗: {str(e)}",
                errors={"detail": str(e)}
            )

class AbnormalPostDetailAPIView(APIView):
    """
    獲取特定異常貼文的詳細資訊
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pet_id, post_id):
        try:
            # 確認寵物存在
            try:
                pet = Pet.objects.get(id=pet_id)
            except Pet.DoesNotExist:
                return APIResponse(
                    status=drf_status.HTTP_404_NOT_FOUND,
                    message="找不到指定的寵物",
                    errors={"pet_id": "寵物不存在"}
                )
            
            # 獲取異常貼文詳細資訊
            try:
                abnormal_post = AbnormalPost.objects.select_related(
                    'pet', 'user'
                ).prefetch_related(
                    Prefetch('symptoms', 
                            queryset=PostSymptomsRelation.objects.select_related('symptom'))
                ).get(
                    id=post_id,
                    pet_id=pet_id
                )
                
                # 隱私檢查：只有記錄建立者或非私人記錄才能查看
                if abnormal_post.is_private and abnormal_post.user != request.user:
                    return APIResponse(
                        status=drf_status.HTTP_403_FORBIDDEN,
                        message="這是私人記錄，您沒有權限查看",
                        errors={"permission": "無權限查看私人記錄"}
                    )
                
            
            except AbnormalPost.DoesNotExist:
                return APIResponse(
                    status=drf_status.HTTP_404_NOT_FOUND,
                    message="找不到指定的異常貼文",
                    errors={"post_id": "異常貼文不存在"}
                )
            
            # 序列化數據
            serializer = AbnormalPostSerializer(abnormal_post)
            
            return APIResponse(
                data=serializer.data,
                message=f"成功獲取異常貼文詳情"
            )
            
        except Exception as e:
            logger.error(f"獲取異常貼文詳情失敗: {str(e)}")
            return APIResponse(
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=f"獲取異常貼文詳情失敗: {str(e)}",
                errors={"detail": str(e)}
            )


class PublicAbnormalPostDetailAPIView(APIView):
    """
    獲取公開異常貼文的詳細資訊（無需認證）
    """
    permission_classes = [AllowAny]
    
    def get(self, request, post_id):
        try:
            # 獲取公開異常貼文詳細資訊
            try:
                abnormal_post = AbnormalPost.objects.select_related(
                    'pet', 'user'
                ).prefetch_related(
                    Prefetch('symptoms', 
                            queryset=PostSymptomsRelation.objects.select_related('symptom'))
                ).get(
                    id=post_id,
                    is_private=False  # 只允許訪問公開貼文
                )
                
            except AbnormalPost.DoesNotExist:
                return APIResponse(
                    status=drf_status.HTTP_404_NOT_FOUND,
                    message="找不到指定的公開異常貼文",
                    errors={"post_id": "公開異常貼文不存在"}
                )
            
            # 序列化數據
            serializer = PublicAbnormalPostSerializer(abnormal_post)
            
            return APIResponse(
                data=serializer.data,
                message=f"成功獲取公開異常貼文詳情"
            )
            
        except Exception as e:
            logger.error(f"獲取公開異常貼文詳情失敗: {str(e)}")
            return APIResponse(
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=f"獲取公開異常貼文詳情失敗: {str(e)}",
                errors={"detail": str(e)}
            )


class UpdateAbnormalPostAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    
    @transaction.atomic
    def put(self, request, pet_id, post_id):
        """
        更新寵物異常記錄
        
        前端預期發送的資料格式:
        {
            "pet": {"id": 1},  # 寵物物件
            "date": "2025-07-22T00:00:00.000Z",  # 日期 
            "isEmergency": true,  # 是否為就醫記錄
            "symptoms": [{"id": 1, "text": "打噴嬑"}],  # 症狀列表
            "bodyStats": {
                "weight": "3.5",
                "waterIntake": "0.5", 
                "temperature": "38.5"
            },
            "description": "描述內容",
            "images": [
                {"id": 1, "isExisting": true},  # 現有圖片
                {"dataUrl": "base64...", "isExisting": false}  # 新圖片
            ]
        }
        """
        try:
            # 獲取前端發送的資料
            pet_data = request.data.get('pet', {})
            request_pet_id = pet_data.get('id') if isinstance(pet_data, dict) else None
            description = request.data.get('description', '')
            body_stats = request.data.get('bodyStats', {})
            symptoms_data = request.data.get('symptoms', [])
            images_data = request.data.get('images', [])
            is_emergency = request.data.get('isEmergency', False)
            
            # 從 bodyStats 中提取數值
            weight = body_stats.get('weight', '') if body_stats else ''
            water_intake = body_stats.get('waterIntake', '') if body_stats else ''
            temperature = body_stats.get('temperature', '') if body_stats else ''
            
            # 驗證必要資料
            if not request_pet_id:
                return APIResponse(
                    message="缺少寵物ID",
                    code=400,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
                
            
            # 驗證症狀資料
            if not symptoms_data:
                return APIResponse(
                    message="請至少選擇一個症狀",
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
            
            # 驗證異常記錄存在且屬於當前使用者
            try:
                abnormal_post = AbnormalPost.objects.get(
                    id=post_id,
                    pet__owner=request.user
                )
            except AbnormalPost.DoesNotExist:
                return APIResponse(
                    message="找不到指定的異常記錄",
                    code=404,
                    status=drf_status.HTTP_404_NOT_FOUND
                )
            
            # 檢查是否切換了寵物 (注意：pet_id 來自 URL，是選中的寵物，要與異常記錄的原始寵物比較)
            original_pet_id = abnormal_post.pet.id  # 異常記錄的原始寵物ID
            selected_pet_id = int(request_pet_id)   # 用戶選中的寵物ID
            pet_changed = selected_pet_id != original_pet_id
            
            # 處理記錄日期
            from datetime import datetime
            record_date = request.data.get('date')
            if record_date:
                try:
                    # 解析 ISO 日期字串
                    parsed_date = datetime.fromisoformat(record_date.replace('Z', '+00:00'))
                except:
                    parsed_date = abnormal_post.record_date
            else:
                parsed_date = abnormal_post.record_date
            
            # 驗證目標寵物存在且屬於當前使用者
            try:
                target_pet = Pet.objects.get(id=request_pet_id, owner=request.user)
            except Pet.DoesNotExist:
                return APIResponse(
                    message="找不到指定的目標寵物或該寵物不屬於當前使用者",
                    code=404,
                    status=drf_status.HTTP_404_NOT_FOUND
                )
            
            # 直接更新異常記錄（包括寵物關聯）
            abnormal_post.pet = target_pet  # 直接修改寵物關聯
            abnormal_post.content = description
            abnormal_post.weight = float(weight) if weight and weight != '' else None
            abnormal_post.body_temperature = float(temperature) if temperature and temperature != '' else None
            abnormal_post.water_amount = int(float(water_intake) * 1000) if water_intake and water_intake != '' else None
            abnormal_post.is_emergency = is_emergency
            abnormal_post.record_date = parsed_date
            abnormal_post.save()
            
            if pet_changed:
                print(f"[DEBUG] 寵物切換: 從 pet_id={original_pet_id} 切換到 pet_id={selected_pet_id}")
                logger.info(f"寵物切換: 從 {original_pet_id} 切換到 {selected_pet_id}")
            
            # 更新症狀關聯
            PostSymptomsRelation.objects.filter(post=abnormal_post).delete()
            
            if symptoms_data:
                for symptom_item in symptoms_data:
                    symptom_text = None
                    
                    if isinstance(symptom_item, dict):
                        # 處理字典格式 {"text": "症狀名稱"}
                        symptom_text = symptom_item.get('text', '').strip()
                    elif isinstance(symptom_item, str):
                        # 處理純字符串格式
                        symptom_text = symptom_item.strip()
                    
                    if not symptom_text:
                        continue
                    
                    # 只找現有的症狀，不創建新的
                    symptom = Symptom.objects.filter(symptom_name=symptom_text).first()
                    if symptom:
                        PostSymptomsRelation.objects.create(
                            post=abnormal_post,
                            symptom=symptom
                        )
                    else:
                        logger.warning(f"找不到症狀: {symptom_text}")
            
            # 處理圖片更新 (即使 images_data 為空也要處理，因為可能需要刪除現有圖片)
            images_data = images_data if images_data is not None else []
            
            # 導入必要的模組 (移到前面避免作用域問題)
            import base64
            import io
            import requests
            from django.core.files.uploadedfile import InMemoryUploadedFile
            from utils.firebase_service import firebase_storage_service
            
            # 獲取現有圖片
            existing_images = list(AbnormalPostImage.objects.filter(
                abnormal_post=abnormal_post
            ))
            
            # 處理圖片操作
            keep_image_ids = set()
            
            for index, image_item in enumerate(images_data):
                if isinstance(image_item, dict):
                    if image_item.get('isExisting', False):
                        # 保留現有圖片
                        existing_id = image_item.get('id')
                        if existing_id:
                            # 確保 ID 是整數類型
                            try:
                                existing_id = int(existing_id)
                                
                                # 檢查是否切換了寵物，如果是則需要重新上傳圖片到新路徑
                                if pet_changed:
                                    print(f"[DEBUG] 偵測到寵物切換，需要重新上傳圖片 ID={existing_id}")
                                    
                                    # 找到對應的現有圖片
                                    existing_image = next((img for img in existing_images if img.id == existing_id), None)
                                    if existing_image and existing_image.firebase_url:
                                        print(f"[DEBUG] 處理現有圖片重新上傳: 舊路徑={existing_image.firebase_path}")
                                        print(f"[DEBUG] 舊 Firebase URL: {existing_image.firebase_url}")
                                        # 下載現有圖片並重新上傳到新寵物路徑
                                        try:
                                            
                                            # 下載原圖片
                                            response = requests.get(existing_image.firebase_url)
                                            if response.status_code == 200:
                                                image_data = response.content
                                                image_file = io.BytesIO(image_data)
                                                
                                                # 確定檔案類型
                                                content_type = existing_image.content_type_mime or 'image/jpeg'
                                                file_extension = '.jpg' if 'jpeg' in content_type else '.png'
                                                file_name = existing_image.original_filename or f'abnormal_image_{index}{file_extension}'
                                                
                                                # 建立 Django 檔案物件
                                                django_file = InMemoryUploadedFile(
                                                    image_file,
                                                    None,
                                                    file_name,
                                                    content_type,
                                                    len(image_data),
                                                    None
                                                )
                                                
                                                # 上傳到新寵物路徑
                                                print(f"[DEBUG] 準備上傳到新路徑: user_id={request.user.id}, pet_id={target_pet.id}")
                                                success, message, new_firebase_url, new_firebase_path = firebase_storage_service.upload_abnormal_record_image(
                                                    user_id=request.user.id,
                                                    pet_id=target_pet.id,  # 使用新寵物ID
                                                    image_file=django_file,
                                                    sort_order=index
                                                )
                                                
                                                if success:
                                                    print(f"[DEBUG] 圖片重新上傳成功: 新路徑={new_firebase_path}")
                                                    print(f"[DEBUG] 新 Firebase URL: {new_firebase_url}")
                                                    # 刪除舊的 Firebase 圖片
                                                    if existing_image.firebase_path:
                                                        print(f"[DEBUG] 準備刪除舊圖片: {existing_image.firebase_path}")
                                                        delete_success, delete_message = firebase_storage_service.delete_image(existing_image.firebase_path)
                                                        print(f"[DEBUG] 刪除舊圖片結果: success={delete_success}, message={delete_message}")
                                                    
                                                    # 更新現有圖片記錄
                                                    existing_image.firebase_url = new_firebase_url
                                                    existing_image.firebase_path = new_firebase_path
                                                    existing_image.save()
                                                    print(f"[DEBUG] 圖片記錄已更新，新路徑已保存")
                                                    
                                                    keep_image_ids.add(existing_id)
                                                else:
                                                    # 如果重新上傳失敗，仍然保留原圖片
                                                    keep_image_ids.add(existing_id)
                                            else:
                                                keep_image_ids.add(existing_id)
                                        except Exception as reupload_error:
                                            keep_image_ids.add(existing_id)
                                    else:
                                        keep_image_ids.add(existing_id)
                                else:
                                    # 沒有切換寵物，正常保留圖片
                                    keep_image_ids.add(existing_id)
                                    
                            except (ValueError, TypeError):
                                pass
                    else:
                        # 新增圖片 - 使用與創建時相同的邏輯
                        data_url = image_item.get('dataUrl', '')
                        file_name = image_item.get('name', f'abnormal_image_{index}.jpg')
                        
                        if data_url and 'base64,' in data_url:
                            try:
                                # 使用與創建時相同的 Firebase 上傳邏輯
                                
                                # 解析 base64 資料
                                header, data = data_url.split('base64,', 1)
                                
                                # 取得檔案類型
                                if 'image/png' in header:
                                    file_extension = '.png'
                                    content_type = 'image/png'
                                elif 'image/jpeg' in header or 'image/jpg' in header:
                                    file_extension = '.jpg'
                                    content_type = 'image/jpeg'
                                else:
                                    file_extension = '.jpg'
                                    content_type = 'image/jpeg'
                                
                                # 解碼 base64
                                image_data = base64.b64decode(data)
                                image_file = io.BytesIO(image_data)
                                
                                # 建立 Django 檔案物件
                                if not file_name.endswith(file_extension):
                                    file_name = f"{file_name.split('.')[0]}{file_extension}"
                                
                                django_file = InMemoryUploadedFile(
                                    image_file,
                                    None,
                                    file_name,
                                    content_type,
                                    len(image_data),
                                    None
                                )
                                
                                # 使用 Firebase Storage 服務上傳圖片 (使用目標寵物ID)
                                success, message, firebase_url, firebase_path = firebase_storage_service.upload_abnormal_record_image(
                                    user_id=request.user.id,
                                    pet_id=target_pet.id,  # 使用目標寵物ID，支援寵物切換
                                    image_file=django_file,
                                    sort_order=index
                                )
                                
                                if success:
                                    # 使用新的 AbnormalPostImage 模型創建圖片記錄
                                    AbnormalPostImage.create_from_upload(
                                        abnormal_post=abnormal_post,
                                        firebase_url=firebase_url,
                                        firebase_path=firebase_path,
                                        sort_order=index,
                                        original_filename=file_name,
                                        content_type=content_type,
                                        file_size=len(image_data)
                                    )
                                    
                            except Exception as img_error:
                                pass
            
            # 刪除不再使用的圖片 - 使用與創建時兼容的刪除邏輯
            for existing_image in existing_images:
                if existing_image.id not in keep_image_ids:
                    try:
                        # 從 Firebase Storage 刪除圖片
                        if existing_image.firebase_path:
                            delete_success, delete_message = firebase_storage_service.delete_image(existing_image.firebase_path)
                        
                        # 從資料庫刪除記錄
                        existing_image.delete()
                    except Exception as delete_error:
                        pass
            
            # 返回更新後的資料
            serializer = AbnormalPostSerializer(abnormal_post)
            
            return APIResponse(
                data=serializer.data,
                message="異常記錄更新成功",
                code=200,
                status=drf_status.HTTP_200_OK
            )
            
        except Exception as e:
            logger.error(f"更新異常記錄失敗: {str(e)}")
            return APIResponse(
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=f"更新異常記錄失敗: {str(e)}",
                errors={"detail": str(e)}
            )

class DeleteAbnormalPostAPIView(APIView):
    """
    刪除寵物異常記錄
    """
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def delete(self, request, pet_id, post_id):
        try:
            # 驗證寵物存在且屬於當前使用者
            try:
                pet = Pet.objects.get(id=pet_id, owner=request.user)
            except Pet.DoesNotExist:
                return APIResponse(
                    message="找不到指定的寵物或該寵物不屬於當前使用者",
                    code=404,
                    status=drf_status.HTTP_404_NOT_FOUND
                )
            
            # 驗證異常記錄存在且屬於當前使用者
            try:
                abnormal_post = AbnormalPost.objects.get(
                    id=post_id,
                    pet__owner=request.user
                )
            except AbnormalPost.DoesNotExist:
                return APIResponse(
                    message="找不到指定的異常記錄",
                    code=404,
                    status=drf_status.HTTP_404_NOT_FOUND
                )
            
            # 導入必要的模組
            from utils.firebase_service import firebase_storage_service
            
            # 刪除關聯的圖片
            existing_images = list(AbnormalPostImage.objects.filter(
                abnormal_post=abnormal_post
            ))
            
            # 從 Firebase Storage 和資料庫中刪除圖片
            for image in existing_images:
                try:
                    # 從 Firebase Storage 刪除圖片
                    if image.firebase_path:
                        delete_success, delete_message = firebase_storage_service.delete_image(image.firebase_path)
                        if delete_success:
                            logger.info(f"成功從 Firebase 刪除圖片: {image.firebase_path}")
                        else:
                            logger.warning(f"從 Firebase 刪除圖片失敗: {image.firebase_path}, {delete_message}")
                    
                    # 從資料庫刪除圖片記錄
                    image.delete()
                except Exception as img_error:
                    logger.error(f"刪除圖片時發生錯誤: {str(img_error)}")
            
            # 刪除症狀關聯
            PostSymptomsRelation.objects.filter(post=abnormal_post).delete()
            
            # 刪除異常記錄
            pet_name = abnormal_post.pet.pet_name
            record_date = abnormal_post.record_date
            abnormal_post.delete()
            
            logger.info(f"用戶 {request.user.id} 成功刪除異常記錄 {post_id}")
            
            return APIResponse(
                message=f"已成功刪除 {pet_name} 在 {record_date.strftime('%Y-%m-%d')} 的異常記錄",
                code=200,
                status=drf_status.HTTP_200_OK
            )
            
        except Exception as e:
            logger.error(f"刪除異常記錄失敗: {str(e)}")
            return APIResponse(
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=f"刪除異常記錄失敗: {str(e)}",
                errors={"detail": str(e)}
            )


# 載入 OpenAI API 金鑰
load_dotenv()
api_key = os.getenv('OPENAI_API_KEY')

# 初始化 OpenAI client（只在有 API key 時初始化）
if api_key:
    client = OpenAI(api_key=api_key)
else:
    client = None
    logger.warning("OpenAI API key not found. Disease archive generation will not be available.")


class GenerateDiseaseArchiveContentAPIView(APIView):
    """
    生成疾病檔案內容預覽 - 使用GPT整理異常記錄（不儲存到資料庫）
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]
    
    def post(self, request):
        """
        接收疾病檔案資料，使用GPT整理異常記錄，返回生成的內容預覽（不儲存到資料庫）
        """
        try:
            data = request.data
            user = request.user
            
            # 驗證必要欄位
            pet_id = data.get('petId')
            archive_title = data.get('archiveTitle', '').strip()
            main_cause = data.get('mainCause', '').strip()
            symptoms = data.get('symptoms', [])
            included_post_ids = data.get('includedAbnormalPostIds', [])
            
            if not pet_id:
                return APIResponse(
                    message="請提供寵物ID",
                    code=400,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            if not included_post_ids:
                return APIResponse(
                    message="請選擇至少一筆異常記錄",
                    code=400,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            # 驗證寵物是否屬於該用戶
            try:
                pet = Pet.objects.get(id=pet_id, owner=user)
            except Pet.DoesNotExist:
                return APIResponse(
                    message="找不到該寵物或您沒有權限",
                    code=404,
                    status=drf_status.HTTP_404_NOT_FOUND
                )
            
            # 獲取異常記錄數據 (排除圖片)
            abnormal_posts = AbnormalPost.objects.filter(
                id__in=included_post_ids,
                pet=pet
            ).prefetch_related('symptoms__symptom').order_by('record_date')
            
            if not abnormal_posts.exists():
                return APIResponse(
                    message="沒有找到相關的異常記錄",
                    code=400,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            # 準備GPT輸入數據
            gpt_input_data = self._prepare_gpt_input(pet, abnormal_posts, symptoms, main_cause)
            
            # 呼叫GPT生成疾病檔案內容
            generated_content = self._generate_disease_archive_content(gpt_input_data)
            
            if not generated_content:
                return APIResponse(
                    message="生成疾病檔案內容失敗，請稍後再試",
                    code=500,
                    status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            logger.info(f"用戶 {user.id} 成功生成疾病檔案內容預覽，寵物ID: {pet_id}")
            
            # 只返回生成的內容，不儲存到資料庫
            return APIResponse(
                data={
                    'generated_content': generated_content,
                    'pet_name': pet.pet_name,
                    'archive_title': archive_title,
                    'included_posts_count': len(included_post_ids),
                    'main_symptoms': [s.get('text', '') for s in symptoms] if symptoms else [],
                    'main_cause': main_cause or '未指定主要病因'
                },
                message="疾病檔案內容生成成功",
                code=200,
                status=drf_status.HTTP_200_OK
            )
            
        except Exception as e:
            logger.error(f"生成疾病檔案內容失敗: {str(e)}")
            return APIResponse(
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=f"生成疾病檔案內容失敗: {str(e)}",
                errors={"detail": str(e)}
            )
    
    def _prepare_gpt_input(self, pet, abnormal_posts, symptoms, main_cause):
        """
        準備GPT輸入數據
        """
        # 基本信息
        pet_info = f"{pet.pet_name}（{pet.pet_type}，{pet.age}歲）"
        
        # 症狀信息
        symptom_list = [s.get('text', '') for s in symptoms] if symptoms else []
        symptoms_text = '、'.join(symptom_list) if symptom_list else '未指定'
        
        # 異常記錄信息
        posts_data = []
        for post in abnormal_posts:
            post_symptoms = [rel.symptom.symptom_name for rel in post.symptoms.all()]
            post_data = {
                'date': post.record_date.strftime('%Y年%m月%d日'),
                'symptoms': '、'.join(post_symptoms) if post_symptoms else '無症狀記錄',
                'content': post.content or '無補充描述',
                'weight': f"{post.weight}公斤" if post.weight else '未記錄',
                'body_temperature': f"{post.body_temperature}度" if post.body_temperature else '未記錄',
                'water_amount': f"{post.water_amount/1000}公升" if post.water_amount else '未記錄',
                'is_emergency': '是就醫記錄' if post.is_emergency else '非就醫記錄'
            }
            posts_data.append(post_data)
        
        return {
            'pet_info': pet_info,
            'main_cause': main_cause or '未指定主要病因',
            'main_symptoms': symptoms_text,
            'posts_data': posts_data,
            'duration': f"從{posts_data[0]['date']}到{posts_data[-1]['date']}" if len(posts_data) > 1 else posts_data[0]['date']
        }
    
    def _generate_disease_archive_content(self, input_data):
        """
        使用GPT生成疾病檔案內容
        """
        try:
            logger.info("開始生成疾病檔案內容...")
            
            # 構建prompt
            posts_detail = "\n\n".join([
                f"【{post['date']}】\n"
                f"症狀: {post['symptoms']}\n"
                f"補充描述: {post['content']}\n"
                f"體重: {post['weight']}\n"
                f"體溫: {post['body_temperature']}\n"
                f"喝水量: {post['water_amount']}\n"
                f"就醫情況: {post['is_emergency']}"
                for post in input_data['posts_data']
            ])
            
            prompt = f"""
請幫我整理以下寵物的疾病檔案資料：

寵物資訊: {input_data['pet_info']}
主要病因: {input_data['main_cause']}
主要症狀: {input_data['main_symptoms']}
病程時長: {input_data['duration']}

詳細異常記錄:
{posts_detail}

請按照以下格式整理：

1. 開頭概述：簡要描述疾病檔案的整體情況，包含病程時長、主要症狀等
2. 日期分段記錄：按日期順序整理每筆異常記錄，每個日期段落必須以「X月X日」格式開頭，格式如「X月X日我發現XXX出現XXX症狀，XXXX。我覺得這是整個病程的XXX，XXX為此後幾日主要的不適表現。」
3. 總結與回顧：對整個生病時期進行總結，包含病程發展、症狀變化、康復情況等

重要注意事項：
- 每個日期段落都必須以「X月X日」格式作為段落開頭，這是前端系統識別和插入異常記錄預覽的關鍵標識
- 若異常記錄超過10筆，請自行判斷選出最重要的10個日期作為獨立段落（每段都以「X月X日」開頭）
- 其他日期的資訊請整合成不含具體日期的過渡段落，用於描述病程發展和症狀變化趨勢
- 過渡段落請避免使用任何日期格式（如「X月X日」、「X年X月X日」），改用「期間」、「接下來幾天」、「症狀持續」等描述方式
- 這樣設計是為了確保前端系統能正確識別日期段落並插入對應的異常記錄預覽

請務必使用第一人稱主人視角撰寫，以「我」的角度描述觀察到的寵物狀況和感受。語調親切自然，就像主人在記錄自己寵物的病程日記一樣。請直接開始內容，不要加上任何標題前綴。
"""
            
            if not client:
                logger.error("OpenAI client not initialized. Please check API key configuration.")
                return None
            
            logger.info("正在調用 GPT API...")
            
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system", 
                        "content": "你是一名專業的寵物醫療記錄整理師。請用中文提供清楚、詳細的內容整理。內容必須使用第一人稱主人視角撰寫，以「我」的角度描述觀察到的寵物狀況，就像主人在寫寵物的日記。語調要親切自然，充滿關愛之情。請不要使用markdown格式，使用純文字格式即可。請直接開始內容，不要加上任何標題前綴如'xxx的病程記錄'等。"
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.3,
                timeout=50  # 設置 GPT API 超時時間
            )
            
            generated_content = response.choices[0].message.content.strip()
            
            # 移除標頭（1. 開頭概述：、2. 日期分段記錄：、3. 總結與回顧：）
            import re
            # 移除數字開頭的標頭格式
            generated_content = re.sub(r'^[1-3]\.\s*(開頭概述|日期分段記錄|總結與回顧)[：:]\s*\n?', '', generated_content, flags=re.MULTILINE)
            # 移除單獨的標頭行
            generated_content = re.sub(r'^(開頭概述|日期分段記錄|總結與回顧)[：:]\s*\n?', '', generated_content, flags=re.MULTILINE)
            # 清理多餘的空行
            generated_content = re.sub(r'\n{3,}', '\n\n', generated_content)
            
            logger.info(f"成功生成疾病檔案內容，長度: {len(generated_content)} 字元")
            
            return generated_content
            
        except APIError as e:
            logger.error(f"GPT API錯誤: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"生成疾病檔案內容失敗: {str(e)}")
            return None


# 獲取單一寵物詳細資訊 API (for ArchiveCard)
class PetDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pet_id):
        """
        獲取特定寵物的詳細資訊
        
        回傳格式:
        {
            "code": 200,
            "message": "查詢成功",
            "success": true,
            "data": {
                "pet_id": 1,
                "pet_name": "咪咪",
                "breed": "橘貓",
                "pet_type": "cat",
                "age": 3,
                "weight": 4.5,
                "headshot_url": "http://example.com/image.jpg"
            }
        }
        """
        try:
            # 檢查寵物是否存在且屬於當前用戶
            pet = Pet.objects.select_related('headshot').filter(
                id=pet_id,
                owner=request.user
            ).first()
            
            if not pet:
                return APIResponse(
                    data=None,
                    message="找不到指定的寵物或無權限訪問",
                    code=404,
                    success=False
                )
            
            # 取得頭像 URL
            headshot_url = None
            if hasattr(pet, 'headshot') and pet.headshot:
                headshot_url = pet.headshot.url
            
            # 準備回傳資料
            pet_data = {
                "pet_id": pet.id,
                "pet_name": pet.pet_name,
                "breed": pet.breed,
                "pet_type": pet.pet_type,
                "age": pet.age,
                "weight": pet.weight,
                "headshot_url": headshot_url
            }
            
            return APIResponse(
                data=pet_data,
                message="查詢成功",
                code=200,
                success=True
            )
            
        except Exception as e:
            logger.error(f"獲取寵物詳細資訊失敗: {str(e)}")
            return APIResponse(
                data=None,
                message="獲取寵物資訊失敗，請稍後再試",
                code=500,
                success=False
            )


class CreateDiseaseArchiveAPIView(APIView):
    """
    建立疾病檔案 API - 儲存到資料庫
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    @transaction.atomic
    def post(self, request):
        """
        建立疾病檔案，儲存到資料庫
        
        請求資料格式:
        {
            "petId": 1,
            "archiveTitle": "咪咪的感冒紀錄",
            "generatedContent": "AI生成的統整內容",
            "mainCause": "病毒性感冒",
            "symptoms": [{"text": "發燒"}, {"text": "咳嗽"}],
            "includedAbnormalPostIds": [1, 2, 3],
            "goToDoctor": true,
            "healthStatus": "已康復",
            "isPrivate": true
        }
        """
        try:
            data = request.data
            user = request.user
            
            # 驗證必要欄位
            pet_id = data.get('petId')
            archive_title = data.get('archiveTitle', '').strip()
            generated_content = data.get('generatedContent', '').strip()
            main_cause = data.get('mainCause', '').strip()
            symptoms = data.get('symptoms', [])
            included_post_ids = data.get('includedAbnormalPostIds', [])
            go_to_doctor = data.get('goToDoctor', False)
            health_status = data.get('healthStatus', '').strip()
            is_private = data.get('isPrivate', True)
            
            if not pet_id:
                return APIResponse(
                    message="請提供寵物ID",
                    code=400,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            if not archive_title:
                return APIResponse(
                    message="請提供檔案標題",
                    code=400,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            if not generated_content:
                return APIResponse(
                    message="請提供檔案內容",
                    code=400,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            if not included_post_ids:
                return APIResponse(
                    message="請選擇至少一筆異常記錄",
                    code=400,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            # 驗證寵物是否屬於該用戶
            try:
                pet = Pet.objects.get(id=pet_id, owner=user)
            except Pet.DoesNotExist:
                return APIResponse(
                    message="找不到該寵物或您沒有權限",
                    code=404,
                    status=drf_status.HTTP_404_NOT_FOUND
                )
            
            # 驗證異常記錄是否存在且屬於該用戶的寵物
            abnormal_posts = AbnormalPost.objects.filter(
                id__in=included_post_ids,
                pet=pet,
                user=user
            ).order_by('record_date')
            
            if abnormal_posts.count() != len(included_post_ids):
                return APIResponse(
                    message="部分異常記錄不存在或您沒有權限",
                    code=400,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            # 處理內容格式 - 將AI統整和abnormalpost preview標記一併存入content
            formatted_content = self._format_content_with_previews(
                generated_content, abnormal_posts
            )
            
            # 建立PostFrame
            from social.models import PostFrame
            post_frame = PostFrame.objects.create(user=user)
            
            # 建立疾病檔案
            disease_archive = DiseaseArchiveContent.objects.create(
                archive_title=archive_title,
                content=formatted_content,
                go_to_doctor=go_to_doctor,
                health_status=health_status,
                pet=pet,
                postFrame=post_frame,
                is_private=is_private
            )
            
            # 建立異常記錄關聯
            archive_post_relations = []
            for abnormal_post in abnormal_posts:
                archive_post_relations.append(
                    ArchiveAbnormalPostRelation(
                        archive=disease_archive,
                        post=abnormal_post
                    )
                )
            ArchiveAbnormalPostRelation.objects.bulk_create(archive_post_relations)
            
            # 處理主要病因
            if main_cause:
                illness, created = Illness.objects.get_or_create(
                    illness_name=main_cause
                )
                ArchiveIllnessRelation.objects.create(
                    archive=disease_archive,
                    illness=illness
                )
            
            # 如果是公開檔案，加入推薦系統
            if not is_private:
                try:
                    from django.apps import apps
                    recommendation_service = apps.get_app_config('social').get_recommendation_service()
                    recommendation_service.embed_new_post(post_id=post_frame.id, content=formatted_content, content_type='forum')
                except Exception as e:
                    logger.error(f"添加疾病檔案到推薦系統失敗: {str(e)}")
            
            logger.info(f"用戶 {user.id} 成功建立疾病檔案，ID: {disease_archive.id}")
            
            # 序列化回傳資料
            serializer = DiseaseArchiveContentSerializer(
                disease_archive, 
                context={'request': request}
            )
            
            return APIResponse(
                data=serializer.data,
                message="疾病檔案建立成功",
                code=201,
                status=drf_status.HTTP_201_CREATED
            )
            
        except Exception as e:
            logger.error(f"建立疾病檔案失敗: {str(e)}")
            return APIResponse(
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=f"建立疾病檔案失敗: {str(e)}",
                code=500
            )
    
    def _format_content_with_previews(self, generated_content, abnormal_posts):
        """
        將AI統整內容和abnormalpost preview標記格式化
        使用特殊標記來標示preview位置，方便後續顯示時識別
        """
        import re
        from datetime import datetime
        
        # 建立日期到abnormal post的映射
        date_to_posts = {}
        for post in abnormal_posts:
            if post.record_date:
                date_key = post.record_date.strftime('%m月%d日')
                if date_key not in date_to_posts:
                    date_to_posts[date_key] = []
                date_to_posts[date_key].append(post)
        
        # 在生成內容中找到日期段落，插入preview標記
        lines = generated_content.split('\n')
        formatted_lines = []
        
        for line in lines:
            formatted_lines.append(line)
            
            # 檢查是否為日期段落開頭
            date_match = re.match(r'^(\d{1,2})月(\d{1,2})日', line.strip())
            if date_match:
                month = int(date_match.group(1))
                day = int(date_match.group(2))
                date_key = f"{month}月{day}日"
                
                # 如果有對應的abnormal posts，插入preview標記
                if date_key in date_to_posts:
                    for post in date_to_posts[date_key]:
                        preview_marker = f"[ABNORMAL_POST_PREVIEW:{post.id}]"
                        formatted_lines.append(preview_marker)
        
        return '\n'.join(formatted_lines)


class GetMyDiseaseArchivesPreviewAPIView(APIView):
    """
    獲取用戶的疾病檔案預覽列表
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """
        獲取當前用戶所有疾病檔案的預覽資訊
        
        回傳格式:
        {
            "code": 200,
            "message": "查詢成功",
            "success": true,
            "data": [
                {
                    "id": 1,
                    "archive_title": "咪咪的感冒紀錄",
                    "pet_name": "咪咪",
                    "created_at": "2025-08-06T10:30:00",
                    "health_status": "已康復",
                    "illness_names": ["病毒性感冒"]
                }
            ]
        }
        """
        try:
            user = request.user
            
            # 獲取用戶所有的疾病檔案（包括私人的）
            archives = DiseaseArchiveContent.objects.filter(
                postFrame__user=user
            ).select_related(
                'pet', 'postFrame'
            ).prefetch_related(
                'illnesses__illness'
            ).order_by('-postFrame__created_at')
            
            # 序列化資料
            preview_data = []
            for archive in archives:
                illness_names = [
                    relation.illness.illness_name 
                    for relation in archive.illnesses.all()
                ]
                
                preview_data.append({
                    'id': archive.id,
                    'archive_title': archive.archive_title,
                    'pet_name': archive.pet.pet_name if archive.pet else '未知',
                    'created_at': archive.postFrame.created_at if archive.postFrame else None,
                    'health_status': archive.health_status,
                    'illness_names': illness_names,
                    'is_private': archive.is_private
                })
            
            return APIResponse(
                data=preview_data,
                message="查詢成功",
                code=200,
                success=True
            )
            
        except Exception as e:
            logger.error(f"獲取疾病檔案預覽列表失敗: {str(e)}")
            return APIResponse(
                data=None,
                message="獲取資料失敗，請稍後再試",
                code=500,
                success=False
            )


class RecommendedDiseaseArchivesAPIView(APIView):
    """
    獲取推薦的疾病檔案列表（基於用戶的互動歷史）
    
    查詢參數:
    - limit: 限制返回數量 (預設: 10, 最大: 50)
    - offset: 分頁偏移量 (預設: 0)
    - sort: 排序方式 (recommendation|latest|popular, 預設: recommendation)
    
    回傳格式:
    {
        "code": 200,
        "message": "獲取推薦疾病檔案成功",
        "success": true,
        "data": {
            "archives": [...],
            "has_more": false,
            "total_count": 10,
            "recommendation_type": "personalized|latest|popular"
        }
    }
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            # 獲取查詢參數
            limit = min(int(request.query_params.get('limit', 10)), 50)  # 最大5個
            offset = int(request.query_params.get('offset', 0))
            sort_type = request.query_params.get('sort', 'recommendation')  # recommendation|latest|popular
            
            from django.apps import apps
            from interactions.models import UserInteraction
            from comments.models import Comment
            from social.models import PostFrame
            
            # 如果指定非推薦排序，直接返回相應結果
            if sort_type == 'latest':
                return self._get_latest_archives(request, limit, offset)
            elif sort_type == 'popular':
                return self._get_popular_archives(request, limit, offset)
            
            # 以下是推薦系統邏輯
            recommendation_service = apps.get_app_config('social').get_recommendation_service()
            
            # 收集用戶與疾病檔案的互動歷史
            history = self._collect_disease_interaction_history(request.user)
            
            seen_ids = {p['id'] for p in history}
            
            # 如果沒有歷史記錄，返回最新公開疾病檔案
            if not history:
                logger.info(f"用戶 {request.user.id} 沒有疾病檔案互動歷史，返回最新公開疾病檔案")
                return self._get_latest_archives_with_pagination(request, limit, offset, "latest")
            
            # 使用推薦系統獲取疾病檔案推薦
            try:
                if len(history) > 0:
                    embedded_history = recommendation_service.embed_user_history(posts=[(p['id'], p['action'], p['timestamp']) for p in history], content_type='forum')
                    search_results = recommendation_service.recommend_posts(
                        user_vec=embedded_history,
                        content_type='forum',
                        top_k=30+len(history),  # 獲取更多結果以支援分頁和過濾
                    )
                    
                    recommended_ids = []
                    for result in search_results:
                        original_post_id = result['original_id']
                        if original_post_id not in seen_ids:
                            recommended_ids.append(original_post_id)
                
                # 根據推薦的 PostFrame IDs 獲取對應的疾病檔案
                if recommended_ids:
                    return self._get_recommended_archives_with_pagination(
                        request, recommended_ids, limit, offset, "personalized"
                    )
                else:
                    # 如果沒有推薦結果，返回最新公開疾病檔案
                    logger.info(f"推薦系統沒有結果，返回最新疾病檔案")
                    return self._get_latest_archives_with_pagination(request, limit, offset, "latest")
                    
            except Exception as rec_error:
                logger.error(f"推薦系統錯誤: {str(rec_error)}")
                # 推薦系統出錯時，返回最新疾病檔案
                return self._get_latest_archives_with_pagination(request, limit, offset, "latest")
                
        except Exception as e:
            logger.error(f"獲取推薦疾病檔案失敗: {str(e)}", exc_info=True)
            return APIResponse(
                message="獲取推薦疾病檔案失敗",
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _collect_disease_interaction_history(self, user):
        """收集用戶與疾病檔案的互動歷史"""
        history = []
        
        try:
            from interactions.models import UserInteraction
            from comments.models import Comment
            from social.models import PostFrame
            
            # 獲取用戶與疾病檔案的互動歷史
            interaction_list = UserInteraction.objects.filter(user=user).values()
            for interaction in interaction_list:
                try:
                    postFrame = PostFrame.objects.get(id=interaction['interactables_id'])
                    # 檢查是否有關聯的疾病檔案
                    if hasattr(postFrame, 'illness_archives_postFrame') and postFrame.illness_archives_postFrame.exists():
                        disease_archive = postFrame.illness_archives_postFrame.first()
                        if disease_archive and not disease_archive.is_private:
                            history.append({
                                "id": interaction['interactables_id'],
                                "action": interaction['relation'],
                                "timestamp": int(interaction['created_at'].timestamp())
                            })
                except PostFrame.DoesNotExist:
                    continue
            
            # 處理疾病檔案的留言歷史
            comment_list = Comment.objects.filter(user=user).select_related('postFrame')
            for comment in comment_list:
                postFrame = comment.postFrame
                if hasattr(postFrame, 'illness_archives_postFrame') and postFrame.illness_archives_postFrame.exists():
                    disease_archive = postFrame.illness_archives_postFrame.first()
                    if disease_archive and not disease_archive.is_private:
                        history.append({
                            "id": postFrame.id,
                            "action": "comment", 
                            "timestamp": int(comment.created_at.timestamp())
                        })
            
            return history
            
        except Exception as e:
            logger.error(f"收集疾病檔案互動歷史失敗: {str(e)}")
            return []
    
    def _get_latest_archives(self, request, limit, offset):
        """獲取最新疾病檔案"""
        return self._get_latest_archives_with_pagination(request, limit, offset, "latest")
    
    def _get_popular_archives(self, request, limit, offset):
        """獲取熱門疾病檔案"""
        try:
            archives_queryset = DiseaseArchiveContent.objects.filter(
                is_private=False
            ).select_related(
                'postFrame', 'pet'
            ).prefetch_related(
                'illnesses__illness'
            ).order_by('-postFrame__likes')  # 按讚數排序
            
            total_count = archives_queryset.count()
            archives = archives_queryset[offset:offset + limit]
            has_more = offset + limit < total_count
            
            serializer = DiseaseArchiveContentSerializer(
                archives, many=True, context={'request': request}
            )
            
            return APIResponse(
                data={
                    'archives': serializer.data,
                    'has_more': has_more,
                    'total_count': total_count,
                    'recommendation_type': 'popular'
                },
                message="獲取熱門疾病檔案成功"
            )
            
        except Exception as e:
            logger.error(f"獲取熱門疾病檔案失敗: {str(e)}")
            return APIResponse(
                message="獲取熱門疾病檔案失敗",
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _get_latest_archives_with_pagination(self, request, limit, offset, recommendation_type):
        """獲取最新疾病檔案（帶分頁）"""
        try:
            archives_queryset = DiseaseArchiveContent.objects.filter(
                is_private=False
            ).select_related(
                'postFrame', 'pet'
            ).prefetch_related(
                'illnesses__illness'
            ).order_by('-postFrame__created_at')
            
            total_count = archives_queryset.count()
            archives = archives_queryset[offset:offset + limit]
            has_more = offset + limit < total_count
            
            serializer = DiseaseArchiveContentSerializer(
                archives, many=True, context={'request': request}
            )
            
            return APIResponse(
                data={
                    'archives': serializer.data,
                    'has_more': has_more,
                    'total_count': total_count,
                    'recommendation_type': recommendation_type
                },
                message="獲取最新疾病檔案成功"
            )
            
        except Exception as e:
            logger.error(f"獲取最新疾病檔案失敗: {str(e)}")
            return APIResponse(
                message="獲取最新疾病檔案失敗",
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _get_recommended_archives_with_pagination(self, request, recommended_ids, limit, offset, recommendation_type):
        """根據推薦ID獲取疾病檔案（帶分頁）"""
        try:
            # 應用分頁到推薦ID列表
            paginated_ids = recommended_ids[offset:offset + limit]
            has_more = offset + limit < len(recommended_ids)
            
            if not paginated_ids:
                return APIResponse(
                    data={
                        'archives': [],
                        'has_more': False,
                        'total_count': 0,
                        'recommendation_type': recommendation_type
                    },
                    message="沒有更多推薦結果"
                )
            
            # 根據推薦的 PostFrame IDs 獲取對應的疾病檔案
            archives = DiseaseArchiveContent.objects.filter(
                postFrame__id__in=paginated_ids,
                is_private=False
            ).select_related(
                'postFrame', 'pet'
            ).prefetch_related(
                'illnesses__illness'
            )
            
            # 按照推薦順序排序
            archives_dict = {archive.postFrame.id: archive for archive in archives}
            ordered_archives = [archives_dict[post_id] for post_id in paginated_ids if post_id in archives_dict]
            
            serializer = DiseaseArchiveContentSerializer(
                ordered_archives, many=True, context={'request': request}
            )
            
            return APIResponse(
                data={
                    'archives': serializer.data,
                    'has_more': has_more,
                    'total_count': len(recommended_ids),
                    'recommendation_type': recommendation_type
                },
                message="獲取推薦疾病檔案成功"
            )
            
        except Exception as e:
            logger.error(f"獲取推薦疾病檔案失敗: {str(e)}")
            return APIResponse(
                message="獲取推薦疾病檔案失敗",
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DiseaseArchiveDetailAPIView(APIView):
    """
    獲取單一疾病檔案詳細資訊
    """
    permission_classes = [IsAuthenticated]
    
    def _get_user_headshot_url(self, user):
        """獲取用戶頭像URL"""
        try:
            from media.models import UserHeadshot
            return UserHeadshot.get_headshot_url(user)
        except:
            return None 
    
    def get(self, request, archive_id):
        """
        獲取特定疾病檔案的詳細資訊
        
        回傳格式:
        {
            "code": 200,
            "message": "查詢成功",
            "success": true,
            "data": {
                "id": 1,
                "archive_title": "咪咪的感冒紀錄",
                "content": "AI統整內容與異常記錄標記",
                "pet_name": "咪咪",
                "created_at": "2025-08-06T10:30:00",
                "health_status": "已康復",
                "go_to_doctor": true,
                "main_cause": "病毒性感冒",
                "abnormal_posts": [...],
                "is_private": true
            }
        }
        """
        try:
            user = request.user
            
            # 獲取疾病檔案
            archive = DiseaseArchiveContent.objects.select_related(
                'pet', 'postFrame'
            ).prefetch_related(
                'illnesses__illness',
                'abnormal_posts__post__symptoms__symptom'
            ).filter(
                id=archive_id
            ).first()
            
            if not archive:
                return APIResponse(
                    data=None,
                    message="找不到該疾病檔案",
                    code=404,
                    success=False
                )
            
            # 檢查權限
            if archive.is_private and archive.postFrame.user != user:
                return APIResponse(
                    data=None,
                    message="您沒有權限查看此疾病檔案",
                    code=403,
                    success=False
                )
            
            # 獲取主要病因
            main_cause = ""
            illness_relations = archive.illnesses.all()
            if illness_relations:
                main_cause = illness_relations[0].illness.illness_name
            
            # 獲取關聯的異常記錄
            abnormal_posts = []
            for relation in archive.abnormal_posts.all():
                post = relation.post
                symptoms_data = []
                for symptom_relation in post.symptoms.all():
                    symptoms_data.append({
                        'id': symptom_relation.symptom.id,
                        'symptom_name': symptom_relation.symptom.symptom_name
                    })
                
                abnormal_posts.append({
                    'id': post.id,
                    'record_date': post.record_date,
                    'is_emergency': post.is_emergency,
                    'symptoms': symptoms_data,
                    'content': post.content
                })
            
            # 序列化器會自動處理互動統計和用戶互動狀態
            
            # 使用序列化器確保數據一致性和完整性
            serializer = DiseaseArchiveContentSerializer(
                archive, 
                context={'request': request}
            )
            archive_data = serializer.data
            
            # 添加手動構建的異常貼文數據
            archive_data['abnormal_posts'] = abnormal_posts
            archive_data['main_cause'] = main_cause
            
            return APIResponse(
                data=archive_data,
                message="查詢成功",
                code=200,
                success=True
            )
            
        except Exception as e:
            logger.error(f"獲取疾病檔案詳細資訊失敗: {str(e)}")
            return APIResponse(
                data=None,
                message="獲取資料失敗，請稍後再試",
                code=500,
                success=False
            )


class PublicDiseaseArchivesPreviewAPIView(APIView):
    """
    獲取所有公開疾病檔案預覽列表（用於社群頁面寵物論壇）
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """
        獲取所有公開疾病檔案的預覽資訊
        
        查詢參數:
        - offset: 偏移量，預設為 0
        - limit: 限制數量，預設為 10，最大 50
        
        回傳格式: 使用 DiseaseArchiveContentSerializer 序列化數據，包含完整的互動狀態
        """
        try:
            # 獲取分頁參數
            offset = int(request.query_params.get('offset', 0))
            limit = min(int(request.query_params.get('limit', 10)), 50)  # 最大50個

            recommendation_service = apps.get_app_config('social').get_recommendation_service()

            history = []
            recommend_list = []

            interaction_list = UserInteraction.objects.filter(user=self.request.user).values()
            for interaction in interaction_list:
                # 先假設用戶互動的是PostFrame，把按讚留言紀錄過濾掉
                postFrame = PostFrame.get_postFrames(postID=interaction['interactables_id'])

                # 根據找到的PostFrame獲取DiseaseArchiveContent(若不是DiseaseArchiveContent則忽略)
                if postFrame is not None:
                    diseaseArchiveContent = DiseaseArchiveContent.get_content(postFrame=postFrame)

                    if diseaseArchiveContent.exists():
                        history.append({
                            "id": interaction['interactables_id'],
                            "action": interaction['relation'],
                            "timestamp": int(interaction['created_at'].timestamp())
                        })

            # 接者處理留言的歷史
            comment_list = Comment.objects.filter(user=self.request.user).select_related('postFrame')
            for comment in comment_list:
                # 還是先抓留言來自哪個PostFrame
                postFrame = comment.postFrame

                # 根據找到的PostFrame獲取DiseaseArchiveContent(若不是DiseaseArchiveContent則忽略)
                if postFrame is not None:
                    diseaseArchiveContent = DiseaseArchiveContent.get_content(postFrame=postFrame)

                    if diseaseArchiveContent.exists():
                        history.append({
                            "id": postFrame.id,
                            "action": "comment",
                            "timestamp": int(comment.created_at.timestamp())
                        })

            seen_ids = {p['id'] for p in history}

            if len(history) > 0:
                print(len(history), "條互動歷史")

                embedded_history = recommendation_service.embed_user_history(posts=[(p['id'], p['action'], p['timestamp']) for p in history], content_type="forum")
                search_list = recommendation_service.recommend_posts(user_vec=embedded_history, top_k=30+len(seen_ids), content_type="forum")

                for post_id in search_list:
                    if post_id not in seen_ids:
                        # Do something with each recommended post ID
                        recommend_list.append(post_id)

                archives_queryset = DiseaseArchiveContent.objects.filter(postFrame__id__in=recommend_list, is_private=False).select_related(
                    'pet', 'postFrame', 'postFrame__user'
                ).prefetch_related(
                    'illnesses__illness',
                    'pet__headshot',
                    'postFrame__user__headshot'
                ).order_by('-postFrame__created_at')

            else:
                # 如果沒有互動歷史，則不進行推薦
                print("沒有互動歷史")

                archives_queryset = DiseaseArchiveContent.objects.filter(
                    is_private=False  # 只獲取公開的檔案
                ).select_related(
                    'pet', 'postFrame', 'postFrame__user'
                ).prefetch_related(
                    'illnesses__illness',
                    'pet__headshot',
                    'postFrame__user__headshot'
                ).order_by('-postFrame__created_at')

            # 計算總數
            total_count = archives_queryset.count()
            
            # 分頁
            archives = archives_queryset[offset:offset + limit]
            has_more = offset + limit < total_count
            
            # 使用序列化器確保包含互動數據
            serializer = DiseaseArchiveContentSerializer(
                archives, 
                many=True, 
                context={'request': request}
            )
            preview_data = serializer.data
            
            return APIResponse(
                data={
                    'archives': preview_data,
                    'has_more': has_more,
                    'total_count': total_count,
                    'offset': offset,
                    'limit': limit
                },
                message="查詢成功",
                code=200,
                success=True
            )
            
        except ValueError as e:
            return APIResponse(
                data=None,
                message="分頁參數錯誤",
                code=400,
                success=False
            )
        except Exception as e:
            logger.error(f"獲取公開疾病檔案預覽列表失敗: {str(e)}")
            return APIResponse(
                data=None,
                message="獲取資料失敗，請稍後再試",
                code=500,
                success=False
            )


class UserPublicDiseaseArchivesPreviewAPIView(APIView):
    """
    獲取指定用戶的公開疾病檔案預覽列表（用於用戶個人頁面論壇部分）
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, user_id=None):
        """
        獲取指定用戶公開疾病檔案的預覽資訊
        如果沒有提供 user_id，則獲取當前用戶的公開檔案
        
        查詢參數:
        - offset: 偏移量，預設為 0
        - limit: 限制數量，預設為 10，最大 50
        
        回傳格式:
        {
            "code": 200,
            "message": "查詢成功",
            "success": true,
            "data": {
                "archives": [...],
                "has_more": true,
                "total_count": 5,
                "offset": 0,
                "limit": 10
            }
        }
        """
        try:
            # 獲取目標用戶
            if user_id:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                try:
                    target_user = User.objects.get(id=user_id)
                except User.DoesNotExist:
                    return APIResponse(
                        data=None,
                        message="用戶不存在",
                        code=404,
                        success=False
                    )
            else:
                target_user = request.user
            
            # 獲取分頁參數
            offset = int(request.query_params.get('offset', 0))
            limit = min(int(request.query_params.get('limit', 10)), 50)  # 最大50個
            
            # 獲取該用戶的公開疾病檔案
            archives_queryset = DiseaseArchiveContent.objects.filter(
                postFrame__user=target_user,
                is_private=False  # 只獲取公開的檔案
            ).select_related(
                'pet', 'postFrame', 'postFrame__user'
            ).prefetch_related(
                'illnesses__illness',
                'pet__headshot',
                'postFrame__user__headshot'
            ).order_by('-postFrame__created_at')
            
            # 計算總數
            total_count = archives_queryset.count()
            
            # 分頁
            archives = archives_queryset[offset:offset + limit]
            has_more = offset + limit < total_count
            
            # 使用序列化器確保包含互動數據
            serializer = DiseaseArchiveContentSerializer(
                archives, 
                many=True, 
                context={'request': request}
            )
            preview_data = serializer.data
            
            return APIResponse(
                data={
                    'archives': preview_data,
                    'has_more': has_more,
                    'total_count': total_count,
                    'offset': offset,
                    'limit': limit
                },
                message="查詢成功",
                code=200,
                success=True
            )
            
        except ValueError as e:
            return APIResponse(
                data=None,
                message="分頁參數錯誤",
                code=400,
                success=False
            )
        except Exception as e:
            logger.error(f"獲取用戶公開疾病檔案預覽列表失敗: {str(e)}")
            return APIResponse(
                data=None,
                message="獲取資料失敗，請稍後再試",
                code=500,
                success=False
            )


class PublishDiseaseArchiveAPIView(APIView):
    """
    切換疾病檔案的公開/私人狀態（將檔案和關聯的異常記錄同步切換）
    """
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, archive_id):
        """
        切換指定疾病檔案及其關聯的異常記錄的公開/私人狀態
        
        回傳格式:
        {
            "code": 200,
            "message": "切換成功",
            "success": true,
            "data": {
                "archive_id": 1,
                "is_private": false,
                "updated_abnormal_posts_count": 3
            }
        }
        """
        try:
            # 獲取疾病檔案
            try:
                archive = DiseaseArchiveContent.objects.select_related(
                    'postFrame'
                ).prefetch_related(
                    'abnormal_posts__post'
                ).get(id=archive_id)
            except DiseaseArchiveContent.DoesNotExist:
                return APIResponse(
                    data=None,
                    message="找不到指定的疾病檔案",
                    code=404,
                    success=False
                )
            
            # 檢查權限：只有檔案擁有者可以切換狀態
            if archive.postFrame.user != request.user:
                return APIResponse(
                    data=None,
                    message="您沒有權限修改此疾病檔案",
                    code=403,
                    success=False
                )
            
            # 切換疾病檔案的狀態
            old_is_private = archive.is_private
            new_is_private = not archive.is_private
            archive.is_private = new_is_private
            archive.save(update_fields=['is_private'])
            
            # 更新推薦系統
            if archive.postFrame:
                try:
                    from django.apps import apps
                    recommendation_service = apps.get_app_config('social').get_recommendation_service()
                    
                    if old_is_private and not new_is_private:
                        # 從私人變為公開：加入推薦系統
                        recommendation_service.embed_new_post(post_id=archive.postFrame.id, content=archive.content)
                        logger.info(f"疾病檔案 {archive_id} 已加入推薦系統")
                    elif not old_is_private and new_is_private:
                        # 從公開變為私人：從推薦系統移除
                        recommendation_service.delete_post_data(post_id=archive.postFrame.id)
                        logger.info(f"疾病檔案 {archive_id} 已從推薦系統移除")
                except Exception as e:
                    logger.error(f"更新疾病檔案推薦系統狀態失敗: {str(e)}")
            
            action = "轉為私人" if new_is_private else "公開發布"
            logger.info(f"疾病檔案 {archive_id} 已{action}")
            
            # 獲取所有關聯的異常記錄並同步狀態
            updated_abnormal_posts_count = 0
            for relation in archive.abnormal_posts.all():
                abnormal_post = relation.post
                if abnormal_post.is_private != new_is_private:
                    abnormal_post.is_private = new_is_private
                    abnormal_post.save(update_fields=['is_private'])
                    updated_abnormal_posts_count += 1
                    logger.info(f"異常記錄 {abnormal_post.id} 已{action}")
            
            logger.info(f"疾病檔案 {archive_id} {action}完成，共更新 {updated_abnormal_posts_count} 個異常記錄")
            
            return APIResponse(
                data={
                    'archive_id': archive_id,
                    'is_private': new_is_private,
                    'updated_abnormal_posts_count': updated_abnormal_posts_count
                },
                message=f"{action}成功",
                code=200,
                success=True
            )
            
        except Exception as e:
            logger.error(f"切換疾病檔案狀態失敗: {str(e)}")
            return APIResponse(
                data=None,
                message="操作失敗，請稍後再試",
                code=500,
                success=False
            )


class DiseaseArchiveLikeAPIView(APIView):
    """
    切換疾病檔案按讚狀態
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, archive_id):
        """
        切換疾病檔案的按讚狀態
        """
        try:
            user = request.user
            
            # 獲取疾病檔案
            archive = DiseaseArchiveContent.objects.select_related('postFrame').filter(
                id=archive_id,
                is_private=False  # 只能對公開檔案按讚
            ).first()
            
            if not archive:
                return APIResponse(
                    data=None,
                    message="找不到該疾病檔案或檔案為私人",
                    code=404,
                    success=False
                )
            
            if not archive.postFrame:
                return APIResponse(
                    data=None,
                    message="疾病檔案缺少互動框架",
                    code=400,
                    success=False
                )
            
            from interactions.models import UserInteraction
            from social.models import Interactables
            
            # 檢查現有互動
            existing_interaction = UserInteraction.objects.filter(
                user=user,
                interactables=archive.postFrame,
                relation='liked'
            ).first()
            
            if existing_interaction:
                # 取消按讚
                existing_interaction.delete()
                archive.postFrame.handle_interaction(fromRelation='liked')
                message = "已取消按讚"
                is_liked = False
            else:
                # 新增按讚
                UserInteraction.objects.create(
                    user=user,
                    interactables=archive.postFrame,
                    relation='liked'
                )
                archive.postFrame.handle_interaction(toRelation='liked')
                message = "按讚成功"
                is_liked = True
            
            # 保存互動統計更新
            archive.postFrame.save()
            
            # 獲取更新後的統計數據
            stats = archive.postFrame.get_interaction_stats()
            interaction_stats = {
                'upvotes': stats[0],
                'downvotes': stats[1],
                'saves': stats[2],
                'shares': stats[3],
                'likes': stats[4]
            }
            
            return APIResponse(
                data={
                    'is_liked': is_liked,
                    'interaction_stats': interaction_stats
                },
                message=message,
                code=200,
                success=True
            )
            
        except Exception as e:
            return APIResponse(
                data=None,
                message=f"按讚操作失敗: {str(e)}",
                code=500,
                success=False
            )


class UpdateDiseaseArchiveAPIView(APIView):
    """
    更新疾病檔案內容（例如移除已刪除的異常記錄）
    """
    permission_classes = [IsAuthenticated]
    
    def put(self, request, archive_id):
        """
        更新疾病檔案
        """
        try:
            user = request.user
            
            # 獲取疾病檔案，確認是該用戶的檔案
            archive = DiseaseArchiveContent.objects.filter(
                id=archive_id,
                pet__user=user
            ).first()
            
            if not archive:
                return APIResponse(
                    data=None,
                    message="找不到該疾病檔案或無權限修改",
                    code=404,
                    success=False
                )
            
            # 從請求中獲取更新資料
            abnormal_posts = request.data.get('abnormal_posts', None)
            
            if abnormal_posts is not None:
                # 驗證異常記錄ID是否有效
                from pets.models import AbnormalPost
                valid_posts = AbnormalPost.objects.filter(
                    id__in=abnormal_posts,
                    pet=archive.pet
                ).values_list('id', flat=True)
                
                # 更新檔案的異常記錄關聯
                archive.abnormal_posts.clear()
                archive.abnormal_posts.add(*valid_posts)
                
                # 更新檔案修改時間
                archive.updated_at = timezone.now()
                archive.save()
                
                # 構建返回資料
                response_data = {
                    'id': archive.id,
                    'title': archive.title,
                    'abnormal_posts': list(valid_posts),
                    'updated_at': archive.updated_at.isoformat()
                }
                
                return APIResponse(
                    data=response_data,
                    message=f"疾病檔案已更新，包含 {len(valid_posts)} 個有效的異常記錄",
                    code=200,
                    success=True
                )
            
            # 如果沒有提供更新資料
            return APIResponse(
                data=None,
                message="未提供更新資料",
                code=400,
                success=False
            )
            
        except Exception as e:
            print(f"更新疾病檔案時發生錯誤: {str(e)}")
            return APIResponse(
                data=None,
                message=f"更新疾病檔案失敗: {str(e)}",
                code=500,
                success=False
            )


class DeleteDiseaseArchiveAPIView(APIView):
    """
    刪除疾病檔案
    """
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, archive_id):
        """
        刪除疾病檔案
        """
        try:
            user = request.user
            
            # 獲取疾病檔案，確認是該用戶的檔案
            archive = DiseaseArchiveContent.objects.filter(
                id=archive_id,
                pet__user=user
            ).first()
            
            if not archive:
                return APIResponse(
                    data=None,
                    message="找不到該疾病檔案或無權限刪除",
                    code=404,
                    success=False
                )
            
            # 從推薦系統中移除疾病檔案
            if hasattr(archive, 'postFrame') and archive.postFrame:
                try:
                    from django.apps import apps
                    recommendation_service = apps.get_app_config('social').get_recommendation_service()
                    recommendation_service.delete_post_data(post_id=archive.postFrame.id)
                except Exception as e:
                    logger.error(f"從推薦系統移除疾病檔案失敗: {str(e)}")
                
                # 刪除相關的 PostFrame
                archive.postFrame.delete()
            
            # 刪除檔案
            archive.delete()
            
            return APIResponse(
                data=None,
                message="疾病檔案已成功刪除",
                code=200,
                success=True
            )
            
        except Exception as e:
            print(f"刪除疾病檔案時發生錯誤: {str(e)}")
            return APIResponse(
                data=None,
                message=f"刪除疾病檔案失敗: {str(e)}",
                code=500,
                success=False
            )


class DiseaseArchiveSaveAPIView(APIView):
    """
    切換疾病檔案收藏狀態
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, archive_id):
        """
        切換疾病檔案的收藏狀態
        """
        try:
            user = request.user
            
            # 獲取疾病檔案
            archive = DiseaseArchiveContent.objects.select_related('postFrame').filter(
                id=archive_id,
                is_private=False  # 只能收藏公開檔案
            ).first()
            
            if not archive:
                return APIResponse(
                    data=None,
                    message="找不到該疾病檔案或檔案為私人",
                    code=404,
                    success=False
                )
            
            if not archive.postFrame:
                return APIResponse(
                    data=None,
                    message="疾病檔案缺少互動框架",
                    code=400,
                    success=False
                )
            
            from interactions.models import UserInteraction
            from social.models import Interactables
            
            # 檢查現有互動
            existing_interaction = UserInteraction.objects.filter(
                user=user,
                interactables=archive.postFrame,
                relation='saved'
            ).first()
            
            if existing_interaction:
                # 取消收藏
                existing_interaction.delete()
                archive.postFrame.handle_interaction(fromRelation='saved')
                message = "已取消收藏"
                is_saved = False
            else:
                # 新增收藏
                UserInteraction.objects.create(
                    user=user,
                    interactables=archive.postFrame,
                    relation='saved'
                )
                archive.postFrame.handle_interaction(toRelation='saved')
                message = "收藏成功"
                is_saved = True
            
            # 保存互動統計更新
            archive.postFrame.save()
            
            # 獲取更新後的統計數據
            stats = archive.postFrame.get_interaction_stats()
            interaction_stats = {
                'upvotes': stats[0],
                'downvotes': stats[1],
                'saves': stats[2],
                'shares': stats[3],
                'likes': stats[4]
            }
            
            return APIResponse(
                data={
                    'is_saved': is_saved,
                    'interaction_stats': interaction_stats
                },
                message=message,
                code=200,
                success=True
            )
            
        except Exception as e:
            return APIResponse(
                data=None,
                message=f"收藏操作失敗: {str(e)}",
                code=500,
                success=False
            )