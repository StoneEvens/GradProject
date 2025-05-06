from django.shortcuts import render, get_object_or_404
from django.contrib.contenttypes.models import ContentType
from rest_framework import viewsets, permissions, status as drf_status
from rest_framework.views import APIView
from rest_framework.response import Response
from comments.models import Comment
from social.models import Post
from pets.models import IllnessArchive
from .models import UserInteraction
from .serializers import UserInteractionSerializer

class BaseInteractionView(APIView):
    """
    互動操作的基礎視圖類
    """
    permission_classes = [permissions.IsAuthenticated]
    model = None  # 子類需要指定
    allowed_relations = ['upvoted', 'downvoted']  # 子類可以覆蓋

    def post(self, request, object_id, format=None):
        """
        添加或移除互動
        """
        # 獲取對象
        target_object = get_object_or_404(self.model, id=object_id)
        relation = request.data.get('relation')
        
        # 檢查互動類型是否有效
        if relation not in self.allowed_relations:
            return Response(
                {"detail": f"互動類型無效，僅支持 {', '.join(self.allowed_relations)}"},
                status=drf_status.HTTP_400_BAD_REQUEST
            )
        
        content_type = ContentType.objects.get_for_model(self.model)
        
        # 檢查互動是否已存在
        interaction = UserInteraction.objects.filter(
            user=request.user,
            content_type=content_type,
            object_id=object_id,
            relation=relation
        ).first()
        
        # 如已存在則刪除 (取消互動)
        if interaction:
            interaction.delete()
            
            # 如果是取消點讚，且對象有熱度屬性，則更新熱度
            if relation == 'upvoted' and hasattr(target_object, 'popularity'):
                target_object.popularity = max(0, target_object.popularity - 1)
                target_object.save()
            
            return Response(
                {"detail": f"已取消{self._get_action_name(relation)}"},
                status=drf_status.HTTP_200_OK
            )
        
        # 檢查是否有互斥的互動 (若已踩，則不能點讚，反之亦然)
        if relation in ['upvoted', 'downvoted']:
            opposite_relation = 'downvoted' if relation == 'upvoted' else 'upvoted'
            opposite = UserInteraction.objects.filter(
                user=request.user,
                content_type=content_type,
                object_id=object_id,
                relation=opposite_relation
            ).first()
            
            # 若存在互斥互動，則刪除
            if opposite:
                opposite.delete()
                
                # 若刪除的是踩，且對象有熱度屬性，則更新熱度
                if opposite_relation == 'downvoted' and hasattr(target_object, 'popularity'):
                    target_object.popularity = target_object.popularity + 1
                    target_object.save()
        
        # 創建新互動
        UserInteraction.objects.create(
            user=request.user,
            content_type=content_type,
            object_id=object_id,
            relation=relation
        )
        
        # 更新熱度
        if relation == 'upvoted' and hasattr(target_object, 'popularity'):
            target_object.popularity = target_object.popularity + 1
            target_object.save()
        
        return Response(
            {"detail": f"已成功{self._get_action_name(relation)}"},
            status=drf_status.HTTP_201_CREATED
        )
    
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
    model = Post
    allowed_relations = ['upvoted', 'downvoted', 'saved', 'shared']

class IllnessArchiveInteractionView(BaseInteractionView):
    """
    處理疾病檔案的互動操作 (點讚/踩/收藏/分享)
    """
    model = IllnessArchive  # 使用正確的疾病檔案模型
    allowed_relations = ['upvoted', 'downvoted', 'saved', 'shared']
