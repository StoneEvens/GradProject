from django.shortcuts import render, get_object_or_404
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
from rest_framework import viewsets, permissions, status as drf_status
from rest_framework.views import APIView
from rest_framework.response import Response
import logging
import traceback

logger = logging.getLogger('django')
from comments.models import Comment
from social.models import PostFrame, Interactables, SoLContent
from pets.models import ForumContent
from accounts.models import CustomUser
from .models import UserInteraction
from .serializers import UserInteractionSerializer
from social.serializers import SolPostSerializer
from utils.api_response import create_response

class UserInteractionView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def handleInteraction(self, user, postID, relation):
        fromRelation = None
        toRelation = relation

        if relation == 'upvoted':
            fromRelation = UserInteraction.get_user_interactions(user, postID, 'downvoted')
        elif relation == 'downvoted':
            fromRelation = UserInteraction.get_user_interactions(user, postID, 'upvoted')
        
        postFrame = PostFrame.get_postFrames(postID)
        postFrameStatus = postFrame.handle_interaction(user, fromRelation, toRelation)

        interactionStatus = UserInteraction.create_interaction(
            user=user,
            interactables=postFrame,
            relation=toRelation
        )

        if interactionStatus & postFrameStatus:
            action_taken_message = f"成功{self._get_action_name(toRelation)}貼文。"
            status_code = drf_status.HTTP_200_OK
        else:
            action_taken_message = f"無法{self._get_action_name(toRelation)}貼文。"
            status_code = drf_status.HTTP_400_BAD_REQUEST
        
        return True, action_taken_message, status_code

class BaseInteractionView(APIView):
    """
    互動操作的基礎視圖類
    """
    permission_classes = [permissions.IsAuthenticated]
    model = None  # 子類需要指定
    allowed_relations = ['upvoted', 'downvoted']  # 子類可以覆蓋 (例如 Post 可能有 'saved', 'shared')

    def post(self, request, object_id, format=None):
        """
        通過調用目標物件的 handle_interaction 方法來添加或移除互動。
        """
        target_object = get_object_or_404(Interactables, id=object_id)
        relation = request.data.get('relation')

        if not relation:
            return Response(
                {"detail": "未提供 'relation' 參數。"},
                status=drf_status.HTTP_400_BAD_REQUEST
            )

        if not hasattr(target_object, 'handle_interaction'):
            return Response(
                {"detail": f"模型 '{self.model.__name__}' 未實現 'handle_interaction' 方法。"},
                status=drf_status.HTTP_501_NOT_IMPLEMENTED
            )
        
        # allowed_relations 應該在子視圖中根據模型具體定義
        # 例如 PostInteractionView.allowed_relations = ['upvoted', 'downvoted', 'saved', 'shared']
        #success, message, response_status_code = target_object.handle_interaction(
        #    request.user,
        #    relation,
        #    self.allowed_relations 
        #)
        fromRelation = UserInteraction.get_user_interactions(request.user, relation, target_object)
        toRelation = UserInteraction.get_user_interactions(request.user, relation, target_object)

        #if relation == 'liked':
            #fromRelation = UserInteraction.get_user_interactions(request.user, target_object.id, 'downvoted')

        try:
            success = False

            if toRelation:
                toRelation.delete_interaction()

                success = target_object.handle_interaction(
                fromRelation=relation,
                toRelation=None
                )
            else:
                UserInteraction.create_interaction(
                    user=request.user,
                    interactables=target_object,
                    relation=relation
                )

                success = target_object.handle_interaction(
                fromRelation=None,
                toRelation=relation
                )

            if not success:
                return Response({"Status": success}, status=drf_status.HTTP_400_BAD_REQUEST)

            return Response({"Status": success}, status=drf_status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error creating interaction: {str(e)}")
            print(traceback.format_exc())
            return Response(
                {"detail": "無法處理互動。"},
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _get_action_name(self, relation):
        """獲取互動類型的中文名稱"""
        action_names = {
            'liked': '按讚',
            'upvoted': '點讚',
            'downvoted': '踩',
            'saved': '收藏',
            'shared': '分享'
        }
        return action_names.get(relation, relation)

class CommentInteractionView(BaseInteractionView):
    """
    處理評論的互動操作 (按讚/點讚/踩)
    """
    model = Comment
    allowed_relations = ['liked', 'upvoted', 'downvoted']

class PostInteractionView(BaseInteractionView):
    """
    處理貼文的互動操作 (按讚/點讚/踩/收藏/分享)
    """
    model = PostFrame
    allowed_relations = ['liked', 'upvoted', 'downvoted', 'saved', 'shared']

class IllnessArchiveInteractionView(BaseInteractionView):
    """
    處理疾病檔案的互動操作 (點讚/踩/收藏/分享)
    """
    model = ForumContent  # 使用正確的疾病檔案模型
    allowed_relations = ['upvoted', 'downvoted', 'saved', 'shared']


class UserLikedPostsView(APIView):
    """
    獲取用戶按讚的貼文列表
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, format=None):
        try:
            user = request.user
            sort_option = request.GET.get('sort', 'post_date_desc')
            
            # 獲取用戶所有按讚的貼文記錄
            liked_interactions = (
                UserInteraction.objects.filter(
                    user=user,
                    relation='liked',
                    interactables__isnull=False,
                )
                .filter(interactables__in=PostFrame.objects.all())
                .select_related('interactables')
            )

            # 根據排序選項排序
            if sort_option == 'post_date_desc':
                liked_interactions = liked_interactions.order_by('-interactables__created_at')
            elif sort_option == 'post_date_asc':
                liked_interactions = liked_interactions.order_by('interactables__created_at')
            elif sort_option == 'like_date_desc':
                liked_interactions = liked_interactions.order_by('-created_at')
            elif sort_option == 'like_date_asc':
                liked_interactions = liked_interactions.order_by('created_at')
            else:
                liked_interactions = liked_interactions.order_by('-interactables__created_at')
            
            # 提取貼文物件
            post_frames = [
                interaction.interactables.postframe 
                for interaction in liked_interactions
            ]

            solContent = SoLContent.get_content(postFrameList=post_frames)

            # 序列化貼文數據
            serializer = SolPostSerializer(
                solContent, 
                many=True, 
                context={'request': request}
            )
            
            # 為每個貼文添加按讚日期
            serialized_data = serializer.data
            for i, post_data in enumerate(serialized_data):
                # 找到對應的按讚記錄
                interaction = next(
                    (inter for inter in liked_interactions if inter.interactables.id == post_data['post_id']),
                    None
                )
                if interaction:
                    post_data['liked_at'] = interaction.created_at
            
            return Response(
                create_response(
                    success=True,
                    message="獲取按讚貼文成功",
                    data={"posts": serialized_data}
                ),
                status=drf_status.HTTP_200_OK
            )
            
        except Exception as e:
            error_traceback = traceback.format_exc()
            logger.error(f"Error in UserLikedPostsView: {str(e)}")
            logger.error(f"Traceback: {error_traceback}")
            return Response(
                create_response(
                    success=False,
                    message="獲取按讚貼文失敗",
                    error_code="FETCH_LIKED_POSTS_ERROR",
                    data={
                        "error": str(e),
                        "traceback": error_traceback
                    }
                ),
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserSavedPostsView(APIView):
    """
    獲取用戶收藏的貼文列表
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, format=None):
        try:
            user = request.user
            sort_option = request.GET.get('sort', 'post_date_desc')
            
            # 獲取用戶所有收藏的貼文記錄
            saved_interactions = (
                UserInteraction.objects.filter(
                    user=user,
                    relation='saved',
                    interactables__isnull=False,
                )
                .filter(interactables__in=PostFrame.objects.all())
                .select_related('interactables')
            )
            
            # 根據排序選項排序
            if sort_option == 'post_date_desc':
                saved_interactions = saved_interactions.order_by('-interactables__created_at')
            elif sort_option == 'post_date_asc':
                saved_interactions = saved_interactions.order_by('interactables__created_at')
            elif sort_option == 'save_date_desc':
                saved_interactions = saved_interactions.order_by('-created_at')
            elif sort_option == 'save_date_asc':
                saved_interactions = saved_interactions.order_by('created_at')
            else:
                saved_interactions = saved_interactions.order_by('-interactables__created_at')
            
            # 提取貼文物件
            post_frames = [
                interaction.interactables.postframe 
                for interaction in saved_interactions
            ]

            solContent = SoLContent.get_content(postFrameList=post_frames)

            # 序列化貼文數據
            serializer = SolPostSerializer(
                solContent, 
                many=True, 
                context={'request': request}
            )
            
            # 為每個貼文添加按讚日期
            serialized_data = serializer.data
            for i, post_data in enumerate(serialized_data):
                # 找到對應的按讚記錄
                interaction = next(
                    (inter for inter in saved_interactions if inter.interactables.id == post_data['post_id']),
                    None
                )
                if interaction:
                    post_data['liked_at'] = interaction.created_at
            
            return Response(
                create_response(
                    success=True,
                    message="獲取收藏貼文成功",
                    data={"posts": serialized_data}
                ),
                status=drf_status.HTTP_200_OK
            )
            
        except Exception as e:
            error_traceback = traceback.format_exc()
            logger.error(f"Error in UserSavedPostsView: {str(e)}")
            logger.error(f"Traceback: {error_traceback}")
            return Response(
                create_response(
                    success=False,
                    message="獲取收藏貼文失敗",
                    error_code="FETCH_SAVED_POSTS_ERROR",
                    data={
                        "error": str(e),
                        "traceback": error_traceback
                    }
                ),
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )
