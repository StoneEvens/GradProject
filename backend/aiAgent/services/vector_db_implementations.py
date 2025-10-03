"""
Vector Database Implementations
各種資料庫的具體實作
"""

import os
from .vector_db_manager import BaseVectorDBManager


class UserVectorDB(BaseVectorDBManager):
    """使用者向量資料庫"""

    def __init__(self, embedding_service):
        super().__init__('user', embedding_service)
        # 啟動時檢查並初始化向量檔案
        self._ensure_vector_files_exist()

    def _ensure_vector_files_exist(self):
        """確保向量檔案存在，如果不存在則初始化"""
        import os
        from django.conf import settings

        base_dir = settings.BASE_DIR
        emb_path = os.path.join(base_dir, 'user_embs.npy')
        ids_path = os.path.join(base_dir, 'user_ids.npy')

        # 如果檔案不存在，從資料庫初始化
        if not os.path.exists(emb_path) or not os.path.exists(ids_path):
            print("🔨 用戶向量檔案不存在，正在從資料庫建立...")
            self.initialize_from_db()
        else:
            print("✅ 用戶向量檔案已存在，跳過初始化")

    def initialize_from_db(self):
        """從資料庫初始化使用者向量"""
        from accounts.models import CustomUser

        print("🔨 正在從資料庫建立使用者向量索引...")

        users = CustomUser.objects.filter(
            account_privacy='public'  # 只索引公開帳號
        ).select_related()

        data_array = []
        for user in users:
            text = self.get_text_for_embedding(user)
            data_array.append({
                'id': user.id,
                'text': text,
                'metadata': {
                    'username': user.user_account,
                    'fullname': user.user_fullname,
                    'privacy': user.account_privacy
                }
            })

        if data_array:
            self.build_index(data_array)
            print(f"✅ 成功建立 {len(data_array)} 個用戶的向量索引")
        else:
            print("⚠️ 沒有公開使用者可建立索引")

    def get_text_for_embedding(self, user):
        """
        組合使用者資訊為文本

        包含: 使用者名稱、全名、自我介紹、寵物資訊
        """
        text_parts = [
            user.user_fullname,
            user.user_account,
        ]

        # 加入自我介紹（如果有）
        if hasattr(user, 'bio') and user.bio:
            text_parts.append(user.bio)

        # 加入寵物資訊
        pets = user.pets.all()
        for pet in pets:
            text_parts.append(f"{pet.pet_name} {pet.pet_type}")
            if hasattr(pet, 'breed') and pet.breed:
                text_parts.append(pet.breed)

        return ' '.join(text_parts)

    def add_user(self, user):
        """
        添加或更新用戶向量

        Args:
            user: CustomUser 實例
        """
        # 只處理公開帳戶
        if user.account_privacy != 'public':
            print(f"⚠️ 用戶 {user.user_account} 不是公開帳戶，跳過向量添加")
            # 如果之前是公開的，現在改為私人，需要刪除
            if user.id in self.ids:
                self.delete_item(user.id)
            return

        text = self.get_text_for_embedding(user)
        metadata = {
            'username': user.user_account,
            'fullname': user.user_fullname,
            'privacy': user.account_privacy
        }

        # 如果用戶已存在，先刪除舊的
        if user.id in self.ids:
            self.delete_item(user.id)

        # 添加新的向量
        self.add_item(user.id, text, metadata)
        print(f"✅ 已更新用戶向量: {user.user_account} (ID={user.id})")

    def remove_user(self, user_id):
        """
        移除用戶向量

        Args:
            user_id: 用戶 ID
        """
        self.delete_item(user_id)


