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
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
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
                                # 使用 GenericForeignKey 創建 Image 記錄關聯異常記錄
                                from media.models import Image
                                from django.contrib.contenttypes.models import ContentType
                                
                                content_type_obj = ContentType.objects.get_for_model(AbnormalPost)
                                Image.objects.create(
                                    content_type=content_type_obj,
                                    object_id=abnormal_post.id,
                                    firebase_url=firebase_url,
                                    firebase_path=firebase_path,
                                    sort_order=index,
                                    original_filename=file_name,
                                    content_type_mime=content_type,
                                    alt_text=f"寵物 {pet.pet_name} 的異常記錄圖片 {index+1}"
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
            # 確認寵物存在且屬於當前用戶
            try:
                pet = Pet.objects.get(id=pet_id, owner=request.user)
            except Pet.DoesNotExist:
                return APIResponse(
                    status=drf_status.HTTP_404_NOT_FOUND,
                    message="找不到指定的寵物或您沒有權限查看",
                    errors={"pet_id": "寵物不存在或無權限"}
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
                    pet_id=pet_id,
                    pet__owner=request.user  # 確保只能獲取自己寵物的記錄
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
            from media.models import Image
            from django.contrib.contenttypes.models import ContentType
            
            # 獲取現有圖片
            existing_images = list(Image.objects.filter(
                content_type=ContentType.objects.get_for_model(AbnormalPost),
                object_id=abnormal_post.id
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
                                    # 創建 Image 記錄關聯異常記錄
                                    content_type_obj = ContentType.objects.get_for_model(AbnormalPost)
                                    Image.objects.create(
                                        content_type=content_type_obj,
                                        object_id=abnormal_post.id,
                                        firebase_url=firebase_url,
                                        firebase_path=firebase_path,
                                        sort_order=index,
                                        original_filename=file_name,
                                        content_type_mime=content_type,
                                        alt_text=f"寵物 {target_pet.pet_name} 的異常記錄圖片 {index+1}"
                                    )
                                    pass
                                    
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
            from media.models import Image
            from django.contrib.contenttypes.models import ContentType
            from utils.firebase_service import firebase_storage_service
            
            # 刪除關聯的圖片
            existing_images = list(Image.objects.filter(
                content_type=ContentType.objects.get_for_model(AbnormalPost),
                object_id=abnormal_post.id
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