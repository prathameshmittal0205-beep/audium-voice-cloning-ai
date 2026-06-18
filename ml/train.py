import os
import sys
import uuid
import logging
import json
import random
from pythonjsonlogger import jsonlogger
from google.cloud import storage
import subprocess
import torch
import torchaudio
import torchaudio.functional as F
import numpy as np

from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts
from TTS.config.shared_configs import BaseDatasetConfig
from TTS.trainer import Trainer, TrainingArgs
from TTS.utils.manage import ModelManager

# Configure Structured Logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)
logHandler = logging.StreamHandler(sys.stdout)
formatter = jsonlogger.JsonFormatter('%(asctime)s %(levelname)s %(message)s %(traceId)s')
logHandler.setFormatter(formatter)
logger.addHandler(logHandler)

# Context Variables
USER_ID = os.environ.get("USER_ID", "local_user")
UPLOAD_ID = os.environ.get("UPLOAD_ID", "local_upload")
VOICE_ID = os.environ.get("VOICE_ID", f"voice_{UPLOAD_ID}")
BUCKET_DATA = os.environ.get("AUDIUM_BUCKET_DATA", "audium-voice-data")
BUCKET_MODELS = os.environ.get("AUDIUM_BUCKET_MODELS", "audium-models")
TRACE_ID = os.environ.get("TRACE_ID", str(uuid.uuid4()))

def log_info(msg):
    logger.info(msg, extra={"traceId": TRACE_ID})

def log_error(msg, exc=None):
    logger.error(msg, exc_info=exc, extra={"traceId": TRACE_ID})

