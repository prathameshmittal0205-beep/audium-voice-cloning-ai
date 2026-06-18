import time
import logging
import io
import base64
import torch
import torchaudio

logger = logging.getLogger("serving")

def generate_speech(model, config, text, ref_audio_path, language="en"):
    start_time = time.time()
    logger.info("Running synthesis...")
    
    try:
        # Compute speaker latents
        gpt_cond_latent, speaker_embedding = model.get_conditioning_latents(audio_path=[ref_audio_path])
        
        # Inference
        out = model.inference(
            text,
            language,
            gpt_cond_latent,
            speaker_embedding,
            temperature=0.7,
        )
        
        wav = torch.tensor(out["wav"]).unsqueeze(0)
        sample_rate = config.audio.sample_rate # usually 24000 or 22050 for XTTS
        
        buffer = io.BytesIO()
        torchaudio.save(buffer, wav, sample_rate, format="wav")
        audio_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        synth_duration = time.time() - start_time
        logger.info(f"Synthesis duration: {synth_duration:.2f}s")
        
        return audio_base64
    except Exception as e:
        logger.error(f"Inference failed: {str(e)}")
        raise
