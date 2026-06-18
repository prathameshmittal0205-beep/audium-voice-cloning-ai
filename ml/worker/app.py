import os
import uuid
import time
import base64
import requests
import threading
import subprocess
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

# In-memory job queue and statuses
jobs = {}

class TrainRequest(BaseModel):
    uploadId: str
    userId: str
    voiceId: str
    datasetUrl: str

class GenerateRequest(BaseModel):
    text: str
    voiceId: str
    userId: str

def dummy_xtts_train(job_id: str):
    """Mock XTTS Training process"""
    jobs[job_id] = "running"
    time.sleep(30) # simulate training
    jobs[job_id] = "completed"

@app.post("/train")
async def train(request: TrainRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    jobs[job_id] = "queued"
    background_tasks.add_task(dummy_xtts_train, job_id)
    return {"jobId": job_id, "status": "queued"}

@app.get("/training-status/{job_id}")
async def get_training_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"jobId": job_id, "status": jobs[job_id]}

@app.post("/generate")
async def generate(request: GenerateRequest):
    """Mock XTTS Inference process"""
    # Simulate inference time
    time.sleep(2)
    
    # Return a tiny valid base64 wav file header for testing
    # RIFF (4 bytes), size (4 bytes), WAVE (4 bytes)
    mock_wav_base64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA="
    
    return {"status": "success", "base64Audio": mock_wav_base64}

@app.get("/health")
async def health():
    return {"status": "online", "gpu_utilization": "10%"}

def register_worker():
    """Fetches Ngrok URL and registers with the backend periodically"""
    backend_url = os.getenv("AUDIUM_BACKEND_URL", "http://localhost:8080")
    worker_secret = os.getenv("WORKER_SECRET", "dev-secret")
    
    # Wait for Ngrok to be available
    time.sleep(5)
    
    while True:
        try:
            public_url = "https://mock-validation-url.ngrok.app"
            try:
                resp = requests.get("http://127.0.0.1:4040/api/tunnels", timeout=2)
                tunnels = resp.json().get("tunnels", [])
                if tunnels:
                    public_url = next(t["public_url"] for t in tunnels if t["proto"] == "https")
            except Exception:
                pass # Fallback to mock url

            reg_resp = requests.post(f"{backend_url}/internal/register-worker", json={
                "workerUrl": public_url,
                "secret": worker_secret
            })
            if reg_resp.status_code == 200:
                print(f"Successfully registered worker URL: {public_url}")
            else:
                print(f"Failed to register worker. Backend returned {reg_resp.status_code}")
        except Exception as e:
            print(f"Error registering worker: {e}")
            
        time.sleep(60)

@app.on_event("startup")
async def startup_event():
    threading.Thread(target=register_worker, daemon=True).start()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