def main():
    log_info("Starting Audium Vertex Training Container (XTTS-v2) - Phase 3 Pipeline")

    try:
        storage_client = storage.Client()
        bucket_data = storage_client.bucket(BUCKET_DATA)
        bucket_models = storage_client.bucket(BUCKET_MODELS)

        # 1. Download Dataset
        log_info("Downloading audio and transcript from GCS")
        raw_dir = f"/tmp/dataset_raw/{UPLOAD_ID}"
        os.makedirs(raw_dir, exist_ok=True)
        
        audio_path = f"{raw_dir}/audio.wav"
        transcript_path = f"{raw_dir}/transcript.txt"

        bucket_data.blob(f"{USER_ID}/{UPLOAD_ID}/audio.wav").download_to_filename(audio_path)
        bucket_data.blob(f"{USER_ID}/{UPLOAD_ID}/transcript.txt").download_to_filename(transcript_path)

        # 2. VAD & Whisper Alignment Pipeline
        log_info("Starting VAD and Whisper Alignment Pipeline")
        dataset_dir = f"/tmp/dataset/{UPLOAD_ID}"
        wavs_dir = f"{dataset_dir}/wavs"
        os.makedirs(wavs_dir, exist_ok=True)

        audio_16k_path = f"{raw_dir}/audio_16k.wav"
        subprocess.run(["ffmpeg", "-i", audio_path, "-ar", "16000", "-ac", "1", "-sample_fmt", "s16", audio_16k_path, "-y"], check=True)

        # Load Silero VAD
        log_info("Loading Silero VAD")
        vad_model, utils = torch.hub.load(repo_or_dir='snakers4/silero-vad', model='silero_vad', force_reload=False, onnx=False)
        (get_speech_timestamps, save_audio, read_audio, VADIterator, collect_chunks) = utils
        wav_16k = read_audio(audio_16k_path, sampling_rate=16000)

        # Get speech timestamps
        timestamps = get_speech_timestamps(wav_16k, vad_model, sampling_rate=16000, min_speech_duration_ms=2000)

        # Merge segments into 3-12 second chunks
        merged_timestamps = []
        current_start = -1
        current_end = -1
        for t in timestamps:
            if current_start == -1:
                current_start = t['start']
                current_end = t['end']
            else:
                if (t['end'] - current_start) <= (12 * 16000):
                    current_end = t['end']
                else:
                    merged_timestamps.append({'start': current_start, 'end': current_end})
                    current_start = t['start']
                    current_end = t['end']
        if current_start != -1:
            merged_timestamps.append({'start': current_start, 'end': current_end})

        # Load Whisper
        log_info("Loading Whisper Model (base.en)")
        import whisper
        whisper_model = whisper.load_model("base.en")

        # Load 22050Hz audio for XTTS
        wav_22k, sr_orig = torchaudio.load(audio_path)
        if sr_orig != 22050:
            wav_22k = F.resample(wav_22k, sr_orig, 22050)
        if wav_22k.shape[0] > 1:
            wav_22k = wav_22k.mean(dim=0, keepdim=True)

        metadata_lines = []
        segments_created = 0
        segments_rejected = 0
        usable_duration_sec = 0.0

        original_duration_sec = wav_16k.shape[0] / 16000.0

        for i, t in enumerate(merged_timestamps):
            start_sec = t['start'] / 16000.0
            end_sec = t['end'] / 16000.0
            duration = end_sec - start_sec

            if duration < 2.0 or duration > 15.0:
                segments_rejected += 1
                continue

            chunk_16k = wav_16k[t['start']:t['end']].numpy()
            
            res = whisper_model.transcribe(chunk_16k, fp16=torch.cuda.is_available())
            text = res['text'].strip()

            if len(text.split()) < 3:
                segments_rejected += 1
                continue

            # Save XTTS 22050Hz chunk
            start_22k = int(start_sec * 22050)
            end_22k = int(end_sec * 22050)
            chunk_22k = wav_22k[:, start_22k:end_22k]
            
            chunk_name = f"segment_{i:04d}.wav"
            chunk_path = f"{wavs_dir}/{chunk_name}"
            torchaudio.save(chunk_path, chunk_22k, 22050, format="wav")

            clean_text = text.replace('|', '').replace('\n', ' ').strip()
            metadata_lines.append(f"segment_{i:04d}|{clean_text}|{clean_text}")
            
            segments_created += 1
            usable_duration_sec += duration

        if segments_created == 0:
            raise ValueError("Validation Failed: 0 valid segments created. Audio may be empty or contain no recognizable speech.")

        # Train/Eval Split
        random.seed(42)
        random.shuffle(metadata_lines)
        split_idx = int(0.9 * len(metadata_lines))
        train_lines = metadata_lines[:split_idx]
        eval_lines = metadata_lines[split_idx:]
        
        # Ensure eval has at least 1 item
        if len(eval_lines) == 0:
            eval_lines = train_lines[-1:]
            train_lines = train_lines[:-1]

        metadata_csv = f"{dataset_dir}/metadata.csv"
        with open(metadata_csv, 'w') as f:
            for line in metadata_lines:
                f.write(line + "\n")
                
        with open(f"{dataset_dir}/train.txt", 'w') as f:
            for line in train_lines:
                f.write(line + "\n")
                
        with open(f"{dataset_dir}/eval.txt", 'w') as f:
            for line in eval_lines:
                f.write(line + "\n")

        avg_segment_len = usable_duration_sec / segments_created if segments_created > 0 else 0

        training_report = {
            "originalDurationMinutes": round(original_duration_sec / 60.0, 2),
            "usableDurationMinutes": round(usable_duration_sec / 60.0, 2),
            "segmentsCreated": segments_created,
            "segmentsRejected": segments_rejected,
            "avgSegmentLengthSeconds": round(avg_segment_len, 2),
            "trainSamples": len(train_lines),
            "evalSamples": len(eval_lines)
        }
        
        log_info(f"Dataset Pipeline Complete: {json.dumps(training_report)}")

        with open(f"{dataset_dir}/training_report.json", "w") as f:
            json.dump(training_report, f)

        # 3. Train using official XTTS Coqui Trainer Flow
        log_info("Downloading and Loading Pretrained XTTS-v2 Base Model")
        model_name = "tts_models/multilingual/multi-dataset/xtts_v2"
        manager = ModelManager()
        model_path, config_path, model_item = manager.download_model(model_name)
        log_info(f"Loaded pretrained model artifacts from {model_path}")

        dataset_config = BaseDatasetConfig(
            formatter="ljspeech",
            meta_file_train="metadata.csv",
            path=dataset_dir
        )
        
        config = XttsConfig()
        config.load_json(config_path)
        
        config.datasets = [dataset_config]
        config.output_path = "/tmp/output_model"
        config.run_name = f"xtts_finetune_{VOICE_ID}"
        config.audio.sample_rate = 22050
        
        # Safe XTTS config improvements for better convergence and VRAM usage
        config.batch_size = 4
        config.eval_batch_size = 4
        config.epochs = 20
        config.print_step = 10
        config.save_step = 1000
        
        model = Xtts.init_from_config(config)
        
        log_info("Injecting pretrained weights into model for speaker adaptation")
        model.load_checkpoint(config, checkpoint_dir=model_path, eval=False)
        
        training_args = TrainingArgs(
            epochs=config.epochs,
            batch_size=config.batch_size,
            eval_batch_size=config.eval_batch_size,
            gradient_accumulation_steps=2
        )
        
        trainer = Trainer(
            args=training_args,
            config=config,
            output_path="/tmp/output_model",
            model=model,
            train_samples=model.load_dataset(config.datasets),
            eval_samples=model.load_dataset(config.datasets) 
        )
        
        log_info("Executing trainer.fit()")
        trainer.fit()
        
        # 4. Upload Artifacts
        log_info("Uploading Fine-Tuned Model Artifacts to GCS")
        run_dir = os.path.join("/tmp/output_model", config.run_name)
        
        if not os.path.exists(run_dir):
            run_dir = "/tmp/output_model"

        files_to_upload = [f for f in os.listdir(run_dir) if os.path.isfile(os.path.join(run_dir, f))]
        
        # Include training_report.json
        blob_report = bucket_models.blob(f"{USER_ID}/{VOICE_ID}/training_report.json")
        blob_report.upload_from_filename(f"{dataset_dir}/training_report.json")

        for f_name in files_to_upload:
            full_path = os.path.join(run_dir, f_name)
            blob = bucket_models.blob(f"{USER_ID}/{VOICE_ID}/{f_name}")
            blob.upload_from_filename(full_path)

        log_info("Training Pipeline Completed Successfully")

    except Exception as e:
        log_error("Training Pipeline Failed", exc=e)
        sys.exit(1)

if __name__ == "__main__":
    main()
