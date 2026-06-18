# Audium Voice Cloning AI - Architecture & Ngrok Integration

Welcome to the Audium Voice Cloning AI project. This document explains the hybrid local/cloud architecture of the application and details exactly how the frontend communicates with your local PyTorch ML environment using **ngrok**.

## 🏗️ The Problem

To run high-fidelity zero-shot voice cloning using models like `Coqui XTTS-v2`, you need access to intense GPU hardware (CUDA acceleration). Hosting this type of ML infrastructure on the cloud is extremely expensive. 

Conversely, the frontend UI is built with React/Vite, which is very cheap and easy to host on edge networks like Vercel. 

However, if you host the frontend on Vercel (`https://audium-seven.vercel.app`) and run the backend PyTorch server on your local machine (`http://localhost:8000`), the browser will block them from talking to each other. Modern web security (Mixed Content policies and CORS) strictly prohibits an `https` cloud website from making direct API calls to your local `http://localhost` computer.

## 🚀 The Ngrok Solution

To bridge the secure Vercel frontend with your local hardware GPU, we use **ngrok**. 

### How it works step-by-step:
1. **The PyTorch Backend**: You run the FastAPI Python server locally (`uvicorn server:app`). This spins up the XTTS-v2 ML model directly into your RTX GPU's VRAM and listens on `localhost:8000`.
2. **The Ngrok Tunnel**: You run `ngrok http 8000` in a second terminal. Ngrok binds to your local port and assigns you a secure, public HTTPS URL (e.g., `https://postlicentiate-flecklessly-mason.ngrok-free.dev`).
3. **The Frontend Setup**: We set the environment variable `VITE_XTTS_API_URL` to your public ngrok URL. This can be done locally in `.env.local` or centrally in Vercel.
4. **The User Interaction**: 
   - A user opens the React frontend in their browser.
   - They upload a `.wav` file, type a transcript, and click "Generate Speech".
   - The React frontend packages the audio file and text into a `FormData` object.
   - Using the `fetch` API, the browser makes a `POST` request to the ngrok URL.
5. **The Synthesis Loop**:
   - The payload travels securely through the internet, hits the ngrok cloud, and gets instantly funneled down the tunnel directly into your local computer's `localhost:8000` port.
   - FastAPI receives the audio, your local RTX GPU performs the heavy inference to clone the voice.
   - The generated audio is converted to a Base64 string and sent back up the tunnel to the React app.
   - The frontend decodes the Base64, creates a raw binary `Blob`, and plays the cloned voice directly in the browser.

## ⚙️ Why We Chose This Architecture

- **Cost Efficient**: You get to use your own physical GPU for free rather than paying $1.50+/hr for an AWS/RunPod instance while developing.
- **Security**: You don't have to open ports on your router or deal with complex SSH port forwarding.
- **Scalability**: The React frontend is completely decoupled from the AI engine. If you ever decide to deploy the backend to a cloud GPU provider, you just change `VITE_XTTS_API_URL` to point to the new cloud server IP, and the app continues working flawlessly without any code changes.

## 🛠️ How to Start the Stack

1. **Start the ML Backend**
   ```powershell
   cd d:\Projects\audium-ml-backend
   .\venv\Scripts\activate
   uvicorn server:app --host 0.0.0.0 --port 8000
   ```

2. **Start the Ngrok Tunnel** (in a new terminal)
   ```powershell
   cd d:\Projects\audium-ml-backend
   ngrok http 8000
   ```
   *(Copy the generated https URL)*

3. **Configure & Start the Frontend** (in a new terminal)
   ```powershell
   cd d:\Projects\audium_voice_cloning_ai\frontend
   ```
   - Make sure your `.env.local` contains: `VITE_XTTS_API_URL=<your-new-ngrok-url>`
   ```powershell
   npm run dev
   ```

Open `http://localhost:5173` and start cloning voices!

## 🚀 Deployment Checklist

Before deploying Audium to Render and Vercel, you **must** set the following environment variables in their respective dashboards:

### Backend (Render Environment Variables)
- `AUDIUM_JWT_SECRET` — A secure, random string used to cryptographically sign user session tokens.
- `AUDIUM_MONGODB_URI` — The connection string to your MongoDB Atlas cluster (e.g., `mongodb+srv://...`).
- `WORKER_SECRET` — A shared secret string that matches the secret configured on your local ML Worker for secure registration.

*(Note: After the Render backend wakes from sleep, restart the local ML worker to trigger automatic re-registration.)*

### Frontend (Vercel Environment Variables)
- `VITE_AUDIUM_API_BASE_URL` — The full URL of your deployed Render backend (e.g., `https://audium-backend.onrender.com/api`).
