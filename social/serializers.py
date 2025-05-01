from rest_framework import serializers
from media.models import Image
from .models import Post, PostHashtag

# === 貼文序列化器 ===
class PostSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = '__all__'

# === 貼文 Hashtag 序列化器 ===
class PostHashtagSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostHashtag
        fields = '__all__'

#預覽用post
class PostPreviewSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    first_image_url = serializers.SerializerMethodField()

    def get_first_image_url(self, obj: Post):
        # 這個方法現在會在視圖的 list 方法中被覆蓋
        # 但我們保留它以防視圖以外的地方使用序列化器
        qs = Image.objects.filter(
            content_type__model='post',
            object_id=obj.id
        ).order_by('sort_order')
        if qs.exists():
            return qs.first().img_url
        return None