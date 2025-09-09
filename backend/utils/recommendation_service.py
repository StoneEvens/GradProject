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
        # Use path relative to the current script
        model_path = os.path.join(script_dir, "bert-base-chinese")
        print(f"Loading model from: {model_path}")
        self.tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True)
        self.model = AutoModel.from_pretrained(model_path, local_files_only=True).eval().to(self.device)


        #----------Load embeddings and post IDs----------#
        # Get the project root directory (where post_embs.npy is located)
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        social_emb_path = os.path.join(base_dir, 'social_post_embs.npy')
        social_ids_path = os.path.join(base_dir, 'social_post_ids.npy')
        forum_emb_path = os.path.join(base_dir, 'forum_post_embs.npy')
        forum_ids_path = os.path.join(base_dir, 'forum_post_ids.npy')

        #print(f"Looking for files in: {base_dir}")
        #print(f"Embeddings path: {emb_path}")
        #print(f"IDs path: {ids_path}")

        if not os.path.exists(social_emb_path) or not os.path.exists(social_ids_path):
            data_array = []
            from social.models import SoLContent, PostHashtag
            all_posts = SoLContent.objects.all()
            for post in all_posts:
                post_frame = SoLContent.get_postFrame(post)
                data_array.append({
                    "id": post_frame.id,
                    "timestamp": int(post_frame.created_at.timestamp()),
                    "content": post.content_text,
                    "hashtags": [hashtag.tag for hashtag in PostHashtag.get_hashtags(post_frame)]
                })

            if data_array:
                print(data_array[0])
                # Initialize FAISS index
                self.__initialize(data_array, content_type="social")
            else:
                print(f"No data found to initialize for social contents")

        if not os.path.exists(forum_emb_path) or not os.path.exists(forum_ids_path):
            data_array = []
            from pets.models import DiseaseArchiveContent
            all_posts = DiseaseArchiveContent.objects.all()
            for post in all_posts:
                post_frame = post.postFrame
                data_array.append({
                    "id": post_frame.id,
                    "timestamp": int(post_frame.created_at.timestamp()),
                    "content": post.content,
                    "hashtags": [] # 疾病目前沒有 hashtags
                })

            if data_array:
                print(data_array[0])
                # Initialize FAISS index
                self.__initialize(data_array, content_type="forum")
            else:
                print(f"No data found to initialize for forum contents")

        print("推薦服務初始化已完成")

    #----------Mean Pooling----------#
    def __mean_pooling(self, outputs, mask):
        token_embeddings = outputs.last_hidden_state  # (batch, seq_len, hidden)
        mask = mask.unsqueeze(-1).float()             # (batch, seq_len, 1)
        summed = (token_embeddings * mask).sum(1)     # (batch, hidden)
        counts = mask.sum(1).clamp(min=1e-9)          # (batch, 1)
        return summed / counts

    #----------Build FAISS Index----------#
    def __initialize(self, data_array, content_type):
        if content_type not in ["social", "forum"]:
            print(f"Warning: Unsupported content type '{content_type}'.")
            return

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
        np.save(f'{content_type}_post_ids.npy', post_ids)
        np.save(f'{content_type}_post_embs.npy', post_embeddings)

    #----------Embedding New Post----------#
    def embed_new_post(self, post_id: int, content: str, content_type: str) -> np.ndarray:
        if content_type not in ["social", "forum"]:
            print(f"Warning: Unsupported content type '{content_type}'.")
            return

        post_embeddings = np.load(f'{content_type}_post_embs.npy')
        post_ids = np.load(f'{content_type}_post_ids.npy')

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

        # Add new embedding and ID to the arrays
        post_embeddings = np.vstack([post_embeddings, emb])
        post_ids = np.append(post_ids, post_id)

        # Save updated arrays
        np.save(f'{content_type}_post_ids.npy', post_ids)
        np.save(f'{content_type}_post_embs.npy', post_embeddings)

        print(post_embeddings.shape)

    #----------Delete Post Data----------#
    def delete_post_data(self, post_id: int, content_type: str):
        if content_type not in ["social", "forum"]:
            print(f"Warning: Unsupported content type '{content_type}'.")
            return

        post_ids = np.load(f'{content_type}_post_ids.npy')
        post_embeddings = np.load(f'{content_type}_post_embs.npy')

        if post_id in post_ids:
            idx = np.where(post_ids == post_id)[0][0]
            post_ids = np.delete(post_ids, idx)
            post_embeddings = np.delete(post_embeddings, idx, axis=0)
            np.save(f'{content_type}_post_ids.npy', post_ids)
            np.save(f'{content_type}_post_embs.npy', post_embeddings)

            print(post_embeddings.shape)
        else:
            raise ValueError(f"Post ID {post_id} not found in vector store")

    #----------Embedding User History----------#
    def embed_user_history(self,
        posts: List[Tuple[int, str, float]],
        content_type: str,
        decay_lambda_per_hour: float = 0.1,
    ) -> np.ndarray:

        if content_type not in ["social", "forum"]:
            print(f"Warning: Unsupported content type '{content_type}'.")
            return

        post_ids = np.load(f'{content_type}_post_ids.npy')
        post_embeddings = np.load(f'{content_type}_post_embs.npy')

        now = max(ts for _, _, ts in posts)
        emb_map = dict(zip(post_ids, post_embeddings))

        vecs, ws = [], []
        for pid, action, ts in posts:
            emb = emb_map.get(pid)
            if emb is None: continue
            age_hours = (now - ts) / 3600.0
            w = self.ACTION_WEIGHTS.get(action, 1.0) * math.exp(-decay_lambda_per_hour * age_hours)
            vecs.append(emb * w)
            ws.append(w)

        if not vecs:
            agg = np.mean(post_embeddings, axis=0)
        else:
            agg = np.sum(vecs, axis=0) / np.sum(ws)

        return agg / np.linalg.norm(agg)

    #----------Recommend Posts----------#
    def recommend_posts(
        self,
        user_vec: np.ndarray,
        content_type: str
    ) -> List[int]:  # Changed from np.ndarray to List[int]
        
        if content_type not in ["social", "forum"]:
            print(f"Warning: Unsupported content type '{content_type}'.")
            return []

        post_ids = np.load(f'{content_type}_post_ids.npy')
        post_embeddings = np.load(f'{content_type}_post_embs.npy')

        dimension = post_embeddings.shape[1]  # Should be 768
        index = faiss.IndexFlatIP(dimension)  # Using inner product for similarity
        index.add(post_embeddings.astype(np.float32))  # Add vectors to the index

        q = user_vec.astype("float32").reshape(1, -1)
        distances, indices = index.search(q, k=len(post_ids))  # Retrieve all posts

        recommendationList = indices[0].tolist()
        

        print(post_embeddings.shape)
        return post_ids[indices[0]].tolist()  # Convert numpy array to Python list