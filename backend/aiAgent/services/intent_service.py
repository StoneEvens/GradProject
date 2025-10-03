"""
Intent Service
整合 OpenAI 意圖識別與向量資料庫檢索
"""

from .openai_service import OpenAIService
from .vector_service import VectorService


class IntentService:
    """意圖分析與資料檢索整合服務"""

    def __init__(self):
        self.openai_service = OpenAIService()
        self.vector_service = VectorService()

    def process_user_input(self, user_input, context=None):
        """
        處理使用者輸入的完整流程

        Args:
            user_input (str): 使用者輸入
            context (dict): 對話上下文

        Returns:
            dict: 處理結果
        """
        try:
            # 步驟 1: 使用 OpenAI 分析意圖
            intent_result = self.openai_service.analyze_intent(user_input, context)

            if not intent_result['success']:
                return {
                    'success': False,
                    'error': 'Intent analysis failed',
                    'fallback': intent_result.get('fallback', {})
                }

            intent_data = intent_result['data']

            # 步驟 2: 根據意圖從向量資料庫檢索相關資料
            retrieved_data = self.vector_service.search_relevant_content(
                intent_data,
                user_input,
                top_k=3,  # 最多返回 3 篇相關文章
                context=context  # 傳遞 context 以便排除當前使用者
            )

            # 步驟 2.5: 如果是健康諮詢，取得完整案例詳情
            case_details = None
            if intent_data.get('intent') == 'health_consultation':
                case_details = self._get_case_details(retrieved_data)

            # 步驟 3: 使用 OpenAI 生成最終回應
            response_result = self.openai_service.generate_response(
                intent_data,
                retrieved_data,
                user_input,
                case_details=case_details
            )

            if not response_result['success']:
                return {
                    'success': False,
                    'error': 'Response generation failed',
                    'fallback': response_result.get('fallback', {})
                }

            response_data = response_result['data']

            # 整合所有資訊
            return {
                'success': True,
                'response': response_data.get('response', ''),
                'intent': intent_data.get('intent'),
                'confidence': intent_data.get('confidence', 0.0),
                'entities': intent_data.get('entities', {}),
                'ui_controls': response_data.get('ui_controls', {}),
                'additional_data': response_data.get('additional_data', {}),
                'retrieved_data': retrieved_data
            }

        except Exception as e:
            print(f"Intent Service 處理失敗: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'response': '抱歉，我暫時無法處理您的請求。請稍後再試。',
                'ui_controls': {},
                'additional_data': {}
            }

    def _get_case_details(self, retrieved_data):
        """
        從檢索結果中取得完整案例詳情

        Args:
            retrieved_data (dict): 向量資料庫檢索結果

        Returns:
            list: 完整的案例詳情列表
        """
        try:
            from pets.models import DiseaseArchiveContent

            # 從 retrieved_data 取得相似案例的 ID
            similar_cases = retrieved_data.get('retrieved_data', {}).get('similar_cases', [])
            if not similar_cases:
                return []

            # 取得 post_frame ID 列表
            post_ids = [case['id'] for case in similar_cases]

            # 從資料庫取得完整的 DiseaseArchiveContent
            disease_archives = DiseaseArchiveContent.objects.filter(
                postFrame_id__in=post_ids,
                is_private=False  # 只取得公開的疾病檔案
            ).select_related('postFrame__user', 'pet')

            # 格式化案例詳情
            case_details = []
            for archive in disease_archives:
                post_frame = archive.postFrame

                case_details.append({
                    'id': post_frame.id,
                    'archive_id': archive.id,
                    'archive_title': archive.archive_title,
                    'author': {
                        'username': post_frame.user.user_account,
                        'fullname': post_frame.user.user_fullname,
                    },
                    'content': archive.content,  # 完整內容
                    'pet_info': {
                        'name': archive.pet.pet_name if archive.pet else None,
                        'type': archive.pet.pet_type if archive.pet else None,
                        'breed': archive.pet.breed if archive.pet else None
                    },
                    'health_status': archive.health_status,
                    'go_to_doctor': archive.go_to_doctor,
                    'created_at': post_frame.created_at.isoformat(),
                })

            return case_details

        except Exception as e:
            print(f"取得案例詳情失敗: {str(e)}")
            import traceback
            traceback.print_exc()
            return []