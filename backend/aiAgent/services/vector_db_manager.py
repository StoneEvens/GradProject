"""
Vector Database Manager
統一管理所有向量資料庫的基礎類別
"""

import os
import numpy as np
import faiss
import torch
from datetime import datetime, timedelta
from django.conf import settings
from abc import ABC, abstractmethod


class BaseVectorDBManager(ABC):
    """向量資料庫管理器基礎類別"""

    # 過期時間：禁用自動過期（改用增量更新）
    EXPIRY_HOURS = None  # 設為 None 表示不自動過期

    def __init__(self, db_name, embedding_service, enable_expiry=False):
        """
        初始化向量資料庫管理器

        Args:
            db_name (str): 資料庫名稱
            embedding_service: 嵌入服務（BERT 或其他）
            enable_expiry (bool): 是否啟用自動過期檢查（預設關閉）
        """
        self.db_name = db_name
        self.embedding_service = embedding_service
        self.base_dir = settings.BASE_DIR
        self.enable_expiry = enable_expiry

        # 定義檔案路徑
        self.emb_path = os.path.join(self.base_dir, f'{db_name}_embs.npy')
        self.ids_path = os.path.join(self.base_dir, f'{db_name}_ids.npy')
        self.metadata_path = os.path.join(self.base_dir, f'{db_name}_metadata.npy')

        # 載入或初始化資料庫
        self.load_or_initialize()

    def is_expired(self):
        """
        檢查向量資料庫是否過期

        Returns:
            bool: True 表示已過期，需要重新初始化
        """
        # 如果未啟用過期檢查，永遠不過期
        if not self.enable_expiry or self.EXPIRY_HOURS is None:
            return False

        if not os.path.exists(self.emb_path):
            return True

        # 取得檔案最後修改時間
        file_mtime = os.path.getmtime(self.emb_path)
        file_datetime = datetime.fromtimestamp(file_mtime)
        now = datetime.now()

        time_diff = now - file_datetime
        is_expired = time_diff > timedelta(hours=self.EXPIRY_HOURS)

        if is_expired:
            print(f"⏰ 向量資料庫 {self.db_name} 已過期（{time_diff.total_seconds() / 3600:.1f} 小時），需要重新初始化")

        return is_expired

    def check_and_refresh(self):
        """
        檢查並刷新過期的向量資料庫
        """
        if self.is_expired():
            print(f"🔄 開始重新初始化 {self.db_name}...")
            self.embeddings = np.array([]).reshape(0, 768)
            self.ids = np.array([])
            self.metadata = np.array([])
            self.initialize_from_db()
            print(f"✅ {self.db_name} 重新初始化完成")

    def load_or_initialize(self):
        """載入現有資料庫或初始化新的"""
        if os.path.exists(self.emb_path) and os.path.exists(self.ids_path):
            # 檢查是否過期（如果啟用）
            if self.is_expired():
                print(f"⚠️ 向量資料庫 {self.db_name} 已過期，準備重新初始化...")
                self.embeddings = np.array([]).reshape(0, 768)  # BERT 768 維
                self.ids = np.array([])
                self.metadata = np.array([])
                self.initialize_from_db()
            else:
                # 載入現有資料
                self.embeddings = np.load(self.emb_path)
                self.ids = np.load(self.ids_path)

                # 嘗試載入 metadata
                if os.path.exists(self.metadata_path):
                    self.metadata = np.load(self.metadata_path, allow_pickle=True)
                else:
                    self.metadata = np.array([])

                # 顯示載入資訊
                if self.enable_expiry and self.EXPIRY_HOURS:
                    file_mtime = os.path.getmtime(self.emb_path)
                    file_datetime = datetime.fromtimestamp(file_mtime)
                    age_hours = (datetime.now() - file_datetime).total_seconds() / 3600
                    remaining_hours = self.EXPIRY_HOURS - age_hours
                    print(f"✅ 載入向量資料庫 {self.db_name}: {len(self.ids)} 筆資料（剩餘 {remaining_hours:.1f} 小時有效）")
                else:
                    print(f"✅ 載入向量資料庫 {self.db_name}: {len(self.ids)} 筆資料（增量更新模式）")
        else:
            print(f"⚠️ 向量資料庫 {self.db_name} 不存在，準備初始化...")
            self.embeddings = np.array([]).reshape(0, 768)  # BERT 768 維
            self.ids = np.array([])
            self.metadata = np.array([])
            self.initialize_from_db()

    @abstractmethod
    def initialize_from_db(self):
        """
        從資料庫初始化向量資料庫
        子類必須實作此方法
        """
        pass

    @abstractmethod
    def get_text_for_embedding(self, item):
        """
        獲取用於生成嵌入的文本
        子類必須實作此方法

        Args:
            item: 資料庫項目

        Returns:
            str: 用於嵌入的文本
        """
        pass

    def build_index(self, data_array):
        """
        建立向量索引

        Args:
            data_array (list): 資料陣列，每個元素包含 id 和 text
        """
        if not data_array:
            print(f"⚠️ {self.db_name} 沒有資料可建立索引")
            return

        print(f"🔨 開始建立 {self.db_name} 向量索引...")
        batch_size = 4
        all_ids = []
        all_embeddings = []

        for i in range(0, len(data_array), batch_size):
            batch = data_array[i : i + batch_size]
            texts = [item['text'] for item in batch]
            ids = [item['id'] for item in batch]

            # 使用 BERT 生成嵌入
            encoded = self.embedding_service.tokenizer(
                texts,
                padding=True,
                truncation=True,
                max_length=512,
                return_tensors="pt"
            ).to(self.embedding_service.device)

            with torch.no_grad():
                outputs = self.embedding_service.model(**encoded)
                embs = self.embedding_service._RecommendationService__mean_pooling(
                    outputs,
                    encoded.attention_mask
                )
                embs = torch.nn.functional.normalize(embs, p=2, dim=1)

            all_ids.extend(ids)
            all_embeddings.append(embs.cpu().numpy())

            if (i + batch_size) % 20 == 0:
                print(f"  處理進度: {i + batch_size}/{len(data_array)}")

        self.ids = np.array(all_ids)
        self.embeddings = np.vstack(all_embeddings)

        # 儲存 metadata（可選）
        if data_array and 'metadata' in data_array[0]:
            self.metadata = np.array([item['metadata'] for item in data_array])

        self.save()
        print(f"✅ {self.db_name} 向量索引建立完成: {len(self.ids)} 筆")

    def save(self):
        """儲存向量資料庫到磁碟"""
        np.save(self.emb_path, self.embeddings)
        np.save(self.ids_path, self.ids)
        if len(self.metadata) > 0:
            np.save(self.metadata_path, self.metadata)
        print(f"💾 {self.db_name} 已儲存")

    def add_item(self, item_id, text, metadata=None):
        """
        添加單個項目到向量資料庫

        Args:
            item_id (int): 項目 ID
            text (str): 文本內容
            metadata (dict): 元數據（可選）
        """
        # 生成嵌入
        encoded = self.embedding_service.tokenizer(
            [text],
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="pt"
        ).to(self.embedding_service.device)

        with torch.no_grad():
            outputs = self.embedding_service.model(**encoded)
            emb = self.embedding_service._RecommendationService__mean_pooling(
                outputs,
                encoded.attention_mask
            )
            emb = torch.nn.functional.normalize(emb, p=2, dim=1)
            emb = emb.cpu().numpy()

        # 添加到資料庫
        if len(self.embeddings) == 0:
            self.embeddings = emb
        else:
            self.embeddings = np.vstack([self.embeddings, emb])

        self.ids = np.append(self.ids, item_id)

        if metadata:
            if len(self.metadata) == 0:
                self.metadata = np.array([metadata])
            else:
                self.metadata = np.append(self.metadata, metadata)

        self.save()
        print(f"➕ 添加項目到 {self.db_name}: ID={item_id}")

    def delete_item(self, item_id):
        """
        從向量資料庫刪除項目

        Args:
            item_id (int): 項目 ID
        """
        if item_id in self.ids:
            idx = np.where(self.ids == item_id)[0][0]
            self.ids = np.delete(self.ids, idx)
            self.embeddings = np.delete(self.embeddings, idx, axis=0)

            if len(self.metadata) > 0:
                self.metadata = np.delete(self.metadata, idx)

            self.save()
            print(f"➖ 從 {self.db_name} 刪除項目: ID={item_id}")
        else:
            print(f"⚠️ 項目 ID {item_id} 不存在於 {self.db_name}")

    def search(self, query_embedding, top_k=5, min_similarity=0.0):
        """
        向量相似度搜尋

        Args:
            query_embedding (np.array): 查詢向量
            top_k (int): 返回數量
            min_similarity (float): 最小相似度閾值

        Returns:
            list: 搜尋結果
        """
        if len(self.embeddings) == 0:
            return []

        # 建立 FAISS 索引
        dimension = self.embeddings.shape[1]
        index = faiss.IndexFlatIP(dimension)
        index.add(self.embeddings.astype(np.float32))

        # 搜尋
        q = query_embedding.astype("float32").reshape(1, -1)
        distances, indices = index.search(q, k=min(top_k, len(self.ids)))

        # 調試：顯示所有搜尋結果（包括被閾值過濾的）
        print(f"      🔍 FAISS 搜尋返回 {len(indices[0])} 個結果（閾值前）:")
        for i, idx in enumerate(indices[0]):
            if idx < len(self.ids):
                similarity = float(distances[0][i])
                passed = "✅" if similarity >= min_similarity else "❌"
                metadata_str = ""
                if len(self.metadata) > 0:
                    meta = self.metadata[idx]
                    metadata_str = f"案例 {meta.get('archive_id', 'N/A')}"
                print(f"        {passed} {metadata_str}: 相似度={similarity:.3f} (閾值={min_similarity})")

        # 格式化結果
        results = []
        for i, idx in enumerate(indices[0]):
            if idx < len(self.ids):
                similarity = float(distances[0][i])
                if similarity >= min_similarity:
                    result = {
                        'id': int(self.ids[idx]),
                        'similarity': similarity
                    }
                    # 加入 metadata（如果有）
                    if len(self.metadata) > 0:
                        result['metadata'] = self.metadata[idx]
                    results.append(result)

        return results

    def get_stats(self):
        """獲取資料庫統計資訊"""
        return {
            'name': self.db_name,
            'total_items': len(self.ids),
            'embedding_dim': self.embeddings.shape[1] if len(self.embeddings) > 0 else 0,
            'has_metadata': len(self.metadata) > 0,
            'file_exists': os.path.exists(self.emb_path)
        }