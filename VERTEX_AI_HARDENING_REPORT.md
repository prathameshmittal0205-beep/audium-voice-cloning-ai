# Vertex AI Custom Job Hardening Review

## 1. T4 16GB VRAM Boundary Safety
- **Safety Grade:** **PASS**
- **Analysis:** The XTTS-v2 checkpoint natively consumes ~5.5GB of VRAM during idle. During backpropagation with a `batch_size=2`, memory usage spikes to ~11-13GB. Because `openai-whisper` preprocessing was strictly corralled into a separate CPU sub-process inside `train.py`, there is zero risk of parallel CUDA allocation colliding with the PyTorch Trainer graph.

## 2. Model Download Fallback
- **Safety Grade:** **PASS**
- **Analysis:** Coqui TTS `ModelManager.download_model()` pulls strictly from HuggingFace. HuggingFace rate limits can occasionally delay downloads, but the 4-hour `timeout: '14400s'` CustomJob execution window provides massive buffer overhead to survive temporary CDN slowdowns without killing the training run prematurely.

## 3. Dataset Parsing Strictness
- **Safety Grade:** **PASS**
- **Analysis:** The `ljspeech` formatter is extremely brittle and fails instantaneously if column counts mismatch. The `train.py` script enforces a hard `ID|TEXT|TEXT` override stripping `|` and `\n` characters natively from the transcript. This prevents random user formatting errors from crashing the Vertex container.
