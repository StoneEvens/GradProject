"""
AI Agent Views
提供 AI 聊天服務的 API endpoints
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .services import ResponseService
from .services.singleton import get_intent_service
from .models import Conversation, Message, ConversationFeedback
from .serializers import (
    ConversationListSerializer,
    ConversationDetailSerializer,
    ConversationCreateSerializer,
    ConversationUpdateSerializer,
    MessageSerializer,
    MessageCreateSerializer,
    ConversationFeedbackSerializer
)


class AIAgentChatView(APIView):
    """
    AI Agent 聊天 API
    處理使用者自然語言輸入並返回 AI 回應
    """
    permission_classes = [IsAuthenticated]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # 使用全局單例 IntentService，避免每次請求重新載入 BERT 模型
        self.intent_service = get_intent_service()
        self.response_service = ResponseService()

    @swagger_auto_schema(
        operation_summary="AI 聊天",
        operation_description="""
        處理使用者自然語言輸入的完整流程：
        1. 分析使用者意圖（OpenAI）
        2. 從向量資料庫檢索相關資料
        3. 生成格式化回應
        """,
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['message'],
            properties={
                'message': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='使用者輸入訊息'
                ),
                'context': openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    description='對話上下文（可選）',
                    properties={
                        'petId': openapi.Schema(type=openapi.TYPE_INTEGER),
                        'lastIntent': openapi.Schema(type=openapi.TYPE_STRING),
                        'conversationHistory': openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Items(type=openapi.TYPE_OBJECT))
                    }
                )
            }
        ),
        responses={
            200: openapi.Response(
                description="成功",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'response': openapi.Schema(type=openapi.TYPE_STRING, description='AI 回應文字'),
                        'source': openapi.Schema(type=openapi.TYPE_STRING, description='回應來源'),
                        'confidence': openapi.Schema(type=openapi.TYPE_NUMBER, description='信心度'),
                        'intent': openapi.Schema(type=openapi.TYPE_STRING, description='識別的意圖'),
                        'hasTutorial': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                        'tutorialType': openapi.Schema(type=openapi.TYPE_STRING),
                        'hasRecommendedUsers': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                        'hasRecommendedArticles': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                        'hasCalculator': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                        'hasOperation': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                        'operationType': openapi.Schema(type=openapi.TYPE_STRING),
                        'recommendedUserIds': openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Items(type=openapi.TYPE_INTEGER)),
                        'recommendedArticleIds': openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Items(type=openapi.TYPE_INTEGER)),
                        'socialPostDetails': openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Items(type=openapi.TYPE_OBJECT)),
                        'forumPostDetails': openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Items(type=openapi.TYPE_OBJECT)),
                    }
                )
            ),
            400: "請求錯誤",
            401: "未授權",
            500: "伺服器錯誤"
        }
    )
    def post(self, request):
        """
        處理 AI 聊天請求

        Request Body:
            {
                "message": "使用者輸入",
                "conversationId": 123,  // 選填，不提供則建立新對話
                "context": {
                    "petId": 1,
                    "lastIntent": "feeding",
                    ...
                }
            }

        Returns:
            完整的 AI 回應格式（包含 conversationId）
        """
        try:
            # 獲取請求資料
            user_message = request.data.get('message')
            conversation_id = request.data.get('conversationId')
            context = request.data.get('context', {})

            if not user_message:
                return Response(
                    {'error': '訊息不能為空'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 加入使用者資訊到上下文
            from pets.models import Pet

            # 取得使用者的寵物資訊
            user_pets = Pet.objects.filter(owner=request.user)
            pets_info = []
            for pet in user_pets:
                pets_info.append({
                    'id': pet.id,
                    'name': pet.pet_name,
                    'type': pet.pet_type,  # 貓/狗
                    'breed': pet.breed,    # 品種
                    'age': pet.age,
                    'stage': pet.pet_stage,  # 年齡階段 (幼犬、成犬/成貓等)
                    'weight': pet.weight,
                    'description': pet.description
                })

            context['user'] = {
                'id': request.user.id,
                'username': request.user.user_account,
                'fullname': request.user.user_fullname,
                'pets': pets_info  # 加入寵物資訊
            }

            # 取得或建立對話
            if conversation_id:
                conversation = get_object_or_404(
                    Conversation,
                    id=conversation_id,
                    user=request.user
                )
            else:
                # 建立新對話（標題將在第一條訊息時自動生成）
                conversation = Conversation.objects.create(
                    user=request.user,
                    title='',  # 將由第一條訊息自動生成
                    context_data=context
                )

            # 儲存使用者訊息
            user_msg = Message.objects.create(
                conversation=conversation,
                role=Message.ROLE_USER,
                content=user_message
            )

            # 處理使用者輸入
            intent_result = self.intent_service.process_user_input(
                user_message,
                context
            )

            # 格式化回應
            response_data = self.response_service.format_chat_response(intent_result)

            # 豐富化回應（加入貼文詳細資料）
            if intent_result.get('success') and intent_result.get('retrieved_data'):
                response_data = self.response_service.enrich_with_post_details(
                    response_data,
                    intent_result
                )

            # 豐富化用戶推薦
            if response_data.get('hasRecommendedUsers'):
                response_data = self.response_service.enrich_with_user_recommendations(
                    response_data
                )

            # 儲存 AI 回應訊息
            ai_msg = Message.objects.create(
                conversation=conversation,
                role=Message.ROLE_ASSISTANT,
                content=response_data.get('response', ''),
                intent=intent_result.get('intent_data', {}).get('intent'),
                confidence=intent_result.get('intent_data', {}).get('confidence'),
                source=response_data.get('source', 'ai_agent'),
                has_tutorial=response_data.get('hasTutorial', False),
                tutorial_type=response_data.get('tutorialType'),
                has_recommended_users=response_data.get('hasRecommendedUsers', False),
                has_recommended_articles=response_data.get('hasRecommendedArticles', False),
                has_calculator=response_data.get('hasCalculator', False),
                has_operation=response_data.get('hasOperation', False),
                operation_type=response_data.get('operationType'),
                additional_data={
                    'recommended_user_ids': response_data.get('recommendedUserIds', []),
                    'recommended_user_details': response_data.get('recommendedUserDetails', []),  # 保存完整用戶詳情
                    'recommended_article_ids': response_data.get('recommendedArticleIds', []),
                    'social_post_details': response_data.get('socialPostDetails', []),
                    'forum_post_details': response_data.get('forumPostDetails', []),
                    'operation_params': response_data.get('operationParams', {}),  # 保存操作參數
                },
                entities=intent_result.get('intent_data', {}).get('entities', {})
            )

            # 加入 conversationId 到回應
            response_data['conversationId'] = conversation.id

            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"AI Agent Chat API 錯誤: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response(
                {
                    'error': '處理請求時發生錯誤',
                    'detail': str(e),
                    'response': '抱歉，我暫時無法處理您的請求。請稍後再試。',
                    'source': 'error',
                    'confidence': 0.0
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AIAgentHealthCheckView(APIView):
    """
    AI Agent 健康檢查 API
    """
    permission_classes = []

    @swagger_auto_schema(
        operation_summary="AI Agent 健康檢查",
        operation_description="檢查 AI Agent 服務是否正常運行",
        responses={
            200: openapi.Response(
                description="服務正常",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'status': openapi.Schema(type=openapi.TYPE_STRING),
                        'services': openapi.Schema(type=openapi.TYPE_OBJECT),
                    }
                )
            )
        }
    )
    def get(self, request):
        """
        檢查服務狀態
        """
        try:
            import os
            from django.conf import settings

            # 檢查 OpenAI API Key
            openai_configured = bool(
                os.getenv('OPENAI_API_KEY') or
                getattr(settings, 'OPENAI_API_KEY', None)
            )

            # 檢查向量資料庫
            base_dir = settings.BASE_DIR
            social_embs_exist = os.path.exists(os.path.join(base_dir, 'social_post_embs.npy'))
            forum_embs_exist = os.path.exists(os.path.join(base_dir, 'forum_post_embs.npy'))

            return Response({
                'status': 'healthy',
                'services': {
                    'openai': 'configured' if openai_configured else 'not_configured',
                    'vector_db_social': 'available' if social_embs_exist else 'not_found',
                    'vector_db_forum': 'available' if forum_embs_exist else 'not_found',
                    'bert_model': 'loaded'
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'status': 'unhealthy',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ConversationListView(generics.ListAPIView):
    """
    對話列表 API
    列出當前使用者的所有對話
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationListSerializer

    def get_queryset(self):
        """只返回當前使用者的對話"""
        user = self.request.user
        queryset = Conversation.objects.filter(user=user)

        # 篩選條件
        is_archived = self.request.query_params.get('archived')
        if is_archived is not None:
            queryset = queryset.filter(is_archived=is_archived.lower() == 'true')

        is_pinned = self.request.query_params.get('pinned')
        if is_pinned is not None:
            queryset = queryset.filter(is_pinned=is_pinned.lower() == 'true')

        # 按最後訊息時間排序（最新的在前），限制最多返回 5 條
        queryset = queryset.order_by('-last_message_at', '-updated_at')[:5]

        return queryset

    @swagger_auto_schema(
        operation_summary="列出對話",
        operation_description="列出當前使用者的所有對話",
        manual_parameters=[
            openapi.Parameter('archived', openapi.IN_QUERY, type=openapi.TYPE_BOOLEAN, description='篩選已封存對話'),
            openapi.Parameter('pinned', openapi.IN_QUERY, type=openapi.TYPE_BOOLEAN, description='篩選置頂對話'),
        ]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class ConversationDetailView(generics.RetrieveAPIView):
    """
    對話詳細資訊 API
    取得指定對話的完整內容（包含所有訊息）
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationDetailSerializer

    def get_queryset(self):
        """只允許取得當前使用者的對話"""
        return Conversation.objects.filter(user=self.request.user)

    @swagger_auto_schema(
        operation_summary="取得對話詳情",
        operation_description="取得指定對話的完整內容，包含所有訊息"
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class ConversationCreateView(generics.CreateAPIView):
    """
    建立新對話 API
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationCreateSerializer

    @swagger_auto_schema(
        operation_summary="建立新對話",
        operation_description="建立一個新的對話會話"
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class ConversationUpdateView(generics.UpdateAPIView):
    """
    更新對話 API
    支援更新標題、置頂、封存等
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationUpdateSerializer

    def get_queryset(self):
        """只允許更新當前使用者的對話"""
        return Conversation.objects.filter(user=self.request.user)

    @swagger_auto_schema(
        operation_summary="更新對話",
        operation_description="更新對話的標題、置頂狀態、封存狀態等"
    )
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)


class ConversationDeleteView(generics.DestroyAPIView):
    """
    刪除對話 API
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """只允許刪除當前使用者的對話"""
        return Conversation.objects.filter(user=self.request.user)

    @swagger_auto_schema(
        operation_summary="刪除對話",
        operation_description="永久刪除指定對話及其所有訊息"
    )
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)


class ConversationArchiveView(APIView):
    """
    對話封存/取消封存 API
    """
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="封存對話",
        operation_description="封存或取消封存對話",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'is_archived': openapi.Schema(type=openapi.TYPE_BOOLEAN, description='是否封存')
            }
        )
    )
    def post(self, request, pk):
        """封存或取消封存對話"""
        conversation = get_object_or_404(
            Conversation,
            id=pk,
            user=request.user
        )

        is_archived = request.data.get('is_archived', True)
        conversation.is_archived = is_archived
        conversation.save(update_fields=['is_archived'])

        serializer = ConversationListSerializer(conversation)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ConversationPinView(APIView):
    """
    對話置頂/取消置頂 API
    """
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="置頂對話",
        operation_description="置頂或取消置頂對話",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'is_pinned': openapi.Schema(type=openapi.TYPE_BOOLEAN, description='是否置頂')
            }
        )
    )
    def post(self, request, pk):
        """置頂或取消置頂對話"""
        conversation = get_object_or_404(
            Conversation,
            id=pk,
            user=request.user
        )

        is_pinned = request.data.get('is_pinned', True)
        conversation.is_pinned = is_pinned
        conversation.save(update_fields=['is_pinned'])

        serializer = ConversationListSerializer(conversation)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ConversationFeedbackView(generics.CreateAPIView):
    """
    對話回饋 API
    使用者對 AI 回應進行評分和回饋
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationFeedbackSerializer

    @swagger_auto_schema(
        operation_summary="提交對話回饋",
        operation_description="對 AI 回應進行評分和回饋"
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class DiseaseArchiveBatchView(APIView):
    """
    批量獲取疾病檔案詳情 API
    根據 PostFrame ID 列表返回對應的疾病檔案資訊
    """
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="批量獲取疾病檔案詳情",
        operation_description="根據 PostFrame ID 列表返回疾病檔案詳情（用於 AI 推薦）",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['post_ids'],
            properties={
                'post_ids': openapi.Schema(
                    type=openapi.TYPE_ARRAY,
                    items=openapi.Schema(type=openapi.TYPE_INTEGER),
                    description='PostFrame ID 列表'
                )
            }
        ),
        responses={
            200: openapi.Response(
                description="成功返回疾病檔案列表",
                schema=openapi.Schema(
                    type=openapi.TYPE_ARRAY,
                    items=openapi.Schema(
                        type=openapi.TYPE_OBJECT,
                        properties={
                            'id': openapi.Schema(type=openapi.TYPE_INTEGER, description='檔案 ID'),
                            'post_id': openapi.Schema(type=openapi.TYPE_INTEGER, description='PostFrame ID'),
                            'archive_title': openapi.Schema(type=openapi.TYPE_STRING, description='檔案標題'),
                            'content': openapi.Schema(type=openapi.TYPE_STRING, description='檔案內容'),
                            'health_status': openapi.Schema(type=openapi.TYPE_STRING, description='健康狀態'),
                            'go_to_doctor': openapi.Schema(type=openapi.TYPE_BOOLEAN, description='是否就醫'),
                            'pet_info': openapi.Schema(
                                type=openapi.TYPE_OBJECT,
                                description='寵物資訊'
                            ),
                            'author': openapi.Schema(
                                type=openapi.TYPE_OBJECT,
                                description='作者資訊'
                            ),
                            'created_at': openapi.Schema(type=openapi.TYPE_STRING, description='建立時間')
                        }
                    )
                )
            )
        }
    )
    def post(self, request):
        """批量獲取疾病檔案詳情"""
        try:
            from pets.models import DiseaseArchiveContent

            post_ids = request.data.get('post_ids', [])

            if not post_ids:
                return Response([], status=status.HTTP_200_OK)

            # 從資料庫取得疾病檔案（只取得公開的）
            disease_archives = DiseaseArchiveContent.objects.filter(
                postFrame_id__in=post_ids,
                is_private=False
            ).select_related('postFrame__user', 'pet').order_by('-postFrame__created_at')

            # 格式化結果
            results = []
            for archive in disease_archives:
                post_frame = archive.postFrame

                results.append({
                    'id': archive.id,
                    'post_id': post_frame.id,
                    'archive_title': archive.archive_title,
                    'content': archive.content,
                    'health_status': archive.health_status,
                    'go_to_doctor': archive.go_to_doctor,
                    'pet_info': {
                        'name': archive.pet.pet_name if archive.pet else None,
                        'type': archive.pet.pet_type if archive.pet else None,
                        'breed': archive.pet.breed if archive.pet else None
                    } if archive.pet else None,
                    'author': {
                        'username': post_frame.user.user_account,
                        'fullname': post_frame.user.user_fullname,
                    },
                    'created_at': post_frame.created_at.isoformat(),
                })

            return Response(results, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"批量獲取疾病檔案失敗: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response(
                {'error': '獲取疾病檔案失敗', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )