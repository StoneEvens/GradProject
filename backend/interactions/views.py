from django.shortcuts import render, get_object_or_404
from django.contrib.contenttypes.models import ContentType
from rest_framework import viewsets, permissions, status as drf_status
from rest_framework.views import APIView
from rest_framework.response import Response
from comments.models import Comment
from social.models import PostFrame
from pets.models import IllnessArchive
from .models import UserInteraction
from .serializers import UserInteractionSerializer
from social.models import PostFrame

class UserInteractionView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def handleInteraction(self, user, postID, relation):
        fromRelation = None
        toRelation = relation

        if relation == 'upvoted':
            fromRelation = UserInteraction.get_user_interaction(user, postID, 'downvoted')
        elif relation == 'downvoted':
            fromRelation = UserInteraction.get_user_interaction(user, postID, 'upvoted')
        
        postFrame = PostFrame.get_postFrame(postID)
        postFrameStatus = postFrame.handle_interaction(user, fromRelation, toRelation)

        interactionStatus = UserInteraction.create_interaction(
            user=user,
            postID=postID,
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
        target_object = get_object_or_404(self.model, id=object_id)
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
        success, message, response_status_code = target_object.handle_interaction(
            request.user,
            relation,
            self.allowed_relations 
        )

        if not success:
            return Response({"detail": message}, status=response_status_code)
        
        return Response({"detail": message}, status=response_status_code)
    
    def _get_action_name(self, relation):
        """獲取互動類型的中文名稱"""
        action_names = {
            'upvoted': '點讚',
            'downvoted': '踩',
            'saved': '收藏',
            'shared': '分享'
        }
        return action_names.get(relation, relation)

class CommentInteractionView(BaseInteractionView):
    """
    處理評論的互動操作 (點讚/踩)
    """
    model = Comment
    allowed_relations = ['upvoted', 'downvoted']

class PostInteractionView(BaseInteractionView):
    """
    處理貼文的互動操作 (點讚/踩/收藏/分享)
    """
    model = PostFrame
    allowed_relations = ['upvoted', 'downvoted', 'saved', 'shared']

class IllnessArchiveInteractionView(BaseInteractionView):
    """
    處理疾病檔案的互動操作 (點讚/踩/收藏/分享)
    """
    model = IllnessArchive  # 使用正確的疾病檔案模型
    allowed_relations = ['upvoted', 'downvoted', 'saved', 'shared']
