"""
Vector Service
處理向量資料庫查詢與檢索
整合現有的 BERT + FAISS 推薦系統 + 新的多種資料庫
"""

import numpy as np
import os
from django.conf import settings
from utils.recommendation_service import RecommendationService
from .vector_db_implementations import (
    UserVectorDB,
    PetVectorDB,
    FeedVectorDB,
    SystemOperationVectorDB,
    SystemFAQVectorDB,
    DiseaseArchiveVectorDB
)


class VectorService:
    """向量資料庫服務 - 統一管理所有向量資料庫"""

    def __init__(self):
        # 使用現有的推薦服務（BERT + FAISS）
        self.recommendation_service = RecommendationService()
        self.base_dir = settings.BASE_DIR

        # 初始化各種向量資料庫（延遲載入）
        self._user_db = None
        self._pet_db = None
        self._feed_db = None
        self._system_operation_db = None
        self._system_faq_db = None
        self._disease_archive_db = None

        # 預先初始化常用的向量資料庫
        print("🔨 預先初始化常用向量資料庫...")
        _ = self.user_db  # 觸發使用者資料庫初始化
        _ = self.system_operation_db  # 觸發系統操作資料庫初始化
        _ = self.system_faq_db  # 觸發系統 FAQ 資料庫初始化
        print("✅ 常用向量資料庫初始化完成")

    @property
    def user_db(self):
        """使用者向量資料庫（延遲載入）"""
        if self._user_db is None:
            self._user_db = UserVectorDB(self.recommendation_service)
        return self._user_db

    @property
    def pet_db(self):
        """寵物向量資料庫（延遲載入）"""
        if self._pet_db is None:
            self._pet_db = PetVectorDB(self.recommendation_service)
        return self._pet_db

    @property
    def feed_db(self):
        """飼料向量資料庫（延遲載入）"""
        if self._feed_db is None:
            self._feed_db = FeedVectorDB(self.recommendation_service)
        return self._feed_db

    @property
    def system_operation_db(self):
        """系統操作資訊向量資料庫（延遲載入）"""
        if self._system_operation_db is None:
            self._system_operation_db = SystemOperationVectorDB(self.recommendation_service)
        return self._system_operation_db

    @property
    def system_faq_db(self):
        """系統導覽 FAQ 向量資料庫（延遲載入）"""
        if self._system_faq_db is None:
            self._system_faq_db = SystemFAQVectorDB(self.recommendation_service)
        return self._system_faq_db

    @property
    def disease_archive_db(self):
        """疾病檔案向量資料庫（延遲載入）"""
        if self._disease_archive_db is None:
            self._disease_archive_db = DiseaseArchiveVectorDB(self.recommendation_service)
        return self._disease_archive_db

    def _load_vector_db(self, db_name):
        """
        載入向量資料庫（使用現有的 .npy 格式）

        Args:
            db_name (str): 資料庫名稱

        Returns:
            dict: 包含 embeddings 和 ids 的字典
        """
        try:
            emb_path = os.path.join(self.base_dir, f'{db_name}_embs.npy')
            ids_path = os.path.join(self.base_dir, f'{db_name}_ids.npy')

            if os.path.exists(emb_path) and os.path.exists(ids_path):
                embeddings = np.load(emb_path)
                ids = np.load(ids_path)
                print(f"載入向量資料庫 {db_name}: {len(ids)} 筆資料")
                return {
                    'embeddings': embeddings,
                    'ids': ids
                }
            else:
                print(f"警告: 找不到向量資料庫 {db_name}")
                return None

        except Exception as e:
            print(f"載入向量資料庫 {db_name} 失敗: {str(e)}")
            return None

    def search_relevant_content(self, intent_data, user_input, top_k=5, context=None):
        """
        根據意圖搜尋相關內容

        Args:
            intent_data (dict): 意圖分析結果
            user_input (str): 使用者輸入
            top_k (int): 返回前 k 個最相關的結果
            context (dict): 上下文資訊（包含使用者資訊）

        Returns:
            dict: 檢索結果
        """
        intent = intent_data.get('intent')
        sub_type = intent_data.get('sub_type')
        entities = intent_data.get('entities', {})

        result = {
            'intent': intent,
            'sub_type': sub_type,
            'retrieved_data': {}
        }

        # 根據意圖類型選擇檢索策略
        if intent == 'operation':
            result['retrieved_data'] = self._handle_operation_intent(sub_type, entities, user_input)

        elif intent == 'health_consultation':
            # 傳遞 context 以便排除當前使用者的文章
            result['retrieved_data'] = self._handle_health_consultation_intent(
                sub_type, user_input, entities, top_k, context=context
            )

        elif intent == 'user_recommendation':
            # 傳遞 context 以便排除當前使用者
            result['retrieved_data'] = self._handle_user_recommendation_intent(
                sub_type, user_input, entities, top_k=3, context=context  # 固定返回最多 3 筆
            )

        elif intent == 'tutorial':
            result['retrieved_data'] = self._handle_tutorial_intent(sub_type, entities, user_input)

        elif intent == 'system_inquiry':
            result['retrieved_data'] = self._handle_system_inquiry_intent(sub_type, entities, user_input)

        elif intent == 'feeding':
            # 傳遞 context 以便獲取使用者的寵物資料
            result['retrieved_data'] = self._handle_feeding_intent(sub_type, user_input, entities, top_k, context=context)

        elif intent == 'general':
            result['retrieved_data'] = self._handle_general_intent(user_input, top_k)

        return result

    def _handle_operation_intent(self, sub_type, entities, user_input=None):
        """處理操作意圖 - 使用系統操作向量資料庫"""
        # 生成查詢向量
        query_embedding = self._generate_query_embedding(user_input or sub_type)

        # 在系統操作資料庫中搜尋
        operation_results = self.system_operation_db.search(
            query_embedding,
            top_k=3,
            min_similarity=0.5
        )

        # 取得最匹配的操作
        best_operation = operation_results[0] if operation_results else None

        return {
            'operation_type': sub_type,
            'params': entities,
            'requires_execution': True,
            'matched_operation': best_operation,
            'all_matches': operation_results
        }

    def _handle_health_consultation_intent(self, sub_type, user_input, entities, top_k, context=None):
        """
        處理健康諮詢意圖 - 根據症狀查找相似的疾病檔案

        Args:
            sub_type: symptom_similar, disease_info, health_advice
            user_input: 使用者輸入
            entities: 包含 petType, petBreed, symptoms
            top_k: 返回數量
            context: 上下文資訊（包含當前使用者 ID）
        """
        # 從 context 取得當前使用者 ID
        current_user_id = None
        if context and 'user' in context:
            current_user_id = context['user'].get('id')

        # 改進 1: 使用多種查詢策略
        # 策略 A: 使用結構化查詢（如果有提取到實體）
        structured_query_parts = []
        if entities.get('petType'):
            structured_query_parts.append(f"寵物類型: {entities['petType']}")
        if entities.get('petBreed'):
            structured_query_parts.append(f"品種: {entities['petBreed']}")
        if entities.get('symptoms'):
            structured_query_parts.append(f"症狀: {' '.join(entities['symptoms'])}")

        # 策略 B: 直接使用原始輸入（更自然，可能匹配更好）
        structured_query = ' '.join(structured_query_parts) if structured_query_parts else None
        natural_query = user_input

        # 優先使用結構化查詢，但如果沒有實體則用原始輸入
        primary_query = structured_query if structured_query else natural_query

        print(f"🔍 健康諮詢查詢:")
        print(f"  - 原始輸入: {user_input}")
        print(f"  - 提取實體: {entities}")
        print(f"  - 主要查詢: {primary_query}")

        # 生成查詢向量
        query_embedding = self._generate_query_embedding(primary_query)

        # 改進 2: 使用寬鬆的過濾條件
        # 只在確定有該資訊時才過濾，且只過濾擁有者
        filters = {}
        if current_user_id:
            filters['exclude_owner_id'] = current_user_id

        # 改進 3: 降低相似度閾值，增加搜尋範圍
        # 第一次嘗試：使用寬鬆過濾和較低閾值
        print(f"  - 搜尋參數: top_k={top_k * 2}, min_similarity=0.2, filters={filters}")
        similar_cases = self.disease_archive_db.search(
            query_embedding,
            top_k=top_k * 2,  # 搜尋更多結果
            min_similarity=0.2,  # 降低閾值從 0.3 到 0.2
            filters=filters
        )

        print(f"  - 找到案例數: {len(similar_cases)}")
        if len(similar_cases) > 0:
            print(f"  - 所有案例詳情:")
            for case in similar_cases:
                metadata = case.get('metadata', {})
                print(f"      案例 {metadata.get('archive_id')}: 相似度={case.get('similarity'):.3f}, "
                      f"寵物={metadata.get('pet_type')}/{metadata.get('pet_breed')}, "
                      f"作者ID={metadata.get('owner_id')}")
        if similar_cases:
            print(f"  - 最高相似度: {similar_cases[0].get('similarity', 0):.3f}")
            print(f"  - 最低相似度: {similar_cases[-1].get('similarity', 0):.3f}")

        # 改進 4: 如果沒找到結果，嘗試更寬鬆的查詢
        if not similar_cases and structured_query != natural_query:
            print("  - 使用原始輸入重新搜尋...")
            query_embedding = self._generate_query_embedding(natural_query)
            similar_cases = self.disease_archive_db.search(
                query_embedding,
                top_k=top_k * 2,
                min_similarity=0.15,  # 更低的閾值
                filters={'exclude_owner_id': current_user_id} if current_user_id else None
            )
            print(f"  - 重新搜尋找到: {len(similar_cases)} 個案例")

        # 改進 5: 智能排序和過濾 - 確保返回最相關的案例
        # 新權重策略：症狀匹配 >> 寵物類型 > 品種 > 向量相似度
        if similar_cases:
            # 安全處理 None 值
            pet_type_lower = (entities.get('petType') or '').lower()
            pet_breed_lower = (entities.get('petBreed') or '').lower()
            symptoms = [s.lower() for s in entities.get('symptoms', []) if s]

            print(f"  - 查詢條件: 類型={pet_type_lower or '無'}, 品種={pet_breed_lower or '無'}, 症狀={symptoms or '無'}")

            def calculate_priority(case):
                """
                計算案例的優先級分數（越高越優先）

                新權重系統:
                - 症狀匹配: 每個 +100 分 (最重要！)
                - 寵物類型匹配: +80 分 (確保同類寵物)
                - 品種匹配: +50 分 (更精確)
                - 向量相似度: 0-50 分 (降低基礎分數影響)
                """
                metadata = case.get('metadata', {})

                # 基礎向量相似度分數 (降低到 0-50 分)
                score = case.get('similarity', 0) * 50

                # 安全處理 metadata 中的 None 值
                case_type = (metadata.get('pet_type') or '').lower()
                case_breed = (metadata.get('pet_breed') or '').lower()
                case_symptoms = (metadata.get('symptoms') or '').lower()

                # 品種匹配 +50 分
                breed_matched = False
                if pet_breed_lower and pet_breed_lower in case_breed:
                    score += 50
                    breed_matched = True
                    print(f"    案例 {metadata.get('archive_id')} 品種匹配 +50")

                # 寵物類型匹配 +80 分 (重要：確保狗的問題不會推薦貓的案例)
                type_matched = False
                if pet_type_lower and case_type == pet_type_lower:
                    score += 80
                    type_matched = True
                    print(f"    案例 {metadata.get('archive_id')} 類型匹配({case_type}) +80")

                # 症狀匹配 +100 分/個 (最重要！)
                matched_symptoms = 0
                matched_symptom_list = []
                for symptom in symptoms:
                    if symptom and symptom in case_symptoms:
                        matched_symptoms += 1
                        matched_symptom_list.append(symptom)

                if matched_symptoms > 0:
                    symptom_score = matched_symptoms * 100
                    score += symptom_score
                    print(f"    案例 {metadata.get('archive_id')} 症狀匹配({', '.join(matched_symptom_list)}) x{matched_symptoms} +{symptom_score}")

                # 記錄匹配詳情
                case['match_details'] = {
                    'type_matched': type_matched,
                    'breed_matched': breed_matched,
                    'symptom_matched_count': matched_symptoms,
                    'base_similarity': case.get('similarity', 0)
                }

                return score

            # 計算每個案例的優先級
            print("  - 計算案例優先級:")
            for case in similar_cases:
                case['priority_score'] = calculate_priority(case)

            # 過濾策略：如果有明確的寵物類型或症狀，進行強制過濾
            filtered_cases = similar_cases

            # 強制過濾 1: 如果有寵物類型，必須類型匹配
            if pet_type_lower and len(similar_cases) >= top_k:
                type_matched_cases = [c for c in similar_cases if c.get('match_details', {}).get('type_matched')]
                if len(type_matched_cases) >= top_k:
                    filtered_cases = type_matched_cases
                    print(f"  - ✅ 強制過濾: 只保留類型匹配的案例 ({len(type_matched_cases)} 個)")

            # 強制過濾 2: 如果有症狀，優先選擇有症狀匹配的案例
            if symptoms and len(filtered_cases) >= top_k:
                symptom_matched_cases = [c for c in filtered_cases if c.get('match_details', {}).get('symptom_matched_count', 0) > 0]
                if len(symptom_matched_cases) >= top_k:
                    filtered_cases = symptom_matched_cases
                    print(f"  - ✅ 強制過濾: 優先選擇有症狀匹配的案例 ({len(symptom_matched_cases)} 個)")

            # 排序並取前 top_k
            filtered_cases.sort(key=lambda x: x['priority_score'], reverse=True)
            similar_cases = filtered_cases[:top_k]

            print(f"  - 排序後的案例優先級分數: {[round(c['priority_score'], 1) for c in similar_cases]}")
            print(f"  - 最終返回案例:")
            for i, case in enumerate(similar_cases, 1):
                details = case.get('match_details', {})
                metadata = case.get('metadata', {})
                print(f"    {i}. 案例 {metadata.get('archive_id')}: "
                      f"分數={case['priority_score']:.1f}, "
                      f"類型匹配={'✅' if details.get('type_matched') else '❌'}, "
                      f"症狀匹配數={details.get('symptom_matched_count', 0)}")
        else:
            print("  - ⚠️ 未找到任何案例")
            similar_cases = []

        return {
            'consultation_type': sub_type,
            'pet_info': {
                'type': entities.get('petType'),
                'breed': entities.get('petBreed'),
            },
            'symptoms': entities.get('symptoms', []),
            'similar_cases': similar_cases,
            'case_count': len(similar_cases)
        }

    def _handle_user_recommendation_intent(self, sub_type, user_input, entities, top_k, context=None):
        """
        處理用戶推薦意圖 - 推薦相似的飼主

        Args:
            sub_type: by_pet, by_interest, by_location
            user_input: 使用者輸入
            entities: 包含 petBreed
            top_k: 返回數量
            context: 上下文資訊（包含當前使用者 ID）
        """
        # 從 context 取得當前使用者 ID
        current_user_id = None
        if context and 'user' in context:
            current_user_id = context['user'].get('id')

        # 使用用戶向量資料庫推薦
        return self._search_similar_users(user_input, entities, top_k, exclude_user_id=current_user_id)

    def _handle_tutorial_intent(self, sub_type, entities, user_input=None):
        """處理教學意圖 - 使用系統操作向量資料庫"""
        # 生成查詢向量
        query_embedding = self._generate_query_embedding(user_input or sub_type)

        # 在系統操作資料庫中搜尋教學相關操作
        tutorial_results = self.system_operation_db.search(
            query_embedding,
            top_k=3,
            min_similarity=0.5
        )

        return {
            'tutorial_type': sub_type,
            'tutorial_params': entities,
            'matched_tutorials': tutorial_results
        }

    def _handle_system_inquiry_intent(self, sub_type, entities, user_input=None):
        """處理系統諮詢意圖 - 使用系統 FAQ 向量資料庫"""
        # 生成查詢向量
        query_embedding = self._generate_query_embedding(user_input or sub_type)

        # 在系統 FAQ 資料庫中搜尋
        faq_results = self.system_faq_db.search(
            query_embedding,
            top_k=3,
            min_similarity=0.4  # FAQ 可以稍微寬鬆一點
        )

        # 取得最匹配的 FAQ
        best_faq = faq_results[0] if faq_results else None

        return {
            'inquiry_type': sub_type,
            'inquiry_params': entities,
            'matched_faqs': faq_results,
            'best_faq': best_faq
        }

    def _handle_feeding_intent(self, sub_type, user_input, entities, top_k=5, context=None):
        """
        處理飼料建議意圖 - 使用飼料向量資料庫

        Args:
            sub_type: recommendation, comparison, nutrition
            user_input: 使用者輸入
            entities: 實體資訊
            top_k: 返回數量
            context: 上下文資訊（包含當前使用者）
        """
        # 生成查詢向量
        query_embedding = self._generate_query_embedding(user_input)

        # 在飼料資料庫中搜尋（使用較低的相似度閾值以提高召回率）
        feed_results = self.feed_db.search(
            query_embedding,
            top_k=top_k,
            min_similarity=0.1  # 降低閾值，提高搜尋結果覆蓋率
        )

        # 獲取使用者的寵物資料和健康報告
        user_pets_data = []
        if context and 'user' in context:
            user_pets_data = self._get_user_pets_info(context['user'].get('id'))

        return {
            'feeding_type': sub_type,
            'pet_profile': entities,
            'recommended_feeds': feed_results,
            'user_pets': user_pets_data,  # 新增：使用者的寵物資料
            'requires_calculation': True
        }

    def _handle_general_intent(self, user_input, top_k):
        """處理一般對話意圖"""
        # 嘗試搜尋相關內容
        similar_content = self._search_similar_posts(user_input, {}, top_k)
        return {
            'conversation_type': 'general',
            'context': similar_content if similar_content.get('posts') else {}
        }

    def _search_similar_posts(self, query_text, entities, top_k=5):
        """
        使用 BERT 向量相似度搜尋相關貼文

        Args:
            query_text (str): 查詢文字
            entities (dict): 實體資訊
            top_k (int): 返回數量

        Returns:
            dict: 搜尋結果
        """
        try:
            # 使用現有的 BERT 模型生成查詢向量
            query_embedding = self._generate_query_embedding(query_text)

            if query_embedding is None:
                return {}

            # 在社交貼文中搜尋
            social_results = self._search_with_faiss(
                query_embedding,
                content_type='social',
                top_k=top_k
            )

            # 在論壇貼文中搜尋
            forum_results = self._search_with_faiss(
                query_embedding,
                content_type='forum',
                top_k=top_k
            )

            return {
                'posts': {
                    'social': social_results,
                    'forum': forum_results
                },
                'entities': entities
            }

        except Exception as e:
            print(f"搜尋貼文失敗: {str(e)}")
            return {}

    def _generate_query_embedding(self, query_text):
        """
        使用 BERT 模型生成查詢向量

        Args:
            query_text (str): 查詢文字

        Returns:
            np.array: 查詢向量
        """
        try:
            import torch

            # 使用推薦服務的 tokenizer 和 model
            encoded = self.recommendation_service.tokenizer(
                [query_text],
                padding=True,
                truncation=True,
                return_tensors="pt"
            ).to(self.recommendation_service.device)

            with torch.no_grad():
                outputs = self.recommendation_service.model(**encoded)
                emb = self.recommendation_service._RecommendationService__mean_pooling(
                    outputs,
                    encoded.attention_mask
                )
                emb = torch.nn.functional.normalize(emb, p=2, dim=1)
                emb = emb.cpu().numpy()

            return emb[0]  # 返回單個向量

        except Exception as e:
            print(f"生成查詢向量失敗: {str(e)}")
            return None

    def _search_with_faiss(self, query_embedding, content_type, top_k):
        """
        使用 FAISS 執行向量相似度搜尋

        Args:
            query_embedding (np.array): 查詢向量
            content_type (str): 內容類型 ('social' 或 'forum')
            top_k (int): 返回數量

        Returns:
            list: 搜尋結果（id 和相似度）
        """
        try:
            import faiss

            # 載入向量資料庫
            post_ids = np.load(os.path.join(self.base_dir, f'{content_type}_post_ids.npy'))
            post_embeddings = np.load(os.path.join(self.base_dir, f'{content_type}_post_embs.npy'))

            if len(post_ids) == 0:
                return []

            # 建立 FAISS 索引
            dimension = post_embeddings.shape[1]
            index = faiss.IndexFlatIP(dimension)  # Inner Product for cosine similarity
            index.add(post_embeddings.astype(np.float32))

            # 搜尋
            q = query_embedding.astype("float32").reshape(1, -1)
            distances, indices = index.search(q, k=min(top_k, len(post_ids)))

            # 格式化結果
            results = []
            for i, idx in enumerate(indices[0]):
                if idx < len(post_ids):  # 確保索引有效
                    results.append({
                        'id': int(post_ids[idx]),
                        'similarity': float(distances[0][i])
                    })

            return results

        except Exception as e:
            print(f"FAISS 搜尋失敗 ({content_type}): {str(e)}")
            return []

    def _search_similar_users(self, query_text, entities, top_k=5, exclude_user_id=None):
        """
        使用用戶向量資料庫搜尋相似用戶 (改進版: 基於寵物品種精確匹配 + 向量相似度)

        Args:
            query_text (str): 查詢文字
            entities (dict): 實體資訊
            top_k (int): 返回數量（最多 3 筆）
            exclude_user_id (int): 要排除的使用者 ID（當前使用者）

        Returns:
            dict: 搜尋結果
        """
        try:
            from accounts.models import CustomUser
            from pets.models import Pet

            # 限制最多返回 3 筆
            actual_top_k = min(top_k, 3)

            # 取得當前使用者已追蹤的用戶 ID 列表
            following_ids = set()
            if exclude_user_id:
                following_ids = self._get_following_user_ids(exclude_user_id)

            # 提取查詢條件
            pet_breed = entities.get('petBreed', '').strip() if entities.get('petBreed') else None
            pet_type = entities.get('petType', '').strip() if entities.get('petType') else None

            print(f"🔍 用戶推薦查詢:")
            print(f"  - 原始輸入: {query_text}")
            print(f"  - 提取品種: {pet_breed}")
            print(f"  - 提取類型: {pet_type}")

            # 策略 1: 如果有明確的品種，優先使用資料庫精確匹配 + 向量搜尋混合
            if pet_breed:
                print(f"  - 使用混合策略: 資料庫品種匹配 + 向量相似度")

                # 1a. 從資料庫找出所有養該品種寵物的公開用戶
                breed_matched_users = self._get_users_by_pet_breed(
                    pet_breed,
                    pet_type,
                    exclude_user_id,
                    following_ids
                )
                print(f"  - 品種精確匹配: {len(breed_matched_users)} 個用戶")

                # 1b. 同時使用向量搜尋獲取語義相似用戶
                query_embedding = self._generate_query_embedding(query_text)
                vector_results = []
                if query_embedding is not None:
                    vector_results = self.user_db.search(
                        query_embedding,
                        top_k=50,  # 搜尋更多以便後續排序
                        min_similarity=0.2  # 降低閾值，擴大搜尋範圍
                    )
                    print(f"  - 向量搜尋: {len(vector_results)} 個用戶")

                # 1c. 合併結果並計算綜合分數
                user_results = self._merge_and_rank_users(
                    breed_matched_users,
                    vector_results,
                    pet_breed,
                    pet_type,
                    exclude_user_id,
                    following_ids
                )

            # 策略 2: 只有寵物類型，使用資料庫匹配 + 向量搜尋
            elif pet_type:
                print(f"  - 使用混合策略: 資料庫類型匹配 + 向量相似度")

                # 2a. 從資料庫找出所有養該類型寵物的用戶
                type_matched_users = self._get_users_by_pet_type(
                    pet_type,
                    exclude_user_id,
                    following_ids
                )
                print(f"  - 類型匹配: {len(type_matched_users)} 個用戶")

                # 2b. 向量搜尋
                query_embedding = self._generate_query_embedding(query_text)
                vector_results = []
                if query_embedding is not None:
                    vector_results = self.user_db.search(
                        query_embedding,
                        top_k=50,
                        min_similarity=0.2
                    )
                    print(f"  - 向量搜尋: {len(vector_results)} 個用戶")

                # 2c. 合併結果
                user_results = self._merge_and_rank_users(
                    type_matched_users,
                    vector_results,
                    None,  # 無品種
                    pet_type,
                    exclude_user_id,
                    following_ids
                )

            # 策略 3: 沒有具體條件，純向量搜尋
            else:
                print(f"  - 使用純向量搜尋策略")
                query_embedding = self._generate_query_embedding(query_text)

                if query_embedding is None:
                    user_results = []
                else:
                    vector_results = self.user_db.search(
                        query_embedding,
                        top_k=50,
                        min_similarity=0.2
                    )

                    # 過濾並計算分數
                    user_results = self._merge_and_rank_users(
                        [],
                        vector_results,
                        None,
                        None,
                        exclude_user_id,
                        following_ids
                    )

            # 限制返回數量
            user_results = user_results[:actual_top_k]

            print(f"  - 最終返回: {len(user_results)} 個用戶")
            if user_results:
                for i, user in enumerate(user_results[:3], 1):
                    print(f"    {i}. 用戶 {user.get('id')}: 分數={user.get('score', 0):.3f}")

            return {
                'recommendation_type': 'users',
                'users': user_results,
                'match_criteria': entities
            }

        except Exception as e:
            print(f"搜尋用戶失敗: {str(e)}")
            import traceback
            traceback.print_exc()

            # Fallback
            return {
                'recommendation_type': 'users',
                'users': [],
                'match_criteria': entities
            }

    def _get_users_by_pet_breed(self, pet_breed, pet_type, exclude_user_id, following_ids):
        """
        從資料庫獲取養特定品種寵物的用戶

        Args:
            pet_breed (str): 寵物品種
            pet_type (str): 寵物類型 (可選)
            exclude_user_id (int): 要排除的用戶ID
            following_ids (set): 已追蹤的用戶ID集合

        Returns:
            list: 用戶ID列表，每個包含 {'id': user_id, 'breed_match': True}
        """
        try:
            from pets.models import Pet
            from accounts.models import CustomUser
            from django.db.models import Q

            # 構建查詢條件 (品種模糊匹配 + 類型精確匹配)
            breed_query = Q(breed__icontains=pet_breed)
            if pet_type:
                breed_query &= Q(pet_type__iexact=pet_type)

            # 查詢符合條件的寵物，並取得擁有者
            matched_pets = Pet.objects.filter(breed_query).select_related('owner')

            # 收集用戶ID (去重、排除當前用戶和已追蹤用戶、只保留公開帳戶)
            user_ids = set()
            for pet in matched_pets:
                if pet.owner and pet.owner.account_privacy == 'public':
                    user_id = pet.owner.id
                    if user_id != exclude_user_id and user_id not in following_ids:
                        user_ids.add(user_id)

            # 返回格式
            return [{'id': uid, 'breed_match': True} for uid in user_ids]

        except Exception as e:
            print(f"從資料庫獲取品種匹配用戶失敗: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    def _get_users_by_pet_type(self, pet_type, exclude_user_id, following_ids):
        """
        從資料庫獲取養特定類型寵物的用戶

        Args:
            pet_type (str): 寵物類型
            exclude_user_id (int): 要排除的用戶ID
            following_ids (set): 已追蹤的用戶ID集合

        Returns:
            list: 用戶ID列表
        """
        try:
            from pets.models import Pet

            # 查詢符合條件的寵物
            matched_pets = Pet.objects.filter(
                pet_type__iexact=pet_type
            ).select_related('owner')

            # 收集用戶ID
            user_ids = set()
            for pet in matched_pets:
                if pet.owner and pet.owner.account_privacy == 'public':
                    user_id = pet.owner.id
                    if user_id != exclude_user_id and user_id not in following_ids:
                        user_ids.add(user_id)

            return [{'id': uid, 'type_match': True} for uid in user_ids]

        except Exception as e:
            print(f"從資料庫獲取類型匹配用戶失敗: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    def _merge_and_rank_users(self, db_matched_users, vector_results, pet_breed, pet_type, exclude_user_id, following_ids):
        """
        合併資料庫匹配和向量搜尋結果，並計算綜合分數排序

        權重策略:
        - 品種精確匹配: +100 分 (最高優先級)
        - 類型匹配: +50 分
        - 向量相似度: 0-100 分 (原始相似度 * 100)

        Args:
            db_matched_users (list): 資料庫匹配的用戶
            vector_results (list): 向量搜尋結果
            pet_breed (str): 查詢的品種
            pet_type (str): 查詢的類型
            exclude_user_id (int): 排除的用戶ID
            following_ids (set): 已追蹤的用戶ID

        Returns:
            list: 排序後的用戶列表
        """
        try:
            from pets.models import Pet

            # 建立用戶分數字典
            user_scores = {}

            # 1. 處理資料庫匹配的用戶
            for user in db_matched_users:
                user_id = user['id']
                user_scores[user_id] = {
                    'id': user_id,
                    'score': 0.0,
                    'breed_match': user.get('breed_match', False),
                    'type_match': user.get('type_match', False),
                    'vector_similarity': 0.0
                }

                # 品種精確匹配加 100 分
                if user.get('breed_match'):
                    user_scores[user_id]['score'] += 100

                # 類型匹配加 50 分
                if user.get('type_match'):
                    user_scores[user_id]['score'] += 50

            # 2. 處理向量搜尋結果
            for result in vector_results:
                user_id = result['id']

                # 過濾
                if user_id == exclude_user_id or user_id in following_ids:
                    continue

                vector_sim = result.get('similarity', 0.0)

                # 如果用戶已在字典中，更新向量相似度
                if user_id in user_scores:
                    user_scores[user_id]['vector_similarity'] = vector_sim
                    user_scores[user_id]['score'] += vector_sim * 100  # 向量相似度轉為 0-100 分
                else:
                    # 新用戶，檢查是否匹配品種/類型
                    breed_match, type_match = self._check_user_pet_match(user_id, pet_breed, pet_type)

                    score = vector_sim * 100  # 基礎向量分數

                    if breed_match:
                        score += 100  # 品種匹配加分
                    if type_match:
                        score += 50   # 類型匹配加分

                    user_scores[user_id] = {
                        'id': user_id,
                        'score': score,
                        'breed_match': breed_match,
                        'type_match': type_match,
                        'vector_similarity': vector_sim
                    }

            # 3. 排序 (分數由高到低)
            sorted_users = sorted(
                user_scores.values(),
                key=lambda x: x['score'],
                reverse=True
            )

            return sorted_users

        except Exception as e:
            print(f"合併和排序用戶失敗: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    def _check_user_pet_match(self, user_id, pet_breed, pet_type):
        """
        檢查用戶的寵物是否匹配品種/類型

        Args:
            user_id (int): 用戶ID
            pet_breed (str): 查詢的品種
            pet_type (str): 查詢的類型

        Returns:
            tuple: (breed_match, type_match)
        """
        try:
            from pets.models import Pet

            user_pets = Pet.objects.filter(owner_id=user_id)

            breed_match = False
            type_match = False

            for pet in user_pets:
                # 檢查類型匹配
                if pet_type and pet.pet_type and pet.pet_type.lower() == pet_type.lower():
                    type_match = True

                # 檢查品種匹配 (模糊匹配)
                if pet_breed and pet.breed and pet_breed.lower() in pet.breed.lower():
                    breed_match = True

            return breed_match, type_match

        except Exception as e:
            print(f"檢查用戶寵物匹配失敗: {str(e)}")
            return False, False

    def _get_following_user_ids(self, user_id):
        """
        取得指定用戶正在追蹤的所有用戶 ID

        Args:
            user_id (int): 當前使用者 ID

        Returns:
            set: 已追蹤的用戶 ID 集合
        """
        try:
            from accounts.models import UserFollow

            # 查詢當前使用者追蹤的所有用戶（只查詢已確認的追蹤關係）
            following = UserFollow.objects.filter(
                user_id=user_id,
                confirm_or_not=True  # 只取得已確認的追蹤關係
            ).values_list('follows_id', flat=True)

            return set(following)

        except Exception as e:
            print(f"取得追蹤列表失敗: {str(e)}")
            import traceback
            traceback.print_exc()
            return set()

    def _filter_cases_by_author(self, cases, exclude_user_id):
        """
        過濾掉指定用戶發表的疾病檔案案例

        Args:
            cases (list): 案例列表（包含 id 和 similarity）
            exclude_user_id (int): 要排除的使用者 ID

        Returns:
            list: 過濾後的案例列表
        """
        try:
            from pets.models import DiseaseArchiveContent

            # 取得所有案例 ID
            case_ids = [case['id'] for case in cases]

            # 查詢這些案例的作者 ID
            archives = DiseaseArchiveContent.objects.filter(
                id__in=case_ids
            ).values('id', 'pet__owner_id')

            # 建立 ID 到作者的映射
            author_map = {archive['id']: archive['pet__owner_id'] for archive in archives}

            # 過濾掉當前使用者的案例
            filtered_cases = [
                case for case in cases
                if author_map.get(case['id']) != exclude_user_id
            ]

            return filtered_cases

        except Exception as e:
            print(f"過濾案例失敗: {str(e)}")
            import traceback
            traceback.print_exc()
            # 發生錯誤時返回原始列表
            return cases

    def _get_user_pets_info(self, user_id):
        """
        獲取使用者的寵物資料和最近的健康報告

        Args:
            user_id (int): 使用者 ID

        Returns:
            list: 寵物資料列表（包含基本資訊和最近健康報告）
        """
        try:
            from pets.models import Pet
            from ocrapp.models import HealthReport

            # 查詢使用者的所有寵物
            pets = Pet.objects.filter(owner_id=user_id).select_related('owner')

            pets_data = []
            for pet in pets:
                pet_info = {
                    'id': pet.id,
                    'name': pet.pet_name,
                    'type': pet.pet_type,
                    'breed': pet.breed,
                    'age': pet.age,
                    'weight': pet.weight,
                    'pet_stage': pet.pet_stage,
                }

                # 獲取最近的健康報告（最多3筆）
                recent_reports = HealthReport.objects.filter(
                    pet=pet
                ).order_by('-check_date')[:3]

                if recent_reports:
                    pet_info['recent_health_reports'] = [
                        {
                            'date': report.check_date.strftime('%Y-%m-%d') if report.check_date else None,
                            'check_type': report.get_check_type_display() if report.check_type else None,
                            'check_location': report.check_location,
                            'notes': report.notes,
                        }
                        for report in recent_reports
                    ]

                pets_data.append(pet_info)

            return pets_data

        except Exception as e:
            print(f"獲取使用者寵物資料失敗: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    def _search_similar_pets(self, query_text, entities, top_k=5):
        """
        使用寵物向量資料庫搜尋相似寵物

        Args:
            query_text (str): 查詢文字
            entities (dict): 實體資訊
            top_k (int): 返回數量

        Returns:
            dict: 搜尋結果
        """
        try:
            # 生成查詢向量
            query_embedding = self._generate_query_embedding(query_text)

            if query_embedding is None:
                return {}

            # 在寵物資料庫中搜尋
            pet_results = self.pet_db.search(
                query_embedding,
                top_k=top_k,
                min_similarity=0.3
            )

            return {
                'recommendation_type': 'pets',
                'pets': pet_results,
                'match_criteria': entities
            }

        except Exception as e:
            print(f"搜尋寵物失敗: {str(e)}")
            return {}

    def _get_recommended_users(self, entities, top_k=3):
        """
        獲取推薦用戶（Fallback 實作）
        當向量搜尋失敗時使用

        Args:
            entities (dict): 實體資訊
            top_k (int): 返回數量（最多 3 筆）

        Returns:
            list: 推薦用戶 ID 列表
        """
        # Fallback: 返回固定的推薦用戶
        # 未來可以根據 entities 中的寵物品種、興趣等進行真實推薦
        demo_users = [
            {'user_id': 1, 'match_reason': '同樣養布偶貓', 'score': 0.85},
            {'user_id': 2, 'match_reason': '布偶貓愛好者', 'score': 0.78},
            {'user_id': 3, 'match_reason': '專業布偶貓飼主', 'score': 0.92}
        ]
        # 限制返回數量
        return demo_users[:min(top_k, 3)]

    def get_post_details(self, post_ids, post_type='social'):
        """
        根據 ID 獲取貼文詳細資料

        Args:
            post_ids (list): 貼文 ID 列表
            post_type (str): 貼文類型 ('social' 或 'forum')

        Returns:
            list: 貼文詳細資料
        """
        from social.models import Post as SocialPost
        from comments.models import ForumPost

        try:
            if post_type == 'social':
                posts = SocialPost.objects.filter(id__in=post_ids).select_related('author')
                return [
                    {
                        'id': post.id,
                        'author': post.author.user_fullname,
                        'content': post.content[:100] + '...' if len(post.content) > 100 else post.content,
                        'created_at': post.created_at.isoformat(),
                        'pet_tags': [tag.pet_name for tag in post.pet_tags.all()]
                    }
                    for post in posts
                ]

            elif post_type == 'forum':
                posts = ForumPost.objects.filter(id__in=post_ids).select_related('author')
                return [
                    {
                        'id': post.id,
                        'title': post.title,
                        'author': post.author.user_fullname,
                        'created_at': post.created_at.isoformat(),
                        'category': post.category
                    }
                    for post in posts
                ]

        except Exception as e:
            print(f"獲取貼文詳細資料失敗: {str(e)}")
            return []