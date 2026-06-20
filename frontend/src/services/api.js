const BASE_URL = import.meta.env.VITE_AUDIUM_API_BASE_URL;

if (!BASE_URL) {
  throw new Error("VITE_AUDIUM_API_BASE_URL is not defined");
}

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token) => {
  refreshSubscribers.map(cb => cb(token));
  refreshSubscribers = [];
};

const onRefreshFailed = () => {
  refreshSubscribers = [];
  isRefreshing = false;
};

const doFetch = async (endpoint, options) => {
  let token = localStorage.getItem('audium_token');
  const headers = {
    ...options.headers,
    ...(token && { Authorization: `Bearer ${token}` })
  };

  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });

  if (res.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
    if (!isRefreshing) {
      isRefreshing = true;
      const refreshToken = localStorage.getItem('audium_refresh_token');
      
      if (!refreshToken) {
        isRefreshing = false;
        throw new Error('No refresh token available');
      }

      try {
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });

        if (!refreshRes.ok) {
          throw new Error('Refresh failed');
        }

        const data = await refreshRes.json();
        localStorage.setItem('audium_token', data.token);
        localStorage.setItem('audium_refresh_token', data.refreshToken);
        
        isRefreshing = false;
        onRefreshed(data.token);
      } catch (e) {
        onRefreshFailed();
        // Trigger logout event conceptually, here we just clear tokens
        localStorage.removeItem('audium_token');
        localStorage.removeItem('audium_refresh_token');
        localStorage.removeItem('audium_userId');
        window.dispatchEvent(new Event('auth:logout'));
        throw e;
      }
    }

    // Wait for the refresh to complete
    const retryOriginalRequest = new Promise((resolve) => {
      subscribeTokenRefresh((newToken) => {
        headers.Authorization = `Bearer ${newToken}`;
        resolve(fetch(`${BASE_URL}${endpoint}`, { ...options, headers }));
      });
    });
    
    const retryRes = await retryOriginalRequest;
    if (!retryRes.ok) throw new Error(`API error: ${retryRes.status}`);
    return retryRes.json();
  }

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};

export const api = {
  post: async (endpoint, body) => {
    return doFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  },
  postFormData: async (endpoint, formData) => {
    return doFetch(endpoint, {
      method: 'POST',
      headers: {}, // Do not set Content-Type, let browser set it with boundary
      body: formData
    });
  },
  get: async (endpoint) => {
    return doFetch(endpoint, {
      method: 'GET',
      headers: {}
    });
  }
};
