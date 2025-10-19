import os
# Fix OpenMP conflict - must be set before importing other libraries
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

from transformers import AutoTokenizer, AutoModel
import numpy as np
import json
import warnings
import torch
import faiss
from transformers import logging
from typing import List, Dict, Tuple

# Suppress warnings
warnings.filterwarnings("ignore", category=UserWarning, module="torch._utils")
logging.set_verbosity_error()  # This will suppress transformers warnings
script_dir = os.path.dirname(os.path.abspath(__file__))

class PurposeService:
    # Define your function descriptions here
    FUNCTIONS = {
        "系統使用教學": "教學引導（如何使用系統功能）\n  子類型: tagPet, createPost, setReminder, healthRecord\n  範例: \"如何標註寵物\"、\"怎麼發布貼文\"",
        "代理系統操作": "代替使用者執行系統操作（查找記錄、設置提醒、搜尋醫院）\n  子類型: findAbnormalPosts, findHealthRecords, setFeedingReminder, searchNearbyHospitals, recordAbnormality\n  範例: '幫我找異常記錄'、'設定餵食提醒'`",
        "飼料查詢": "飼料營養建議\n  子類型: recommendation, comparison, nutrition\n  範例: \"推薦老貓肝臟保健的飼料\"、\"幼犬需要什麼營養\"",
        "寵物健康資訊查詢": "寵物健康狀況諮詢（根據症狀尋找相似案例）\n  子類型: symptom_similar, disease_info, health_advice\n  範例: \"我的貓最近一直咳嗽怎麼辦\"、\"狗狗嘔吐該注意什麼\"、\"布偶貓容易有什麼疾病\"\n  重點: 會根據寵物類型、品種和症狀，查找其他使用者的疾病檔案（DiseaseArchiveContent）",
        "進階帳號查詢": "推薦相似用戶（根據飼養寵物、興趣等推薦）\n  子類型: by_pet, by_interest, by_location\n  範例: \"推薦養布偶貓的用戶\"、\"有沒有同樣養吉娃娃的朋友\"\n  重點: 主要是社交目的，推薦志同道合的飼主",
        "一般對話": "一般對話（無法明確分類）\n  範例: \"你好\"、\"謝謝\""
    }

    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Using device: {self.device}")

        # prefer local model at backend\utils\bert-base-chinese (relative to this file)
        local_model_path = os.path.normpath(os.path.join(script_dir, '..', '..', 'utils', 'bert-base-chinese'))
        if os.path.isdir(local_model_path):
            model_name = local_model_path
        else:
            model_name = "bert-base-chinese"  # fallback to online model

        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name).to(self.device)
        
        # Initialize in-memory FAISS index and store function mappings
        self.function_names = list(self.FUNCTIONS.keys())
        embeddings = []
        
        # Pre-compute embeddings for all function descriptions
        for func_name in self.function_names:
            embedding = self._embed_text(self.FUNCTIONS[func_name])
            embeddings.append(embedding)
            
        # Create and populate FAISS index
        embedding_dim = embeddings[0].shape[0]  # Get dimensionality from first embedding
        self.index = faiss.IndexFlatIP(embedding_dim)  # Inner product = cosine similarity for normalized vectors
        self.index.add(np.array(embeddings).astype('float32'))

    def _embed_text(self, text: str) -> np.ndarray:
        inputs = self.tokenizer(text, return_tensors='pt', truncation=True, padding=True)
        # Move inputs to the same device as the model
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = self.model(**inputs)
        embeddings = outputs.last_hidden_state.mean(dim=1).squeeze().cpu().numpy()
        return embeddings / np.linalg.norm(embeddings)

    def find_similar_purposes(self, user_input: str, top_k: int = 1) -> List[dict]:
        """Find the most similar function purposes based on user input"""
        # Embed the user input
        query_vector = self._embed_text(user_input)
        
        # Reshape for FAISS
        query_vector = np.expand_dims(query_vector, axis=0).astype('float32')
        
        # Search the index
        similarities, indices = self.index.search(query_vector, top_k)
        
        # Format results
        results = []
        for idx, similarity in zip(indices[0], similarities[0]):
            func_name = self.function_names[idx]
            results.append({
                'function': func_name,
                'description': self.FUNCTIONS[func_name],
                'similarity': float(similarity)  # Convert to native Python float
            })
            
        return results