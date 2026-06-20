# Audium Demo Script

**Live URL:** [https://audium-voice-cloning-ai.vercel.app](https://audium-voice-cloning-ai.vercel.app)

## Demo Flow

1. **Open the site**: Navigate to the live URL. Ensure the page loads without errors.
2. **Register a new account**: Click "Sign Up" and create a test account.
3. **Login**: Use the new credentials to sign in.
4. **Upload files**: Upload a sample `.wav` file (voice reference) and a corresponding `.txt` transcript.
5. **Start training**: Submit the files to begin the cloning process.
6. **Polling**: Check that the training status is updated via polling.
7. **Generate speech**: Once training is complete, type some text to generate new speech.
8. **Play audio**: Verify the audio plays correctly in the browser.
9. **History**: Go to the history page and confirm the generated record is visible.

This flow confirms End-to-End functionality between the Vercel frontend, Serverless backend, and the local ML worker.
