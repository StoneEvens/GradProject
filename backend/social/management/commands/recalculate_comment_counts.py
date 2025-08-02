from django.core.management.base import BaseCommand
from django.db.models import Count
from social.models import PostFrame
from comments.models import Comment

class Command(BaseCommand):
    help = '重新計算所有貼文的留言數（包含回覆）'

    def handle(self, *args, **options):
        self.stdout.write('開始重新計算留言數...')
        
        updated_count = 0
        
        # 獲取所有貼文
        postframes = PostFrame.objects.all()
        total_posts = postframes.count()
        
        for i, postframe in enumerate(postframes):
            # 計算該貼文的所有留言數（包含回覆）
            comment_count = Comment.objects.filter(postFrame=postframe).count()
            
            # 更新留言數
            if postframe.comments_count != comment_count:
                postframe.comments_count = comment_count
                postframe.save(update_fields=['comments_count'])
                updated_count += 1
                
            # 顯示進度
            if (i + 1) % 100 == 0:
                self.stdout.write(f'已處理 {i + 1}/{total_posts} 個貼文...')
        
        self.stdout.write(
            self.style.SUCCESS(
                f'完成！共更新了 {updated_count} 個貼文的留言數。'
            )
        )