class PetVectorDB(BaseVectorDBManager):
    """寵物向量資料庫"""

    def __init__(self, embedding_service):
        super().__init__('pet', embedding_service)

    def initialize_from_db(self):
        """從資料庫初始化寵物向量"""
        from pets.models import Pet

        print("🔨 正在從資料庫建立寵物向量索引...")

        pets = Pet.objects.select_related('owner').all()

        data_array = []
        for pet in pets:
            text = self.get_text_for_embedding(pet)
            data_array.append({
                'id': pet.id,
                'text': text,
                'metadata': {
                    'name': pet.pet_name,
                    'type': pet.pet_type,
                    'owner': pet.owner.user_account if pet.owner else None
                }
            })

        if data_array:
            self.build_index(data_array)
        else:
            print("⚠️ 沒有寵物資料可建立索引")

    def get_text_for_embedding(self, pet):
        """
        組合寵物資訊為文本

        包含: 名稱、類型、品種、年齡、性別、特徵、健康狀況
        """
        text_parts = [
            pet.pet_name,
            pet.pet_type,
        ]

        # 基本資訊
        if hasattr(pet, 'breed') and pet.breed:
            text_parts.append(pet.breed)

        if hasattr(pet, 'gender') and pet.gender:
            text_parts.append(pet.gender)

        if hasattr(pet, 'age'):
            text_parts.append(f"{pet.age}歲")

        # 特徵描述
        if hasattr(pet, 'characteristics') and pet.characteristics:
            text_parts.append(pet.characteristics)

        # 健康狀況
        if hasattr(pet, 'health_status') and pet.health_status:
            text_parts.append(pet.health_status)

        return ' '.join(text_parts)


class FeedVectorDB(BaseVectorDBManager):
    """飼料向量資料庫"""

    def __init__(self, embedding_service):
        super().__init__('feed', embedding_service)
        self._ensure_vector_files_exist()

    def _ensure_vector_files_exist(self):
        """確保向量檔案存在，如果不存在則初始化"""
        if not os.path.exists(self.emb_path):
            print("🔨 飼料向量檔案不存在，正在從資料庫建立...")
            self.initialize_from_db()
        else:
            print("✅ 飼料向量檔案已存在，跳過初始化")

    def initialize_from_db(self):
        """從資料庫載入飼料資料並建立向量索引"""
        print("🔨 正在建立飼料向量索引...")

        try:
            from feeds.models import Feed

            # 查詢所有飼料（包含未驗證的）
            feeds = Feed.objects.all()

            data_array = []
            for feed in feeds:
                text = self.get_text_for_embedding(feed)
                data_array.append({
                    'id': feed.id,
                    'text': text,
                    'metadata': {
                        'name': feed.name,
                        'brand': feed.brand,
                        'pet_type': feed.get_pet_type_display(),
                        'protein': feed.protein,
                        'fat': feed.fat,
                        'price': float(feed.price) if feed.price else 0,
                        'is_verified': feed.is_verified,  # 加入驗證狀態
                    }
                })

            if data_array:
                self.build_index(data_array)
                verified_count = sum(1 for item in data_array if item['metadata'].get('is_verified'))
                unverified_count = len(data_array) - verified_count
                print(f"✅ 成功建立飼料向量索引：{len(data_array)} 筆資料（已驗證：{verified_count}，未驗證：{unverified_count}）")
            else:
                print("⚠️ 沒有飼料資料可建立索引")

        except Exception as e:
            print(f"❌ 從資料庫建立飼料向量索引失敗: {str(e)}")
            import traceback
            traceback.print_exc()

    def get_text_for_embedding(self, feed):
        """
        組合飼料資訊為文本（從 Feed 模型）

        包含: 品牌、產品名、寵物類型、營養資訊
        """
        text_parts = []

        # 基本資訊
        if feed.brand:
            text_parts.append(feed.brand)
        if feed.name:
            text_parts.append(feed.name)

        # 寵物類型
        text_parts.append(feed.get_pet_type_display())

        # 營養資訊（用描述性文字）
        if feed.protein > 0:
            text_parts.append(f"蛋白質{feed.protein}%")
        if feed.fat > 0:
            text_parts.append(f"脂肪{feed.fat}%")
        if feed.carbohydrate > 0:
            text_parts.append(f"碳水化合物{feed.carbohydrate}%")

        # 礦物質
        if feed.calcium > 0:
            text_parts.append(f"鈣{feed.calcium}%")
        if feed.phosphorus > 0:
            text_parts.append(f"磷{feed.phosphorus}%")

        return ' '.join(text_parts)

    def add_feed(self, feed):
        """添加或更新飼料向量（包含所有飼料，不限制驗證狀態）"""
        text = self.get_text_for_embedding(feed)
        metadata = {
            'name': feed.name,
            'brand': feed.brand,
            'pet_type': feed.get_pet_type_display(),
            'protein': feed.protein,
            'fat': feed.fat,
            'price': float(feed.price) if feed.price else 0,
            'is_verified': feed.is_verified,  # 加入驗證狀態
        }

        # 如果已存在，先刪除舊的再添加新的
        if feed.id in self.ids:
            self.delete_item(feed.id)
        self.add_item(feed.id, text, metadata)

    def remove_feed(self, feed_id):
        """移除飼料向量"""
        self.delete_item(feed_id)


class SystemOperationVectorDB(BaseVectorDBManager):
    """系統操作資訊向量資料庫"""

    def __init__(self, embedding_service):
        super().__init__('system_operation', embedding_service)
        self._ensure_vector_files_exist()

    def _ensure_vector_files_exist(self):
        """確保向量檔案存在，如果不存在則初始化"""
        if not os.path.exists(self.emb_path):
            print("🔨 系統操作向量檔案不存在，正在從 JSON 建立...")
            self.initialize_from_db()
        else:
            print("✅ 系統操作向量檔案已存在，跳過初始化")

    def initialize_from_db(self):
        """從 JSON 檔案載入系統操作資料並建立向量索引"""
        print("🔨 正在建立系統操作資訊向量索引...")

        try:
            # 從 JSON 檔案載入操作資料
            operations_data = self.load_operations_from_json()

            data_array = []
            for operation in operations_data:
                text = self.get_text_for_embedding(operation)
                data_array.append({
                    'id': operation['id'],
                    'text': text,
                    'metadata': operation
                })

            if data_array:
                self.build_index(data_array)
                print(f"✅ 成功建立系統操作向量索引：{len(data_array)} 筆操作")
            else:
                print("⚠️ 沒有系統操作資料可建立索引")

        except Exception as e:
            print(f"❌ 從 JSON 建立系統操作向量索引失敗: {str(e)}")
            import traceback
            traceback.print_exc()

    def load_operations_from_json(self):
        """從 JSON 檔案載入系統操作資料"""
        import json
        from django.conf import settings

        json_path = os.path.join(settings.BASE_DIR, 'aiAgent', 'data', 'system_operations.json')

        if not os.path.exists(json_path):
            print(f"⚠️ 系統操作 JSON 檔案不存在: {json_path}")
            return []

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('operations', [])

    def get_text_for_embedding(self, operation):
        """
        組合系統操作資訊為文本

        包含: 操作名稱、描述、關鍵字、使用情境
        """
        text_parts = [
            operation['name'],
            operation['description'],
        ]

        # 關鍵字
        if 'keywords' in operation:
            text_parts.extend(operation['keywords'])

        # 使用情境
        if 'use_cases' in operation:
            text_parts.extend(operation['use_cases'])

        return ' '.join(text_parts)


class SystemFAQVectorDB(BaseVectorDBManager):
    """系統導覽 FAQ 向量資料庫"""

    def __init__(self, embedding_service):
        super().__init__('system_faq', embedding_service)
        self._ensure_vector_files_exist()

    def _ensure_vector_files_exist(self):
        """確保向量檔案存在，如果不存在則初始化"""
        if not os.path.exists(self.emb_path):
            print("🔨 系統 FAQ 向量檔案不存在，正在從 JSON 建立...")
            self.initialize_from_db()
        else:
            print("✅ 系統 FAQ 向量檔案已存在，跳過初始化")

    def initialize_from_db(self):
        """從 JSON 檔案載入 FAQ 資料並建立向量索引"""
        print("🔨 正在建立系統 FAQ 向量索引...")

        try:
            # 從 JSON 檔案載入 FAQ 資料
            faq_data = self.load_faq_from_json()

            data_array = []
            for faq in faq_data:
                text = self.get_text_for_embedding(faq)
                data_array.append({
                    'id': faq['id'],
                    'text': text,
                    'metadata': faq
                })

            if data_array:
                self.build_index(data_array)
                print(f"✅ 成功建立系統 FAQ 向量索引：{len(data_array)} 筆 FAQ")
            else:
                print("⚠️ 沒有系統 FAQ 資料可建立索引")

        except Exception as e:
            print(f"❌ 從 JSON 建立系統 FAQ 向量索引失敗: {str(e)}")
            import traceback
            traceback.print_exc()

    def load_faq_from_json(self):
        """從 JSON 檔案載入 FAQ 資料"""
        import json
        from django.conf import settings

        json_path = os.path.join(settings.BASE_DIR, 'aiAgent', 'data', 'system_faq.json')

        if not os.path.exists(json_path):
            print(f"⚠️ 系統 FAQ JSON 檔案不存在: {json_path}")
            return []

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('faqs', [])

    def get_text_for_embedding(self, faq):
        """
        組合 FAQ 資訊為文本

        包含: 問題名稱、描述、關鍵字、使用情境、答案
        """
        text_parts = [
            faq['name'],
            faq['description'],
        ]

        # 關鍵字
        if 'keywords' in faq:
            text_parts.extend(faq['keywords'])

        # 使用情境
        if 'use_cases' in faq:
            text_parts.extend(faq['use_cases'])

        # 答案（幫助提高搜尋準確度）
        if 'answer' in faq:
            text_parts.append(faq['answer'])

        return ' '.join(text_parts)


class DiseaseArchiveVectorDB(BaseVectorDBManager):
    """疾病檔案向量資料庫 - 包含完整的寵物和作者資訊"""

    def __init__(self, embedding_service):
        super().__init__('disease_archive', embedding_service)
        # 啟動時檢查並初始化向量檔案
        self._ensure_vector_files_exist()

    def _ensure_vector_files_exist(self):
        """確保向量檔案存在，如果不存在則初始化"""
        import os
        from django.conf import settings

        base_dir = settings.BASE_DIR
        emb_path = os.path.join(base_dir, 'disease_archive_embs.npy')
        ids_path = os.path.join(base_dir, 'disease_archive_ids.npy')
        metadata_path = os.path.join(base_dir, 'disease_archive_metadata.npy')

        # 如果檔案不存在，從資料庫初始化
        if not os.path.exists(emb_path) or not os.path.exists(ids_path) or not os.path.exists(metadata_path):
            print("🔨 疾病檔案向量檔案不存在，正在從資料庫建立...")
            self.initialize_from_db()
        else:
            print("✅ 疾病檔案向量檔案已存在，跳過初始化")

    def initialize_from_db(self):
        """從資料庫初始化疾病檔案向量"""
        from pets.models import DiseaseArchiveContent

        print("🔨 正在從資料庫建立疾病檔案向量索引...")

        # 只獲取公開的疾病檔案，並關聯寵物和作者資訊
        # 使用 prefetch_related 預載關聯的疾病和症狀
        from django.db.models import Prefetch

        archives = DiseaseArchiveContent.objects.filter(
            is_private=False  # 只索引公開的疾病檔案
        ).select_related(
            'pet',
            'pet__owner',
            'postFrame'
        ).prefetch_related(
            'illnesses__illness',  # 預載疾病
            'abnormal_posts__post__symptoms__symptom'  # 預載症狀
        ).all()

        print(f"📊 找到 {archives.count()} 筆公開的疾病檔案")

        data_array = []
        for archive in archives:
            # 獲取寵物資訊
            pet = archive.pet
            owner = pet.owner if pet else None

            # 構建用於向量化的文字
            text = self.get_text_for_embedding(archive)

            # 收集疾病和症狀資訊
            illness_names = []
            try:
                illnesses = archive.illnesses.all()
                illness_names = [rel.illness.illness_name for rel in illnesses]
            except:
                pass

            symptom_names = []
            try:
                abnormal_posts = archive.abnormal_posts.all()
                symptoms_set = set()
                for rel in abnormal_posts:
                    post = rel.post
                    post_symptoms = post.symptoms.all()
                    for symptom_rel in post_symptoms:
                        symptoms_set.add(symptom_rel.symptom.symptom_name)
                symptom_names = list(symptoms_set)
            except:
                pass

            data_array.append({
                'id': archive.postFrame.id,  # 使用 PostFrame ID 作為主鍵
                'text': text,
                'metadata': {
                    'archive_id': archive.id,  # 疾病檔案 ID
                    'post_frame_id': archive.postFrame.id,  # PostFrame ID
                    'pet_id': pet.id if pet else None,
                    'pet_name': pet.pet_name if pet else '',
                    'pet_type': pet.pet_type if pet else '',
                    'pet_breed': pet.breed if pet else '',
                    'owner_id': owner.id if owner else None,
                    'owner_account': owner.user_account if owner else '',
                    'owner_fullname': owner.user_fullname if owner else '',
                    'illnesses': ', '.join(illness_names),  # 疾病列表
                    'symptoms': ', '.join(symptom_names),  # 症狀列表
                    'health_status': archive.health_status or '',
                    'created_at': archive.postFrame.created_at.isoformat() if archive.postFrame.created_at else ''
                }
            })

        if data_array:
            print(f"📦 找到 {len(data_array)} 筆疾病檔案資料")
            self.build_index(data_array)
            print("✅ 疾病檔案向量索引建立完成")
        else:
            print("⚠️ 沒有找到疾病檔案資料")

    def get_text_for_embedding(self, archive):
        """
        構建用於向量化的文字（包含寵物類型、品種、症狀、疾病名稱等）

        Args:
            archive: DiseaseArchiveContent 物件

        Returns:
            str: 組合後的文字
        """
        text_parts = []

        # 寵物資訊
        if archive.pet:
            pet = archive.pet
            if pet.pet_type:
                text_parts.append(f"寵物類型: {pet.pet_type}")
            if pet.breed:
                text_parts.append(f"品種: {pet.breed}")

        # 疾病資訊（透過 ArchiveIllnessRelation 多對多關聯）
        try:
            illnesses = archive.illnesses.all()
            if illnesses.exists():
                illness_names = [rel.illness.illness_name for rel in illnesses]
                text_parts.append(f"疾病: {' '.join(illness_names)}")
        except Exception as e:
            pass

        # 症狀（透過 AbnormalPost 的關聯，因為沒有直接的 symptom 欄位）
        # 從 archive 的 abnormal_posts 中獲取症狀
        try:
            # 透過 ArchiveAbnormalPostRelation 獲取關聯的異常貼文
            abnormal_posts = archive.abnormal_posts.all()
            symptoms = set()
            for rel in abnormal_posts:
                post = rel.post
                # 從異常貼文的症狀關聯中獲取症狀
                post_symptoms = post.symptoms.all()
                for symptom_rel in post_symptoms:
                    symptoms.add(symptom_rel.symptom.symptom_name)
            if symptoms:
                text_parts.append(f"症狀: {' '.join(symptoms)}")
        except Exception as e:
            pass

        # 標題
        if archive.archive_title:
            text_parts.append(archive.archive_title)

        # 內容
        if archive.content:
            text_parts.append(archive.content)

        # 健康狀況
        if archive.health_status:
            text_parts.append(f"健康狀況: {archive.health_status}")

        return ' '.join(text_parts)

    def search(self, query_embedding, top_k=5, min_similarity=0.3, filters=None):
        """
        搜尋相似的疾病檔案

        Args:
            query_embedding: 查詢向量
            top_k: 返回數量
            min_similarity: 最小相似度閾值
            filters: 過濾條件 dict，可包含：
                - pet_type: 寵物類型（貓/狗等）
                - exclude_owner_id: 要排除的作者 ID
                - pet_breed: 寵物品種

        Returns:
            list: 搜尋結果列表
        """
        # 先進行向量搜尋（搜尋更多結果以便過濾）
        search_k = top_k * 3 if filters else top_k
        print(f"    🔍 DiseaseArchiveVectorDB.search: search_k={search_k}, min_similarity={min_similarity}")
        results = super().search(query_embedding, top_k=search_k, min_similarity=min_similarity)
        print(f"    📊 父類別搜尋返回 {len(results)} 個結果")

        # 如果有過濾條件，進行過濾
        if filters and results:
            filtered_results = []
            print(f"    🔧 開始過濾（目標 {top_k} 個結果）:")
            for result in results:
                metadata = result.get('metadata', {})

                # 過濾：排除特定作者
                if filters.get('exclude_owner_id') and metadata.get('owner_id') == filters['exclude_owner_id']:
                    print(f"      ❌ 案例 {metadata.get('archive_id')} 被過濾（作者ID匹配）")
                    continue

                # 過濾：只保留特定寵物類型
                if filters.get('pet_type'):
                    if metadata.get('pet_type', '').lower() != filters['pet_type'].lower():
                        print(f"      ❌ 案例 {metadata.get('archive_id')} 被過濾（寵物類型不匹配）")
                        continue

                # 過濾：只保留特定品種（如果指定）
                if filters.get('pet_breed'):
                    if filters['pet_breed'].lower() not in metadata.get('pet_breed', '').lower():
                        print(f"      ❌ 案例 {metadata.get('archive_id')} 被過濾（品種不匹配）")
                        continue

                print(f"      ✅ 案例 {metadata.get('archive_id')} 通過過濾")
                filtered_results.append(result)

                # 達到要求數量即停止
                if len(filtered_results) >= top_k:
                    break

            print(f"    📊 過濾後剩餘 {len(filtered_results)} 個結果")
            return filtered_results

        # 沒有過濾條件，直接返回前 top_k 個結果
        return results[:top_k]

    def add_or_update_archive(self, archive):
        """
        添加或更新疾病檔案到向量資料庫

        Args:
            archive: DiseaseArchiveContent 實例
        """
        try:
            # 檢查是否有 postFrame
            if not archive.postFrame:
                print(f"⚠️ 疾病檔案 {archive.id} 沒有關聯的 PostFrame，跳過向量更新")
                return

            post_frame_id = archive.postFrame.id
            pet = archive.pet
            owner = pet.owner if pet else None

            # 如果已存在，先刪除舊的
            if post_frame_id in self.ids:
                self.delete_item(post_frame_id)
                print(f"🔄 更新疾病檔案向量: PostFrame ID={post_frame_id}")
            else:
                print(f"➕ 添加疾病檔案向量: PostFrame ID={post_frame_id}")

            # 構建文字
            text = self.get_text_for_embedding(archive)

            # 收集疾病和症狀資訊
            illness_names = []
            try:
                illnesses = archive.illnesses.all()
                illness_names = [rel.illness.illness_name for rel in illnesses]
            except:
                pass

            symptom_names = []
            try:
                abnormal_posts = archive.abnormal_posts.all()
                symptoms_set = set()
                for rel in abnormal_posts:
                    post = rel.post
                    post_symptoms = post.symptoms.all()
                    for symptom_rel in post_symptoms:
                        symptoms_set.add(symptom_rel.symptom.symptom_name)
                symptom_names = list(symptoms_set)
            except:
                pass

            # 構建 metadata
            metadata = {
                'archive_id': archive.id,
                'post_frame_id': post_frame_id,
                'pet_id': pet.id if pet else None,
                'pet_name': pet.pet_name if pet else '',
                'pet_type': pet.pet_type if pet else '',
                'pet_breed': pet.breed if pet else '',
                'owner_id': owner.id if owner else None,
                'owner_account': owner.user_account if owner else '',
                'owner_fullname': owner.user_fullname if owner else '',
                'illnesses': ', '.join(illness_names),
                'symptoms': ', '.join(symptom_names),
                'health_status': archive.health_status or '',
                'created_at': archive.postFrame.created_at.isoformat() if archive.postFrame.created_at else ''
            }

            # 添加新的向量
            self.add_item(post_frame_id, text, metadata)

        except Exception as e:
            print(f"❌ 更新疾病檔案向量失敗: {str(e)}")
            import traceback
            traceback.print_exc()

    def remove_archive(self, archive):
        """
        從向量資料庫刪除疾病檔案

        Args:
            archive: DiseaseArchiveContent 實例或 PostFrame ID
        """
        try:
            # 如果傳入的是 archive 物件
            if hasattr(archive, 'postFrame'):
                if archive.postFrame:
                    post_frame_id = archive.postFrame.id
                else:
                    # 沒有 postFrame，靜默返回（不需要警告）
                    return
            else:
                # 如果直接傳入 ID
                post_frame_id = archive

            # 刪除向量（如果存在）
            if post_frame_id in self.ids:
                self.delete_item(post_frame_id)
                print(f"🗑️ 已刪除疾病檔案向量: PostFrame ID={post_frame_id}")
            # 如果不存在也不需要警告，因為可能本來就是私人檔案

        except Exception as e:
            # 只在真正發生錯誤時才打印
            if "not in" not in str(e):
                print(f"❌ 刪除疾病檔案向量失敗: {str(e)}")
                import traceback
                traceback.print_exc()
