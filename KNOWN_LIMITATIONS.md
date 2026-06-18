# Audium - Known Limitations

This deployment of Audium is optimized for a **zero-cost portfolio showcase** and relies on a hybrid local/cloud architecture. As a result, there are several operational limitations compared to an enterprise-grade production environment.

## 1. Local ML Worker Dependency
- **Requirement:** High-fidelity voice cloning (XTTS) requires GPU hardware. To avoid expensive cloud GPU costs, the ML inference engine runs on your local machine.
- **Limitation:** The training and generation features will **only work** while your local computer is powered on, connected to the internet, and actively running the ML worker and Ngrok tunnel. If the local worker is offline, users will see an "Offline" state on the frontend.

## 2. Render Free Tier Cold Starts
- **Behavior:** The Audium Node.js backend is hosted on Render's Free Tier, which spins down after 15 minutes of inactivity to conserve resources.
- **Limitation:** The first request sent to the API after it has gone to sleep may take **30 to 60 seconds** to respond. 
- **Action Required:** After a cold start, the backend memory is wiped. You must restart the local ML worker to re-trigger the auto-registration process so the backend knows the current Ngrok URL.

## 3. Ngrok Ephemeral URLs
- **Behavior:** The free tier of Ngrok provides a randomly generated URL (e.g., `https://xxxx.ngrok-free.app`) every time the tunnel is restarted.
- **Limitation:** If you stop and restart Ngrok, the previous URL becomes permanently dead.
- **Action Required:** You must restart the Python ML worker after restarting Ngrok so it can fetch the new tunnel URL and re-register itself with the live Render backend.

## 4. Not HIPAA/Production Ready
- **Behavior:** This is a portfolio demonstration project.
- **Limitation:** It is not intended for production use with real users, sensitive data, or PHI. It lacks the compliance, scaling, and redundancy infrastructure required for commercial operation.
