
let API_BASE = import.meta.env.VITE_AUDIUM_API_BASE_URL;

if (!API_BASE) {
  throw new Error("VITE_AUDIUM_API_BASE_URL is not defined");
}

if (!API_BASE.endsWith('/api')) {
  API_BASE = `${API_BASE.replace(/\/$/, '')}/api`;
}

const fetchWithAuth = async (endpoint, options = {}) => {
  const token = localStorage.getItem('audium_token');
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Auto-set JSON content type unless body is FormData (multipart)
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
    if (typeof options.body !== 'string') {
      options.body = JSON.stringify(options.body);
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = 'An error occurred';
    try {
      const data = await response.json();
      errorMsg = data.error || errorMsg;
    } catch (e) {
      errorMsg = response.statusText;
    }
    throw new Error(errorMsg);
  }

  return response.json();
};

export const audiumApi = {
  login: (email, password) => 
    fetchWithAuth('/auth/login', { method: 'POST', body: { email, password } }),
  
  register: (email, password) => 
    fetchWithAuth('/auth/register', { method: 'POST', body: { email, password } }),
    
  uploadVoice: async (audioFile, transcriptFile) => {
    const token = localStorage.getItem('audium_token');
    const formData = new FormData();
    formData.append('audio', audioFile);
    formData.append('transcript', transcriptFile);

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || err.error || `Upload failed: ${response.status}`);
    }
    return response.json();
  },
    
  startTraining: (uploadId) => 
    fetchWithAuth('/training/start', { method: 'POST', body: { uploadId } }),
    
  getTrainingStatus: (jobId) => 
    fetchWithAuth(`/training/status/${jobId}`),
    
  generateTTS: (text, voiceId) => 
    fetchWithAuth('/tts/generate', { method: 'POST', body: { text, voiceId } }),
    
  getTTSHistory: (page = 1, limit = 10) => 
    fetchWithAuth(`/tts/history?page=${page}&limit=${limit}`),
};
