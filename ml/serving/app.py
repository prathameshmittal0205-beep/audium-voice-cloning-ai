import sys
import logging
from pythonjsonlogger import jsonlogger
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import time
from model_loader import ModelCache
from inference import generate_speech

# Configure Structured Logging
logger = logging.getLogger("serving")
logger.setLevel(logging.INFO)
logHandler = logging.StreamHandler(sys.stdout)
formatter = jsonlogger.JsonFormatter('%(asctime)s %(levelname)s %(message)s %(traceId)s %(voiceId)s')
logHandler.setFormatter(formatter)
logger.addHandler(logHandler)

app = FastAPI()
cache = ModelCache(max_size=3)

class Instance(BaseModel):
    userId: str
    voiceId: str
    text: str

class VertexPredictRequest(BaseModel):
    instances: list[Instance]

@app.get("/health")
def health():
    return {
        "status": "ok",
        "loadedModels": len(cache.models),
        "cacheHits": cache.stats["cacheHits"],
        "cacheMisses": cache.stats["cacheMisses"]
    }

@app.post("/predict")
def predict(req: VertexPredictRequest):
    if not req.instances or len(req.instances) == 0:
        raise HTTPException(status_code=400, detail="Missing instances")
        
    instance = req.instances[0]
    logger.info(f"Received inference request for {instance.voiceId}", extra={"voiceId": instance.voiceId})
    try:
        model, config = cache.get_model(instance.userId, instance.voiceId)
        ref_audio_path = cache.get_reference_audio(instance.userId, instance.voiceId)
        
        if not ref_audio_path:
            raise HTTPException(status_code=400, detail="Reference audio missing for this voice")
            
        audio_base64 = generate_speech(model, config, instance.text, ref_audio_path)
        
        return {"predictions": [{"audio_base64": audio_base64}]}
    except Exception as e:
        logger.error(f"Prediction failed: {str(e)}", extra={"voiceId": instance.voiceId})
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8080)
