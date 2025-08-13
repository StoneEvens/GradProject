import os
# Fix OpenMP conflict - must be set before importing other libraries
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

from transformers import AutoTokenizer, AutoModel
import numpy as np
import faiss
import json
import warnings
import torch
from transformers import logging
import math
from typing import List, Tuple

# Suppress warnings
warnings.filterwarnings("ignore", category=UserWarning, module="torch._utils")
logging.set_verbosity_error()  # This will suppress transformers warnings
script_dir = os.path.dirname(os.path.abspath(__file__))

class RecommendationService:
    def __init__(self):
        ##---------HyperParameters---------##
        self.BATCH_SIZE = 4
        self.ACTION_WEIGHTS = {"liked": 1.0, "comment": 1.5, "share": 2.0}

        ##---------Device Selection---------##
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Using device: {self.device}")
        
        ##---------Model Selection---------##
        self.tokenizer = AutoTokenizer.from_pretrained("ckiplab/bert-base-chinese")
        self.model = AutoModel.from_pretrained("ckiplab/bert-base-chinese").eval().to(self.device)

        #----------Load embeddings and post IDs----------#
        # Get the project root directory (where post_embs.npy is located)
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        emb_path = os.path.join(base_dir, 'post_embs.npy')
        ids_path = os.path.join(base_dir, 'post_ids.npy')

        #print(f"Looking for files in: {base_dir}")
        #print(f"Embeddings path: {emb_path}")
        #print(f"IDs path: {ids_path}")

        if not os.path.exists(emb_path) or not os.path.exists(ids_path):
            from social.models import PostFrame, SoLContent, PostHashtag
            from pets.models import DiseaseArchiveContent

            data_array = []
            
            # 收集日常貼文 (SoLContent)
            social_posts = SoLContent.objects.all()
            for post in social_posts:
                postframe = post.postFrame
                if postframe:
                    data_array.append({
                        "id": f"social_{postframe.id}",
                        "content_type": "social",
                        "timestamp": int(postframe.created_at.timestamp()),
                        "content": post.content_text,
                        "hashtags": [hashtag.tag for hashtag in PostHashtag.objects.filter(postFrame=postframe)]
                    })
            
            # 收集疾病檔案 (DiseaseArchiveContent)
            disease_archives = DiseaseArchiveContent.objects.filter(is_private=False)  # 只取公開的
            for archive in disease_archives:
                postframe = archive.postFrame
                if postframe:
                    data_array.append({
                        "id": f"disease_{postframe.id}",
                        "content_type": "disease", 
                        "timestamp": int(postframe.created_at.timestamp()),
                        "content": archive.content,
                        "hashtags": []  # 疾病檔案目前沒有hashtag
                    })
                    
            print(f"Loaded {len([d for d in data_array if d['content_type'] == 'social'])} social posts and {len([d for d in data_array if d['content_type'] == 'disease'])} disease archives")

            # Initialize FAISS index
            self.initialize(data_array)

        # Load the embeddings, IDs and content types
        self.post_embeddings = np.load(emb_path)
        self.post_ids = np.load(ids_path, allow_pickle=True)  # Allow pickle to load string arrays
        
        # Load content types if exists
        content_types_path = os.path.join(base_dir, 'post_content_types.npy')
        if os.path.exists(content_types_path):
            self.post_content_types = np.load(content_types_path, allow_pickle=True)
        else:
            # For backward compatibility, assume all are social posts
            self.post_content_types = np.array(['social'] * len(self.post_ids))

    #----------Mean Pooling----------#
    def __mean_pooling(self, outputs, mask):
        token_embeddings = outputs.last_hidden_state  # (batch, seq_len, hidden)
        mask = mask.unsqueeze(-1).float()             # (batch, seq_len, 1)
        summed = (token_embeddings * mask).sum(1)     # (batch, hidden)
        counts = mask.sum(1).clamp(min=1e-9)          # (batch, 1)
        return summed / counts

    #----------Build FAISS Index----------#
    def initialize(self, data_array):
        print("Initializing FAISS index...")
        batch_size = self.BATCH_SIZE
        all_ids     = []
        all_embeddings = []

        for i in range(0, len(data_array), batch_size):
            batch = data_array[i : i + batch_size]
            texts = [p["content"] for p in batch]
            ids   = [p["id"]   for p in batch]

            encoded = self.tokenizer(
                texts,
                padding=True,
                truncation=True,
                return_tensors="pt"
            ).to(self.device)

            with torch.no_grad():
                outputs = self.model(**encoded)
                embs    = self.__mean_pooling(outputs, encoded.attention_mask)
                embs    = torch.nn.functional.normalize(embs, p=2, dim=1)

            all_ids.extend(ids)
            all_embeddings.append(embs.cpu().numpy())

        post_ids        = np.array(all_ids)                          # shape: (N_posts,)
        post_embeddings = np.vstack(all_embeddings)                  # shape: (N_posts, hidden_dim)
        post_content_types = np.array([p["content_type"] for p in data_array])  # shape: (N_posts,)
        
        np.save("post_ids.npy",        post_ids)
        np.save("post_embs.npy",       post_embeddings)
        np.save("post_content_types.npy", post_content_types)

        return post_embeddings.shape[1]  # Return the dimension of embeddings
    
    #----------Embedding New Post----------#
    def embed_new_post(self, post_id: int, content: str, content_type: str = "social") -> np.ndarray:
        # Encode the text
        encoded = self.tokenizer(
            [content],
            padding=True,
            truncation=True,
            return_tensors="pt"
        ).to(self.device)

        # Generate embedding
        with torch.no_grad():
            outputs = self.model(**encoded)
            emb = self.__mean_pooling(outputs, encoded.attention_mask)
            emb = torch.nn.functional.normalize(emb, p=2, dim=1)
            emb = emb.cpu().numpy()

        # Create formatted ID with content type prefix
        formatted_id = f"{content_type}_{post_id}"
        
        # Add new embedding, ID and content type to the arrays
        self.post_embeddings = np.vstack([self.post_embeddings, emb])
        self.post_ids = np.append(self.post_ids, formatted_id)
        self.post_content_types = np.append(self.post_content_types, content_type)

        # Save updated arrays
        np.save("post_ids.npy", self.post_ids)
        np.save("post_embs.npy", self.post_embeddings)
        np.save("post_content_types.npy", self.post_content_types)

        print(self.post_embeddings.shape)
        
    #----------Delete Post Data----------#
    def delete_post_data(self, post_id: int, content_type: str = None):
        # Try to find the formatted ID first
        if content_type:
            formatted_id = f"{content_type}_{post_id}"
        else:
            # Try both social and disease prefixes
            formatted_id = None
            for prefix in ['social', 'disease']:
                candidate_id = f"{prefix}_{post_id}"
                if candidate_id in self.post_ids:
                    formatted_id = candidate_id
                    break
        
        if formatted_id and formatted_id in self.post_ids:
            idx = np.where(self.post_ids == formatted_id)[0][0]
            self.post_ids = np.delete(self.post_ids, idx)
            self.post_embeddings = np.delete(self.post_embeddings, idx, axis=0)
            self.post_content_types = np.delete(self.post_content_types, idx)
            
            np.save("post_ids.npy", self.post_ids)
            np.save("post_embs.npy", self.post_embeddings)
            np.save("post_content_types.npy", self.post_content_types)

            print(self.post_embeddings.shape)
        else:
            print(f"Warning: Post ID {post_id} not found in vector store")

    #----------Embedding User History----------#
    def embed_user_history(self,
        posts: List[Tuple[int, str, float]],
        decay_lambda_per_hour: float = 0.1
    ) -> np.ndarray:
        # Handle empty posts list
        if not posts:
            # Return average of all embeddings as default
            agg = np.mean(self.post_embeddings, axis=0)
            return agg / np.linalg.norm(agg)
            
        now = max(ts for _, _, ts in posts)
        emb_map = dict(zip(self.post_ids, self.post_embeddings))

        vecs, ws = [], []
        for pid, action, ts in posts:
            # Try to find the embedding with different prefixes
            emb = None
            
            # First try to find as-is (backward compatibility)
            if pid in emb_map:
                emb = emb_map[pid]
            else:
                # Try with social prefix
                social_id = f"social_{pid}"
                if social_id in emb_map:
                    emb = emb_map[social_id]
                else:
                    # Try with disease prefix
                    disease_id = f"disease_{pid}"
                    if disease_id in emb_map:
                        emb = emb_map[disease_id]
                        
            if emb is None: 
                continue
                
            age_hours = (now - ts) / 3600.0
            w = self.ACTION_WEIGHTS.get(action, 1.0) * math.exp(-decay_lambda_per_hour * age_hours)
            vecs.append(emb * w)
            ws.append(w)

        if not vecs:
            agg = np.mean(self.post_embeddings, axis=0)
        else:
            agg = np.sum(vecs, axis=0) / np.sum(ws)

        return agg / np.linalg.norm(agg)

    #----------Recommend Posts----------#
    def recommend_posts(
        self,
        user_vec: np.ndarray,
        top_k: int = 10,
        content_type_filter: str = None  # "social", "disease", or None for both
    ) -> List[dict]:  # Return list of dicts with id, content_type, and original_id
        dimension = self.post_embeddings.shape[1]  # Should be 768
        index = faiss.IndexFlatIP(dimension)  # Using inner product for similarity
        index.add(self.post_embeddings.astype(np.float32))  # Add vectors to the index

        # If filtering by content type, search more results to ensure we have enough after filtering
        search_k = top_k * 3 if content_type_filter else top_k
        
        q = user_vec.astype("float32").reshape(1, -1)
        distances, indices = index.search(q, search_k)

        results = []
        for idx in indices[0]:
            post_id = self.post_ids[idx]
            content_type = self.post_content_types[idx]
            
            # Apply content type filter if specified
            if content_type_filter and content_type != content_type_filter:
                continue
                
            # Extract original post ID (remove prefix)
            original_id = int(post_id.split('_')[1])
            
            results.append({
                'id': post_id,
                'content_type': content_type,
                'original_id': original_id
            })
            
            # Stop when we have enough results
            if len(results) >= top_k:
                break
        
        print(f"Recommended {len(results)} posts from {self.post_embeddings.shape[0]} total")
        return results