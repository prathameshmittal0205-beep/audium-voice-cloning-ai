import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGetStarted = () => {
    navigate('/login');
  };

  const scrollToFeatures = () => {
    document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '0 2rem' }}>
      
      {/* Cinematic Hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', minHeight: '70vh' }}>
        
        {/* Animated Background Sine Wave */}
        <div className="empty-state-wave" style={{ opacity: 0.08, zIndex: -1 }}>
          <svg viewBox="0 0 400 100" preserveAspectRatio="none">
            <path d="M0,50 Q50,0 100,50 T200,50 T300,50 T400,50" fill="none" stroke="var(--glow-cyan)" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="animate-slide-up" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '2rem' }}>
          <div className="logo-text heading-serif" style={{ fontSize: '1.5rem', margin: 0 }}>
            Audium
          </div>
        </div>

        <h1 className="heading-serif animate-slide-up stagger-1" style={{ fontSize: 'clamp(3rem, 6vw, 5rem)', lineHeight: 1.1, marginBottom: '1.5rem', position: 'relative', display: 'inline-block' }}>
          Your Voice.<br />
          <span style={{ color: 'transparent', WebkitTextStroke: '1px var(--text-main)', position: 'relative' }}>
            Infinitely Scalable.
            <div className="shimmer-container" style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
              <div className="shimmer-fill shimmer-fill-cyan" style={{ width: '100%', animationDuration: '3s' }}></div>
            </div>
          </span>
        </h1>
        
        <p className="section-desc animate-slide-up stagger-2" style={{ fontSize: '1.25rem', maxWidth: '600px', marginBottom: '3rem', color: 'var(--text-muted)' }}>
          Clone any voice in seconds. Synthesize speech that sounds indistinguishable from the original.
        </p>

        <div className="animate-slide-up stagger-3" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button onClick={handleGetStarted} className="btn btn-cta" style={{ minWidth: '180px' }}>
            Get Started
          </button>
          <button onClick={scrollToFeatures} className="btn btn-ghost-danger" style={{ color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.1)', minWidth: '180px' }}>
            See How It Works
          </button>
        </div>
      </div>

      {/* Feature Cards */}
      <div id="features" className="features-grid animate-slide-up stagger-4" style={{ paddingBottom: '6rem' }}>
        
        <div className="glass-panel" style={{ padding: '2.5rem' }}>
          <div style={{ color: 'var(--glow-cyan)', marginBottom: '1.5rem' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="22"></line>
              <line x1="8" y1="22" x2="16" y2="22"></line>
            </svg>
          </div>
          <h3 className="heading-serif" style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Voice Cloning</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Upload a clean audio sample. Our neural engine maps your vocal tract and trains a high-fidelity model in minutes.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '2.5rem' }}>
          <div style={{ color: 'var(--glow-cyan)', marginBottom: '1.5rem' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h3 className="heading-serif" style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Speech Synthesis</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Type any text to generate zero-shot speech. The active acoustic model dynamically matches your emotional cadence.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '2.5rem' }}>
          <div style={{ color: 'var(--glow-cyan)', marginBottom: '1.5rem' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </div>
          <h3 className="heading-serif" style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Export Ready</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Download studio-quality uncompressed WAV binaries. Ready to drop straight into your timeline or project.
          </p>
        </div>

      </div>
    </div>
  );
};

export default Landing;
