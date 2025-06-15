from django.db import models
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from rest_framework import status as drf_status
from django.utils.text import slugify
import re
from pets.models import Pet, PetGenericRelation

#----------貼文的"框"----------
class PostFrame(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='postsframes')
    upvotes = models.IntegerField(default=0, help_text="點讚數")
    downvotes = models.IntegerField(default=0, help_text="點踩數")
    saves = models.IntegerField(default=0, help_text="收藏數")
    shares = models.IntegerField(default=0, help_text="分享數")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s Post at {self.created_at}"
    
    # 獲取貼文的唯一ID
    def get_postFrame_ID(self):
        return self.id
    
    def get_postFrame(self, postID):
        """
        根據貼文ID獲取對應的PostFrame實例。
        """
        try:
            return PostFrame.objects.get(id=postID)
        except PostFrame.DoesNotExist:
            return None
    
    def handle_interaction(self, fromRelation = None, toRelation = None):
        update_fields = []
        ops = 0

        if fromRelation is not None:
            if fromRelation == 'upvoted':
                self.upvotes = max(0, self.upvotes - 1)
                update_fields.append('upvotes')
                ops += 1
            elif fromRelation == 'downvoted':
                self.downvotes = max(0, self.downvotes - 1)
                update_fields.append('downvotes')
                ops += 1
            elif fromRelation == 'saved':
                self.saves = max(0, self.saves - 1)
                update_fields.append('saves')
                ops += 1
            elif fromRelation == 'shared':
                self.shares = max(0, self.shares - 1)
                update_fields.append('shares')
                ops += 1
        
        if toRelation is not None:
            if toRelation == 'upvoted':
                self.upvotes = max(0, self.upvotes + 1)
                update_fields.append('upvotes')
                ops += 1
            elif toRelation == 'downvoted':
                self.downvotes = max(0, self.downvotes + 1)
                update_fields.append('downvotes')
                ops += 1
            elif toRelation == 'saved':
                self.saves = max(0, self.saves + 1)
                update_fields.append('saves')
                ops += 1
            elif toRelation == 'shared':
                self.shares = max(0, self.shares + 1)
                update_fields.append('shares')
                ops += 1
        
        if len(update_fields) == ops:
            self.save(update_fields=update_fields)
            return True
        return False

    
    def get_interaction_stats(self):
        
        return {
            'upvotes': self.upvotes,
            'downvotes': self.downvotes,
            'saves': self.saves,
            'shares': self.shares,
            'total_score': self.upvotes - self.downvotes
        }

#----------貼文內容----------
#SoL (Slice of Life) 貼文內容
class SoLContent(models.Model):
    postFrame = models.ForeignKey(
        PostFrame,
        on_delete=models.CASCADE,
        related_name='contents'
    )
    content_text = models.TextField(help_text="存儲具體內容文本")

    def __str__(self):
        return f"Content for Post {self.post.id} - Type: {self.content_type}"


