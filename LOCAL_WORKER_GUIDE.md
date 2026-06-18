# Local ML Worker Guide

To enable voice cloning functionality on the live Audium website, you must run the ML worker locally on your machine and expose it to the cloud via Ngrok.

This bridges the Vercel/Render cloud infrastructure directly to your local GPU.

## Prerequisites
- Python 3.10+
- A CUDA-compatible NVIDIA GPU (strongly recommended for XTTS generation speeds)
- Ngrok installed and authenticated (`ngrok config add-authtoken <your_token>`)

## Step 1: Start the ML Worker

Open a terminal (Powershell/Command Prompt/Bash) and start the FastAPI application:

```bash
cd ml/worker
# Activate your virtual environment if applicable (e.g., .\venv\Scripts\activate)
pip install -r requirements.txt
python -m uvicorn app:app --host 0.0.0.0 --port 8001
```

Keep this terminal window open.

## Step 2: Start the Ngrok Tunnel

Open a **second** terminal window to expose port 8001 to the internet:

```bash
ngrok http 8001
```

Ngrok will output a Forwarding URL that looks like: `https://xxxx-xx-xx-xx-xx.ngrok-free.app`.
Leave this terminal window running.

## Step 3: Register the Worker with the Cloud Backend

The Python application (`app.py`) includes auto-registration logic that runs every 60 seconds. It will attempt to detect the running Ngrok tunnel and send a POST request to your deployed Render backend to register itself.

**However**, if auto-registration fails or if you want to force registration immediately, you can register it manually.

Open a **third** terminal and run the following curl command (replace the placeholders with your actual values):

```bash
curl -X POST https://audium-api.onrender.com/internal/register-worker \
  -H "Content-Type: application/json" \
  -d '{
    "workerUrl": "https://<YOUR-NGROK-URL>.ngrok-free.app",
    "secret": "<YOUR-WORKER-SECRET>"
  }'
```

*Note: `<YOUR-WORKER-SECRET>` must match the `WORKER_SECRET` you set in the Render environment variables.*

## Re-registration Requirements
You must repeat Step 3 (or rely on the auto-registration heartbeat) whenever:
1. You stop and restart Ngrok (because your Ngrok URL changes).
2. The Render backend goes to sleep (inactivity > 15 minutes) and wakes back up (because the backend's memory is wiped on a cold start).
