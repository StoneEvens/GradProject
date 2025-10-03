"""
Response Service
處理回應格式化與資料豐富化
"""

from social.models import PostFrame as SocialPost, SoLContent
from accounts.models import CustomUser
from comments.models import Comment


class ResponseService:
    """回應格式化服務"""

    @staticmethod
    def format_chat_response(intent_result):
        """
        格式化為前端 ChatWindow 需要的格式

        Args:
            intent_result (dict): Intent Service 的處理結果

        Returns:
            dict: 前端需要的格式
        """
        if not intent_result.get('success'):
            return {
                'response': intent_result.get('response', '抱歉，我暫時無法處理您的請求。'),
                'source': 'ai_agent',
                'confidence': 0.0,
                'hasTutorial': False,
                'hasRecommendedUsers': False,
                'hasRecommendedArticles': False,
                'hasCalculator': False,
                'hasOperation': False
            }

        ui_controls = intent_result.get('ui_controls', {})
        additional_data = intent_result.get('additional_data', {})

        return {
            'response': intent_result.get('response', ''),
            'source': 'ai_agent',
            'confidence': intent_result.get('confidence', 0.0),
            'intent': intent_result.get('intent'),

            # UI 控制標記
            'hasTutorial': ui_controls.get('hasTutorial', False),
            'tutorialType': ui_controls.get('tutorialType'),
            'hasRecommendedUsers': ui_controls.get('hasRecommendedUsers', False),
            'hasRecommendedArticles': ui_controls.get('hasRecommendedArticles', False),
            'hasCalculator': ui_controls.get('hasCalculator', False),
            'hasOperation': ui_controls.get('hasOperation', False),
            'operationType': ui_controls.get('operationType'),

            # 附加資料
            'recommendedUserIds': additional_data.get('recommended_user_ids', []),
            'recommendedArticleIds': additional_data.get('recommended_article_ids', []),
            'operationParams': additional_data.get('operation_params', {}),

            # Debug 資訊（可選）
            'entities': intent_result.get('entities', {})
        }

    @staticmethod
    def enrich_with_post_details(response, retrieved_data):
        """
        豐富化回應，加入貼文詳細資料

        Args:
            response (dict): 基本回應
            retrieved_data (dict): 檢索到的資料

        Returns:
            dict: 豐富化後的回應
        """
        try:
            posts_data = retrieved_data.get('retrieved_data', {}).get('posts', {})

            # 處理社交貼文
            social_posts = posts_data.get('social', [])
            if social_posts:
                social_ids = [p['id'] for p in social_posts[:5]]
                response['socialPostDetails'] = ResponseService._get_social_post_details(social_ids)

            # 處理論壇貼文
            forum_posts = posts_data.get('forum', [])
            if forum_posts:
                forum_ids = [p['id'] for p in forum_posts[:5]]
                response['forumPostDetails'] = ResponseService._get_forum_post_details(forum_ids)

            return response

        except Exception as e:
            print(f"豐富化回應失敗: {str(e)}")
            return response

    @staticmethod
    def _get_social_post_details(post_ids):
        """獲取社交貼文詳細資料"""
        try:
            # PostFrame 是容器，需要取得其內容
            post_frames = SocialPost.objects.filter(id__in=post_ids).select_related('user').prefetch_related('contents')

            result = []
            for post_frame in post_frames:
                # 取得第一個內容
                content_obj = post_frame.contents.first()
                content_text = content_obj.content_text if content_obj else ''
                location = content_obj.location if content_obj else None

                result.append({
                    'id': post_frame.id,
                    'author': {
                        'username': post_frame.user.user_account,
                        'fullname': post_frame.user.user_fullname,
                        'avatar': getattr(post_frame.user, 'headshot_url', None)
                    },
                    'content': content_text[:200] + '...' if len(content_text) > 200 else content_text,
                    'location': location,
                    'created_at': post_frame.created_at.isoformat(),
                    'likes': post_frame.likes,
                    'comments_count': post_frame.comments_count
                })

            return result
        except Exception as e:
            print(f"獲取社交貼文詳情失敗: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    @staticmethod
    def _get_forum_post_details(post_ids):
        """
        獲取論壇貼文/疾病檔案詳細資料
        從 DiseaseArchiveContent 取得完整內容
        """
        try:
            from pets.models import DiseaseArchiveContent

            # 從 PostFrame ID 找到對應的 DiseaseArchiveContent
            disease_archives = DiseaseArchiveContent.objects.filter(
                postFrame_id__in=post_ids,
                is_private=False  # 只顯示公開的疾病檔案
            ).select_related('postFrame__user', 'pet')

            result = []
            for archive in disease_archives:
                post_frame = archive.postFrame

                result.append({
                    'id': post_frame.id,
                    'archive_id': archive.id,
                    'archive_title': archive.archive_title,
                    'author': {
                        'username': post_frame.user.user_account,
                        'fullname': post_frame.user.user_fullname,
                        'avatar': getattr(post_frame.user, 'headshot_url', None)
                    },
                    'content': archive.content,  # 完整內容，不截斷
                    'pet_info': {
                        'name': archive.pet.pet_name if archive.pet else None,
                        'type': archive.pet.pet_type if archive.pet else None,
                        'breed': archive.pet.breed if archive.pet else None
                    },
                    'health_status': archive.health_status,
                    'go_to_doctor': archive.go_to_doctor,
                    'created_at': post_frame.created_at.isoformat(),
                    'likes': post_frame.likes,
                    'comments_count': post_frame.comments_count
                })

            return result
        except Exception as e:
            print(f"獲取疾病檔案詳情失敗: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    @staticmethod
    def enrich_with_user_recommendations(response):
        """
        豐富化用戶推薦資料
        只返回隱私設定為 public 的用戶

        Args:
            response (dict): 基本回應

        Returns:
            dict: 豐富化後的回應
        """
        try:
            from media.models import UserHeadshot

            user_ids = response.get('recommendedUserIds', [])
            if user_ids:
                # 只查詢公開帳戶的用戶
                users = CustomUser.objects.filter(
                    id__in=user_ids,
                    account_privacy='public'  # 只推薦公開帳戶
                )

                response['recommendedUserDetails'] = [
                    {
                        'id': user.id,
                        'user_account': user.user_account,  # 保持與前端一致的欄位名稱
                        'user_fullname': user.user_fullname,
                        'headshot_url': UserHeadshot.get_headshot_url(user),  # 正確獲取頭像 URL
                        'user_intro': user.user_intro if hasattr(user, 'user_intro') else None,
                        'account_privacy': 'public'  # 確保標記為公開
                    }
                    for user in users
                ]

                # 如果過濾後沒有用戶，記錄日誌
                if not response['recommendedUserDetails']:
                    print(f"警告: 推薦的用戶 ID {user_ids} 中沒有公開帳戶")

            return response

        except Exception as e:
            print(f"豐富化用戶推薦失敗: {str(e)}")
            import traceback
            traceback.print_exc()
            return response