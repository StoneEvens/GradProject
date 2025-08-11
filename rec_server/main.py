import json
from typing import List, Tuple
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import faiss, numpy as np
import uvicorn
import os
from modules import RecommendationService

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

rec_service = RecommendationService()

class UpsertPayload(BaseModel):
    id: int
    text: str
    action: str  # "create" or "update"

class DeletePayload(BaseModel):
    id: int

class QueryPayload(BaseModel):
    id: int
    action: str
    timestamp: float

@app.post("/embeddings/upsert")
def upsert(payload: UpsertPayload):
    id = payload.id
    content = payload.text
    action = payload.action

    if action == "create":
        rec_service.embed_new_post(id, content)
    elif action == "update":
        rec_service.delete_post_data(id)
        rec_service.embed_new_post(id, content)
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

@app.post("/embeddings/delete")
def delete(payload: DeletePayload):
    id = payload.id
    rec_service.delete_post_data(id)

@app.post("/recommend")
def recommend(history: List[QueryPayload]):
    embedded_history = rec_service.embed_user_history([(p.id, p.action, p.timestamp) for p in history])
    search_list = rec_service.recommend_posts(embedded_history)

    seen_ids = {p.id for p in history}
    recommend_list = []

    for post_id in search_list:
        if post_id not in seen_ids:
            # Do something with each recommended post ID
            recommend_list.append(post_id)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    with open(os.path.join(root_dir, "testdata.json"), "r", encoding="utf-8") as f:
        data = json.load(f)

    return {"recommendations": recommend_list}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