# === 日常貼文 ===
class Post(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='posts'
    )
    content = models.TextField()
    popularity = models.IntegerField(default=0, help_text="熱度，主要由點讚數決定")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s Post at {self.created_at}"
    
    def handle_interaction(self, user, relation, allowed_relations):
        """處理用戶對此貼文的互動，並更新熱度。"""
        from interactions.models import UserInteraction
        from django.contrib.contenttypes.models import ContentType

        if relation not in allowed_relations:
            return False, f"互動類型 '{relation}' 無效，僅支持 {', '.join(allowed_relations)}", drf_status.HTTP_400_BAD_REQUEST

        content_type = ContentType.objects.get_for_model(self.__class__)
        interaction = UserInteraction.objects.filter(
            user=user,
            content_type=content_type,
            object_id=self.id,
            relation=relation
        ).first()

        action_taken_message = ""
        status_code = drf_status.HTTP_200_OK
        popularity_changed = False

        if interaction: # 取消互動
            interaction.delete()
            action_taken_message = f"已取消對貼文 (ID: {self.id}) 的 {relation}"
            if relation == 'upvoted':
                self.popularity = max(0, self.popularity - 1)
                popularity_changed = True
            elif relation == 'downvoted':
                self.popularity += 1 
                popularity_changed = True
        
        else: # 新增互動
            status_code = drf_status.HTTP_201_CREATED
            if relation in ['upvoted', 'downvoted']:
                opposite_relation = 'downvoted' if relation == 'upvoted' else 'upvoted'
                opposite_interaction = UserInteraction.objects.filter(
                    user=user,
                    content_type=content_type,
                    object_id=self.id,
                    relation=opposite_relation
                ).first()
                if opposite_interaction:
                    opposite_interaction.delete()
                    if opposite_relation == 'downvoted' and relation == 'upvoted': 
                        self.popularity += 1 
                        popularity_changed = True
                    elif opposite_relation == 'upvoted' and relation == 'downvoted': 
                        self.popularity = max(0, self.popularity -1) 
                        popularity_changed = True
            
            UserInteraction.objects.create(
                user=user,
                content_type=content_type,
                object_id=self.id,
                relation=relation
            )
            action_taken_message = f"已成功對貼文 (ID: {self.id}) {relation}"
            if relation == 'upvoted':
                self.popularity += 1
                popularity_changed = True
            elif relation == 'downvoted':
                self.popularity = max(0, self.popularity - 1) 
                popularity_changed = True
        
        if popularity_changed:
            self.save(update_fields=['popularity'])
        
        return True, action_taken_message, status_code
    
    def get_interaction_stats(self):
        """
        獲取貼文互動統計
        """
        from interactions.models import UserInteraction
        
        post_type = ContentType.objects.get_for_model(Post)
        
        upvotes = UserInteraction.objects.filter(
            content_type=post_type,
            object_id=self.id,
            relation='upvoted'
        ).count()
        
        downvotes = UserInteraction.objects.filter(
            content_type=post_type,
            object_id=self.id,
            relation='downvoted'
        ).count()
        
        saves = UserInteraction.objects.filter(
            content_type=post_type,
            object_id=self.id,
            relation='saved'
        ).count()
        
        shares = UserInteraction.objects.filter(
            content_type=post_type,
            object_id=self.id,
            relation='shared'
        ).count()
        
        return {
            'upvotes': upvotes,
            'downvotes': downvotes,
            'saves': saves,
            'shares': shares,
            'total_score': upvotes - downvotes
        }
    
    def check_user_interaction(self, user, relation):
        """
        檢查用戶是否對貼文有特定互動
        """
        if not user or not user.is_authenticated:
            return False
            
        from interactions.models import UserInteraction
        
        post_type = ContentType.objects.get_for_model(Post)
        return UserInteraction.objects.filter(
            user=user,
            content_type=post_type,
            object_id=self.id,
            relation=relation
        ).exists()

    def update_hashtags(self, content_to_parse, explicit_tags_list=None):
        """從內容中提取、合併、slugify並保存PostHashtag。"""
        if explicit_tags_list is None:
            explicit_tags_list = []

        extracted_tags = set(re.findall(r'#(\w+)', content_to_parse))
        
        # 處理前端傳來的 explicit_tags_list (可能需要解析)
        processed_explicit_tags = set()
        if isinstance(explicit_tags_list, str): # 例如 "tag1,tag2" 或 "[\"tag1\"]"
            try:
                # 嘗試解析JSON數組字符串
                import json
                parsed_tags = json.loads(explicit_tags_list)
                if isinstance(parsed_tags, list):
                    processed_explicit_tags.update(str(tag).strip() for tag in parsed_tags if str(tag).strip())
                else: # 不是列表，當作單一tag或逗號分隔的tags
                    processed_explicit_tags.update(t.strip() for t in str(explicit_tags_list).split(','))
            except json.JSONDecodeError:
                 # 不是JSON，按逗號分隔處理
                processed_explicit_tags.update(t.strip() for t in explicit_tags_list.split(','))
        elif isinstance(explicit_tags_list, list):
            processed_explicit_tags.update(str(tag).strip() for tag in explicit_tags_list if str(tag).strip())

        combined_tags_text = extracted_tags | processed_explicit_tags
        
        final_slugified_tags = {slugify(tag) for tag in combined_tags_text if slugify(tag)}
        
        current_db_tags = set(self.hashtags.values_list('tag', flat=True))
        
        tags_to_add = final_slugified_tags - current_db_tags
        tags_to_remove = current_db_tags - final_slugified_tags
        
        if tags_to_remove:
            PostHashtag.objects.filter(post=self, tag__in=list(tags_to_remove)).delete()
        
        if tags_to_add:
            PostHashtag.objects.bulk_create([
                PostHashtag(post=self, tag=new_tag) for new_tag in tags_to_add
            ])
        return list(final_slugified_tags)

    def tag_pets(self, pet_ids_to_tag_list):
        """根據寵物ID列表標記寵物到此貼文。"""
        if not isinstance(pet_ids_to_tag_list, list):
            # 可以記錄日誌或返回特定錯誤信息
            return 0 # 返回成功標記的數量

        # 確保 pet_ids 是整數
        valid_pet_ids_int = []
        for pid in pet_ids_to_tag_list:
            try:
                valid_pet_ids_int.append(int(pid))
            except (ValueError, TypeError):
                # logger.warning(f"Post {self.id}: 無效的寵物 ID 格式 {pid}")
                pass
        
        if not valid_pet_ids_int:
            # 如果沒有有效的寵物ID，檢查是否需要清除現有標記
            # PostGenericRelation.objects.filter(content_type=ContentType.objects.get_for_model(Post), object_id=self.id).delete()
            return 0

        # 獲取屬於貼文作者的有效寵物
        user_owned_pets = Pet.objects.filter(owner=self.user, id__in=valid_pet_ids_int)
        user_owned_pet_ids = set(user_owned_pets.values_list('id', flat=True))

        post_content_type = ContentType.objects.get_for_model(Post)
        
        # 現有已標記的寵物
        current_tagged_pet_ids = set(
            PetGenericRelation.objects.filter(
                content_type=post_content_type,
                object_id=self.id
            ).values_list('pet_id', flat=True)
        )
        
        pets_to_add_ids = user_owned_pet_ids - current_tagged_pet_ids
        pets_to_remove_ids = current_tagged_pet_ids - user_owned_pet_ids

        if pets_to_remove_ids:
            PetGenericRelation.objects.filter(
                content_type=post_content_type,
                object_id=self.id,
                pet_id__in=list(pets_to_remove_ids)
            ).delete()

        relations_to_create = []
        if pets_to_add_ids:
            for pet_id_to_add in pets_to_add_ids:
                 # 從已驗證的 user_owned_pets 中獲取 pet instance
                pet_instance = next((p for p in user_owned_pets if p.id == pet_id_to_add), None)
                if pet_instance:
                    relations_to_create.append(
                        PetGenericRelation(
                            pet=pet_instance, 
                            content_type=post_content_type, 
                            object_id=self.id
                        )
                    )
        
        if relations_to_create:
            PetGenericRelation.objects.bulk_create(relations_to_create)
            
        return len(relations_to_create) # 返回實際新增的標記數量

# === 貼文的 Hashtag ===
class PostHashtag(models.Model):
    postFrame = models.ForeignKey(
        PostFrame,
        on_delete=models.CASCADE,
        related_name='hashtags'
    )
    tag = models.CharField(max_length=50)

    def __str__(self):
        return f"#{self.tag} for Post {self.post.id}"
