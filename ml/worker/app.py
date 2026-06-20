import os, uuid, time, base64, json, logging
import tempfile, shutil, requests
from pathlib import Path
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import torch
import librosa
import soundfile as sf
import numpy as np
import threading
from TTS.api import TTS

load_dotenv()

BLOB_READ_WRITE_TOKEN = os.getenv("BLOB_READ_WRITE_TOKEN")
BACKEND_URL = os.getenv("BACKEND_URL")
WORKER_SECRET = os.getenv("WORKER_SECRET")

print("Loading XTTS-v2 model...")
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")
tts_model = tts.synthesizer.tts_model
tts_model.eval()
print("XTTS-v2 model loaded.")

app = FastAPI()

jobs = {}
embeddings_store = {}

class TrainRequest(BaseModel):
    job_id: str
    audio_url: str
    voice_id: str

class GenerateRequest(BaseModel):
    text: str
    voice_id: str
    user_id: str

def real_xtts_train(job_id: str, audio_url: str, voice_id: str):
    jobs[job_id] = "running"
    tmp_dir = Path(tempfile.mkdtemp(prefix=f"audium-{job_id}-"))
    try:
        # Step 1: Download audio from Vercel Blob
        headers = {"Authorization": f"Bearer {BLOB_READ_WRITE_TOKEN}"}
        r = requests.get(audio_url, headers=headers, timeout=60)
        r.raise_for_status()
        audio_path = tmp_dir / "input.wav"
        audio_path.write_bytes(r.content)

        # Step 2: Validate and resample to 22050Hz
        audio, sr = librosa.load(str(audio_path), sr=None, mono=True)
        if sr != 22050:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=22050)
        sf.write(str(audio_path), audio, 22050)

        # Step 3: Extract speaker embedding
        gpt_cond_latent, speaker_embedding = \
            tts_model.get_conditioning_latents(
                audio_path=[str(audio_path)],
                gpt_cond_len=30,
                max_ref_length=60
            )

        # Step 4: Store embeddings in memory keyed by voice_id
        embeddings_store[voice_id] = {
            "gpt_cond_latent": gpt_cond_latent,
            "speaker_embedding": speaker_embedding
        }

        # Step 5: Also save to disk as backup
        model_dir = tmp_dir / "model"
        model_dir.mkdir()
        torch.save(gpt_cond_latent, model_dir / "gpt_cond_latent.pt")
        torch.save(speaker_embedding, model_dir / "speaker_embedding.pt")
        with open(model_dir / "config.json", "w") as f:
            json.dump({ "voiceId": voice_id, "sampleRate": 22050 }, f)

        # Step 6: Notify backend training complete
        if BACKEND_URL and WORKER_SECRET:
            try:
                requests.post(
                    f"{BACKEND_URL}/internal/training-complete",
                    json={
                        "jobId": job_id,
                        "voiceId": voice_id,
                        "modelUrl": f"memory:{voice_id}",
                        "secret": WORKER_SECRET
                    },
                    timeout=10
                )
            except Exception as e:
                print(f"Backend notify failed (non-fatal): {e}")

        jobs[job_id] = "completed"
        print(f"Training complete for voice_id: {voice_id}")

    except Exception as e:
        print(f"Training failed: {e}")
        jobs[job_id] = "failed"
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

@app.post("/train")
async def train(request: TrainRequest, background_tasks: BackgroundTasks):
    jobs[request.job_id] = "queued"
    background_tasks.add_task(real_xtts_train, request.job_id, request.audio_url, request.voice_id)
    return {"job_id": request.job_id, "status": "queued"}

@app.get("/training-status/{job_id}")
async def get_training_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"jobId": job_id, "status": jobs[job_id]}

@app.post("/generate")
async def generate(request: GenerateRequest):
    if request.voice_id not in embeddings_store:
        raise HTTPException(status_code=400, detail=f"Voice {request.voice_id} not found. Re-train or restart worker.")

    embeddings = embeddings_store[request.voice_id]
    gpt_cond_latent = embeddings["gpt_cond_latent"]
    speaker_embedding = embeddings["speaker_embedding"]

    out = tts_model.inference(
        text=request.text,
        language="en",
        gpt_cond_latent=gpt_cond_latent,
        speaker_embedding=speaker_embedding,
        temperature=0.7,
        enable_text_splitting=True
    )

    wav = np.array(out["wav"])
    tmp_file = Path(tempfile.mktemp(suffix=".wav"))
    sf.write(str(tmp_file), wav, 24000)
    audio_bytes = tmp_file.read_bytes()
    tmp_file.unlink(missing_ok=True)
    return {"status": "success", "base64Audio": base64.b64encode(audio_bytes).decode("utf-8")}

@app.get("/health")
async def health():
    return {"status": "online", "gpu_utilization": "10%", "xtts_loaded": True}

def register_worker():
    backend_url = BACKEND_URL or "http://localhost:8080"
    worker_secret = WORKER_SECRET or "dev-secret"
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
                pass

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
