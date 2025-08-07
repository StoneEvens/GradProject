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
import time

# Suppress warnings
warnings.filterwarnings("ignore", category=UserWarning, module="torch._utils")
logging.set_verbosity_error()  # This will suppress transformers warnings
script_dir = os.path.dirname(os.path.abspath(__file__))

##---------Input Parameters----------##
user_interaction_history: List[Tuple[int, str, float]] = [
    (2, "like",    1728350000),
    (4, "like", 1728380000),
    (7, "like",   1728395000),
    (10, "like",   1728372000),
]

##---------HyperParameters----------##
batch_size_training = 4
ACTION_WEIGHTS = {"like": 1.0, "comment": 1.5, "share": 2.0}

##---------Embedding----------##
#----------Load The Test Data----------#
testdata_path = os.path.join(script_dir, 'testdata.json')
with open(testdata_path, "r", encoding="utf-8") as f:
    data_array = json.load(f)

#----------Tokenizaition and Pooling----------#
model_path = "c:/Users/Steven/bert-base-chinese"
tokenizer = AutoTokenizer.from_pretrained(model_path)
model = AutoModel.from_pretrained(model_path).eval().cuda()

def mean_pooling(outputs, mask):
    token_embeddings = outputs.last_hidden_state  # (batch, seq_len, hidden)
    mask = mask.unsqueeze(-1).float()             # (batch, seq_len, 1)
    summed = (token_embeddings * mask).sum(1)     # (batch, hidden)
    counts = mask.sum(1).clamp(min=1e-9)          # (batch, 1)
    return summed / counts

##---------Embedding----------##
batch_size = batch_size_training
all_ids     = []
all_embeddings = []

for i in range(0, len(data_array), batch_size):
    batch = data_array[i : i + batch_size]
    texts = [p["content"] for p in batch]
    ids   = [p["id"]   for p in batch]

    encoded = tokenizer(
        texts,
        padding=True,
        truncation=True,
        return_tensors="pt"
    ).to("cuda")

    with torch.no_grad():
        outputs = model(**encoded)
        embs    = mean_pooling(outputs, encoded.attention_mask)
        embs    = torch.nn.functional.normalize(embs, p=2, dim=1)

    all_ids.extend(ids)
    all_embeddings.append(embs.cpu().numpy())

post_ids        = np.array(all_ids)                          # shape: (N_posts,)
post_embeddings = np.vstack(all_embeddings)                  # shape: (N_posts, hidden_dim)
np.save("post_ids.npy",        post_ids)
np.save("post_embs.npy",       post_embeddings)

##---------Build FAISS Index----------##
dim = post_embeddings.shape[1]  # hidden_dim
index = faiss.IndexFlatIP(dim)  # Use Inner Product (cosine similarity) instead of L2
index.add(post_embeddings.astype(np.float32))  # Add embeddings to the index

##---------Embed User History---------##
history = user_interaction_history
weights = ACTION_WEIGHTS

def compute_user_vector(
    history: List[Tuple[int, str, float]],
    post_ids: np.ndarray,
    post_embs: np.ndarray,
    decay_lambda_per_hour: float = 0.1
) -> np.ndarray:
    now = max(ts for _, _, ts in history)
    emb_map = dict(zip(post_ids, post_embs))

    vecs, ws = [], []
    for pid, action, ts in history:
        emb = emb_map.get(pid)
        if emb is None: continue
        age_hours = (now - ts) / 3600.0
        w = ACTION_WEIGHTS.get(action, 1.0) * math.exp(-decay_lambda_per_hour * age_hours)
        vecs.append(emb * w)
        ws.append(w)

    if not vecs:
        agg = np.mean(post_embs, axis=0)
    else:
        agg = np.sum(vecs, axis=0) / np.sum(ws)

    return agg / np.linalg.norm(agg)

##---------Vector Store Search---------##
def recommend_posts(
    user_vec: np.ndarray,
    index: faiss.IndexFlatIP,
    post_ids: np.ndarray,
    top_k: int = 5
) -> np.ndarray:
    q = user_vec.astype("float32").reshape(1, -1)
    distances, indices = index.search(q, top_k)
    return post_ids[indices[0]]

##---------Testing---------##
start_time = time.time()

user_vec = compute_user_vector(history, post_ids, post_embeddings)
rec_ids  = recommend_posts(user_vec, index, post_ids, top_k=9)

# Create a mapping from post ID to post data
id_to_post = {post["id"]: post for post in data_array}

# Extract post IDs that the user has already seen
user_seen_ids = {pid for pid, _, _ in user_interaction_history}

# Filter out posts the user has already seen and display new recommendations
for post_id in rec_ids:
    if post_id not in user_seen_ids:
        post_data = id_to_post.get(post_id)
        if post_data:
            print(f"Post ID {post_id}: {post_data['content']}")
        else:
            print(f"Post ID {post_id}: Content not found")

end_time = time.time()
print(f"推薦所用時間: {end_time - start_time:.4f} 秒")