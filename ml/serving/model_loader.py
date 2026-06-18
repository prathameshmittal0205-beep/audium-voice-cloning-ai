import os
import time
import logging
from google.cloud import storage
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts
import torch

logger = logging.getLogger("serving")

class ModelCache:
    def __init__(self, max_size=3):
        self.max_size = max_size
        self.models = {}  # dict of voiceId -> (model, config)
        self.access_times = {} # dict of voiceId -> timestamp
        self.storage_client = storage.Client()
        self.bucket_models = os.environ.get("AUDIUM_BUCKET_MODELS", "audium-models")
        self.bucket_data = os.environ.get("AUDIUM_BUCKET_DATA", "audium-voice-data")

        self.stats = {
            "cacheHits": 0,
            "cacheMisses": 0
        }

    def get_model(self, user_id, voice_id):
        if voice_id in self.models:
            logger.info(f"Cache hit for {voice_id}", extra={"voiceId": voice_id})
            self.access_times[voice_id] = time.time()
            self.stats["cacheHits"] += 1
            return self.models[voice_id][0], self.models[voice_id][1]

        logger.info(f"Cache miss for {voice_id}. Loading...", extra={"voiceId": voice_id})
        self.stats["cacheMisses"] += 1

        start_time = time.time()
        bucket = self.storage_client.bucket(self.bucket_models)
        local_dir = f"/tmp/models/{user_id}/{voice_id}"
        os.makedirs(local_dir, exist_ok=True)

        files_to_download = ["best_model.pth", "config.json", "vocab.json"]
        
        for f in files_to_download:
            blob = bucket.blob(f"{user_id}/{voice_id}/{f}")
            if blob.exists():
                blob.download_to_filename(f"{local_dir}/{f}")
            else:
                logger.warning(f"File {f} not found, trying fallback", extra={"voiceId": voice_id})
                if f == "best_model.pth":
                    fallback = bucket.blob(f"{user_id}/{voice_id}/model.pth")
                    if fallback.exists():
                        fallback.download_to_filename(f"{local_dir}/{f}")

        # Also download reference audio for XTTS conditioning
        # Assume voiceId format is voice_<uploadId>
        upload_id = voice_id.replace("voice_", "")
        audio_blob = self.storage_client.bucket(self.bucket_data).blob(f"{user_id}/{upload_id}/audio.wav")
        ref_audio_path = f"{local_dir}/reference.wav"
        if audio_blob.exists():
            audio_blob.download_to_filename(ref_audio_path)
            
        dl_time = time.time() - start_time
        logger.info(f"GCS Download duration: {dl_time:.2f}s", extra={"voiceId": voice_id})

        # Load XTTS Config and Model
        try:
            config = XttsConfig()
            config.load_json(f"{local_dir}/config.json")
            
            model = Xtts.init_from_config(config)
            model.load_checkpoint(config, checkpoint_dir=local_dir, eval=True)
            if torch.cuda.is_available():
                model.cuda()
            
            self._add_to_cache(voice_id, model, config)
            return model, config
        except Exception as e:
            logger.error(f"Failed to load model: {str(e)}", extra={"voiceId": voice_id})
            raise RuntimeError("Model loading failed")

    def get_reference_audio(self, user_id, voice_id):
        local_dir = f"/tmp/models/{user_id}/{voice_id}"
        ref_audio_path = f"{local_dir}/reference.wav"
        if os.path.exists(ref_audio_path):
            return ref_audio_path
        return None

    def _add_to_cache(self, voice_id, model, config):
        if len(self.models) >= self.max_size:
            lru_voice = min(self.access_times, key=self.access_times.get)
            logger.info(f"Evicting model {lru_voice} from cache")
            del self.models[lru_voice]
            del self.access_times[lru_voice]
        
        self.models[voice_id] = (model, config)
        self.access_times[voice_id] = time.time()
