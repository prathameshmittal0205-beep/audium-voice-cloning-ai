import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="glass-panel card-breathing-border animate-slide-up" style={{ width: '100%', maxWidth: '440px', padding: '3.5rem', overflow: 'hidden', position: 'relative' }}>
        <div className="empty-state-wave" style={{ opacity: 0.2, height: '120px', top: 0, bottom: 'auto' }}>
          <svg viewBox="0 0 400 100" preserveAspectRatio="none">
            <path d="M0,50 Q50,0 100,50 T200,50 T300,50 T400,50" fill="none" stroke="var(--glow-cyan)" strokeWidth="1.5" />
          </svg>
        </div>
        <div className="animate-slide-up stagger-1" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '28px', position: 'relative', zIndex: 1 }}>

          <div className="logo-text heading-serif" style={{ fontSize: '2rem', margin: 0 }}>
            Audium
          </div>
        </div>
        <h2 className="animate-slide-up stagger-2" style={{ fontSize: '1.25rem', marginBottom: '2rem', textAlign: 'center', fontWeight: '400', fontFamily: 'Sora', position: 'relative', zIndex: 1 }}>
          {isLogin ? 'Sign in to your account' : 'Create an account'}
        </h2>
        
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        
        <form onSubmit={handleSubmit} style={{ position: 'relative', zIndex: 1 }}>
          <div className="input-group animate-slide-up stagger-3">
            <label className="input-label" htmlFor="email">Email address</label>
            <input 
              id="email"
              type="email" 
              className="input-field" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>
          <div className="input-group animate-slide-up stagger-4">
            <label className="input-label" htmlFor="password">Password</label>
            <input 
              id="password"
              type="password" 
              className="input-field" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-cta animate-slide-up" 
            style={{ width: '100%', marginTop: '1.5rem', padding: '1rem', animationDelay: '400ms' }}
            disabled={loading}
          >
            {loading ? <span className="thinking-dots">Authenticating</span> : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>
        
        <div className="animate-slide-up" style={{ textAlign: 'center', marginTop: '2rem', position: 'relative', zIndex: 1, animationDelay: '480ms' }}>
          <button 
            type="button" 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', transition: 'color 0.2s ease' }}
            onMouseOver={(e) => e.target.style.color = 'var(--text-main)'}
            onMouseOut={(e) => e.target.style.color = 'var(--text-muted)'}
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
          
          <div style={{ marginTop: '1rem' }}>
            <button 
              type="button" 
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', transition: 'color 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}
              onMouseOver={(e) => e.target.style.color = 'var(--text-main)'}
              onMouseOut={(e) => e.target.style.color = 'var(--text-muted)'}
              onClick={() => navigate('/')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
