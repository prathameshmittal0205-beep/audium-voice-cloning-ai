FROM us-docker.pkg.dev/vertex-ai/training/pytorch-gpu.2-1:latest

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y ffmpeg libsndfile1

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy ML training script
COPY train.py .

# Entrypoint invoked by Vertex AI Training Job
ENTRYPOINT ["python", "train.py"]
