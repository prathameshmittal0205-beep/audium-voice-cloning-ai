const API_BASE = import.meta.env.VITE_AUDIUM_API_BASE_URL || 'http://localhost:8080/api';

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
    
  uploadVoice: (formData) => 
    fetchWithAuth('/upload', { method: 'POST', body: formData }),
    
  startTraining: (uploadId) => 
    fetchWithAuth('/training/start', { method: 'POST', body: { uploadId } }),
    
  getTrainingStatus: (jobId) => 
    fetchWithAuth(`/training/status/${jobId}`),
    
  generateTTS: (text, voiceId) => 
    fetchWithAuth('/tts/generate', { method: 'POST', body: { text, voiceId } }),
    
  getTTSHistory: (page = 1, limit = 10) => 
    fetchWithAuth(`/tts/history?page=${page}&limit=${limit}`),
};
