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
        self.ACTION_WEIGHTS = {"like": 1.0, "comment": 1.5, "share": 2.0}

        ##---------Model Selection---------##
        model_path = "c:/Users/Steven/bert-base-chinese"
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        self.model = AutoModel.from_pretrained(model_path).eval().cuda()

        #----------Load embeddings and post IDs----------#
        # Get the project root directory (where post_embs.npy is located)
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        emb_path = os.path.join(base_dir, 'post_embs.npy')
        ids_path = os.path.join(base_dir, 'post_ids.npy')

        print(f"Looking for files in: {base_dir}")
        print(f"Embeddings path: {emb_path}")
        print(f"IDs path: {ids_path}")

        if not os.path.exists(emb_path) or not os.path.exists(ids_path):
            # Initialize recommendation service if test data exists
            testdata_path = os.path.join(base_dir, 'testdata.json')
            if os.path.exists(testdata_path):
                with open(testdata_path, "r", encoding="utf-8") as f:
                    data_array = json.load(f)
                self.initialize()
            else:
                raise FileNotFoundError(f"Test data file not found: {testdata_path}")
            
        # Load the embeddings and IDs
        self.post_embeddings = np.load(emb_path)
        self.post_ids = np.load(ids_path)

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
            ).to("cuda")

            with torch.no_grad():
                outputs = self.model(**encoded)
                embs    = self.__mean_pooling(outputs, encoded.attention_mask)
                embs    = torch.nn.functional.normalize(embs, p=2, dim=1)

            all_ids.extend(ids)
            all_embeddings.append(embs.cpu().numpy())

        post_ids        = np.array(all_ids)                          # shape: (N_posts,)
        post_embeddings = np.vstack(all_embeddings)                  # shape: (N_posts, hidden_dim)
        np.save("post_ids.npy",        post_ids)
        np.save("post_embs.npy",       post_embeddings)

        return post_embeddings.shape[1]  # Return the dimension of embeddings
    
    #----------Embedding New Post----------#
    def embed_new_post(self, post_id: int, content: str) -> np.ndarray:
        # Encode the text
        encoded = self.tokenizer(
            [content],
            padding=True,
            truncation=True,
            return_tensors="pt"
        ).to("cuda")

        # Generate embedding
        with torch.no_grad():
            outputs = self.model(**encoded)
            emb = self.__mean_pooling(outputs, encoded.attention_mask)
            emb = torch.nn.functional.normalize(emb, p=2, dim=1)
            emb = emb.cpu().numpy()

        # Add new embedding and ID to the arrays
        self.post_embeddings = np.vstack([self.post_embeddings, emb])
        self.post_ids = np.append(self.post_ids, post_id)

        # Save updated arrays
        np.save("post_ids.npy", self.post_ids)
        np.save("post_embs.npy", self.post_embeddings)

        print(self.post_embeddings.shape)
        
    #----------Delete Post Data----------#
    def delete_post_data(self, post_id: int):
        if post_id in self.post_ids:
            idx = np.where(self.post_ids == post_id)[0][0]
            self.post_ids = np.delete(self.post_ids, idx)
            self.post_embeddings = np.delete(self.post_embeddings, idx, axis=0)
            np.save("post_ids.npy", self.post_ids)
            np.save("post_embs.npy", self.post_embeddings)

            print(self.post_embeddings.shape)
        else:
            raise ValueError(f"Post ID {post_id} not found in vector store")

    #----------Embedding User History----------#
    def embed_user_history(self,
        posts: List[Tuple[int, str, float]],
        decay_lambda_per_hour: float = 0.1
    ) -> np.ndarray:
        now = max(ts for _, _, ts in posts)
        emb_map = dict(zip(self.post_ids, self.post_embeddings))

        vecs, ws = [], []
        for pid, action, ts in posts:
            emb = emb_map.get(pid)
            if emb is None: continue
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
        top_k: int = 10
    ) -> List[int]:  # Changed from np.ndarray to List[int]
        dimension = self.post_embeddings.shape[1]  # Should be 768
        index = faiss.IndexFlatIP(dimension)  # Using inner product for similarity
        index.add(self.post_embeddings.astype(np.float32))  # Add vectors to the index

        q = user_vec.astype("float32").reshape(1, -1)
        distances, indices = index.search(q, top_k)

        print(self.post_embeddings.shape)
        return self.post_ids[indices[0]].tolist()  # Convert numpy array to Python list