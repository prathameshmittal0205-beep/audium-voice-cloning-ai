import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { audiumApi } from '../api/audium';

const STATUS_CONFIG = {
  idle:       { dot: "#555",     text: "No audio generated",                    pulse: false },
  generating: { dot: "#00E5E5",  text: "Generating audio...",                   pulse: true  },
  ready:      { dot: "#00E5A0",  text: "Audio ready — playback & export enabled", pulse: false },
  error:      { dot: "#F5A623",  text: "Generation failed — please retry",      pulse: false },
};

const AudioStatusBadge = ({ status }) => {
  const config = STATUS_CONFIG[status];
  return (
    <div className="audio-status-badge">
      <span
        className={`status-dot-inner ${config.pulse ? "pulse" : ""}`}
        style={{ backgroundColor: config.dot }}
      />
      <span
        className="status-text"
        style={{ color: config.dot }}
      >
        {config.text}
      </span>
    </div>
  );
};



const Dashboard = () => {
  const { logout, user } = useAuth();
  
  const [audioFile, setAudioFile] = useState(null);
  const [audioFileValid, setAudioFileValid] = useState(true);
  const [audioFileError, setAudioFileError] = useState('');
  
  const [transcript, setTranscript] = useState('');
  const [uploadState, setUploadState] = useState({ loading: false, error: '', success: '' });
  
  const [activeJobId, setActiveJobId] = useState(() => localStorage.getItem("audium_active_job") || null);
  const [activeVoiceId, setActiveVoiceId] = useState(() => localStorage.getItem("audium_active_voice") || null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingLogs, setTrainingLogs] = useState([]);
  
  // modelReady state synced with localStorage
  const [modelReady, setModelReady] = useState(() => localStorage.getItem("audium_model_ready") === "true");
  
  const [ttsText, setTtsText] = useState('');
  const [ttsState, setTtsState] = useState({ loading: false, error: '', audioUrl: null });
  const [audioStatus, setAudioStatus] = useState("idle");

  const [audioSrc, setAudioSrc] = useState(null);
  const [realAudioBlob, setRealAudioBlob] = useState(null);
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Time of day greeting
  const [greeting, setGreeting] = useState("Good day");
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };
    const handleError = (e) => {
      console.error("Audio decode error:", e);
      setIsPlaying(false);
      setAudioStatus("error");
    };
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [audioSrc]);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      const attemptPlay = () => {
        audio.play()
          .then(() => setIsPlaying(true))
          .catch(err => {
            console.error('Playback failed:', err);
            setAudioStatus('error');
          });
      };

      if (audio.readyState >= 3) {
        attemptPlay();
      } else {
        audio.addEventListener('canplaythrough', attemptPlay, { once: true });
        audio.load();
      }
    }
  };

  const handleDownload = () => {
    if (!realAudioBlob) return;
    const url = URL.createObjectURL(realAudioBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audium_export.wav";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Poll job status
  useEffect(() => {
    let isMounted = true;
    let intervalId;
    let pollCount = 0;
    const MAX_POLLS = 60; // 10 minutes at 10s intervals

    if (activeJobId && isTraining) {
      intervalId = setInterval(async () => {
        try {
          pollCount++;
          if (pollCount >= MAX_POLLS) {
            clearInterval(intervalId);
            if (isMounted) {
              setIsTraining(false);
              setUploadState({ loading: false, error: 'Training timed out after 10 minutes. Please try again.', success: '' });
              setTrainingLogs(prev => [...prev, { type: "WARN", text: "Training timed out." }]);
            }
            return;
          }

          const statusRes = await audiumApi.getTrainingStatus(activeJobId);
          if (isMounted) {
            const progress = statusRes.inferredProgress || 0;
            const state = statusRes.state || 'UNKNOWN';
            
            setTrainingProgress(progress);
            setTrainingLogs(prev => [...prev, { type: "PROCESS", text: `Training state: ${state}` }]);
            
            if (state === 'COMPLETED') {
              clearInterval(intervalId);
              setModelReady(true);
              setIsTraining(false);
              localStorage.setItem("audium_model_ready", "true");
              setTrainingLogs(prev => [...prev, { type: "SUCCESS", text: "Voice model saved. Ready for synthesis." }]);
            } else if (state === 'FAILED' || state === 'JOB_STATE_FAILED' || state === 'JOB_STATE_CANCELLED') {
              clearInterval(intervalId);
              setIsTraining(false);
              setUploadState({ loading: false, error: 'Training failed.', success: '' });
              setTrainingLogs(prev => [...prev, { type: "WARN", text: "Training job failed." }]);
            }
          }
        } catch (err) {
          clearInterval(intervalId);
          if (isMounted) {
            setIsTraining(false);
            setUploadState({ loading: false, error: 'Failed to poll status', success: '' });
          }
        }
      }, 10000); // 10 seconds polling
    }

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeJobId, isTraining]);

  const validateAudioFile = (file) => {
    const validTypes = ["audio/wav", "audio/x-wav", "audio/wave"];
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (!validTypes.includes(file.type)) {
      return { valid: false, error: "Only .wav files are supported" };
    }
    if (file.size > maxSize) {
      return { valid: false, error: "File must be under 50MB" };
    }
    return { valid: true };
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validation = validateAudioFile(file);
      if (!validation.valid) {
        setAudioFileValid(false);
        setAudioFileError(validation.error);
        setAudioFile(null);
      } else {
        setAudioFileValid(true);
        setAudioFileError('');
        setAudioFile(file);
      }
    }
  };

  const handleTranscriptChange = (e) => {
    setTranscript(e.target.value);
  };

  const handleTranscriptPaste = (e) => {
    e.preventDefault();
    const pastedText = (e.clipboardData || window.clipboardData).getData("text").trim();
    setTranscript(pastedText);
  };

  const handleUploadAndTrain = async (e) => {
    e.preventDefault();
    if (!audioFile || !transcript) return;
    
    if (transcript.length < 20) {
      setUploadState({ loading: false, error: 'Longer transcripts produce better voice models (min 20 chars)', success: '' });
      return;
    }

    setIsTraining(true);
    setUploadState({ loading: true, error: '', success: '' });
    setTrainingProgress(10); // Start phase 1 upload
    
    try {
      const transcriptFile = new File([transcript], 'transcript.txt', { type: 'text/plain' });

      setTrainingLogs([{ type: "PROCESS", text: "Uploading audio..." }]);
      const uploadRes = await audiumApi.uploadVoice(audioFile, transcriptFile);
      
      setTrainingLogs(prev => [...prev, { type: "PROCESS", text: "Upload complete. Triggering training..." }]);
      setTrainingProgress(20);
      
      const trainRes = await audiumApi.startTraining(uploadRes.uploadId, uploadRes.audioUrl, uploadRes.transcriptUrl);
      
      setUploadState({ loading: false, error: '', success: '' });
      setActiveJobId(trainRes.jobId);
      setActiveVoiceId(trainRes.voiceId);
      localStorage.setItem("audium_active_voice", trainRes.voiceId);
      localStorage.setItem("audium_active_job", trainRes.jobId);
      setTrainingLogs(prev => [...prev, { type: "PROCESS", text: "Training job queued." }]);
      
    } catch (err) {
      setUploadState({ loading: false, error: err.message || 'Upload/Train failed', success: '' });
      setIsTraining(false);
    }
  };

  const handleGenerateTTS = async (e) => {
    e.preventDefault();
    if (!ttsText.trim()) return;

    if (!modelReady) {
      setTtsState({ loading: false, error: 'No model trained. A trained voice model is required.', audioUrl: null });
      return;
    }

    setIsPlaying(false);
    setProgress(0);
    setAudioStatus("idle");
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    
    if (audioSrc && audioSrc.startsWith('blob:')) {
      URL.revokeObjectURL(audioSrc);
    }
    setAudioSrc(null);

    setTtsState(prev => ({ ...prev, loading: true, error: '', audioUrl: null }));
    setAudioStatus("generating");

    try {
      if (!activeVoiceId) {
        throw new Error("No active voice model. Please train a model first.");
      }
      
      const res = await audiumApi.generateTTS(ttsText, activeVoiceId);
      
      if (!res.audioUrl) {
        throw new Error("Generation failed at server.");
      }

      setAudioSrc(res.audioUrl);
      setAudioStatus("ready");
      setTtsState({ loading: false, error: '', audioUrl: res.audioUrl });
    } catch (err) {
      console.error(err);
      setAudioStatus("error");
      setTtsState(prev => ({ ...prev, loading: false, error: err.message || 'Generation failed', audioUrl: null }));
    }
  };

  const formatLog = (logObj, index) => {
    let tagClass = "log-tag-process";
    if (logObj.type === "SUCCESS") tagClass = "log-tag-success";
    else if (logObj.type === "INFO") tagClass = "log-tag-info";
    else if (logObj.type === "NEURAL") tagClass = "log-tag-neural";
    else if (logObj.type === "WARN") tagClass = "log-tag-warn";

    return (
      <div key={index} className="log-line">
        <span className="log-time">[{new Date().toISOString().substring(11, 19)}]</span>
        <span className={tagClass}>[{logObj.type}]</span> {logObj.text}
      </div>
    );
  };

  const CIRCUMFERENCE = 2 * Math.PI * 19; 
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  const ttsCharCount = ttsText.length;
  let charCountColor = "var(--text-muted)";
  if (ttsCharCount >= 240) charCountColor = "var(--error)";
  else if (ttsCharCount >= 200) charCountColor = "#F59E0B";

  return (
    <div className="container animate-slide-up">
      <header className="nav-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

            <div className="logo-text heading-serif hide-on-mobile" style={{ fontSize: '1.25rem', margin: 0 }}>
              Audium
            </div>
          </div>
          <div className="status-pill hide-on-mobile">
            <div className="status-dot"></div>
            Engine Ready
          </div>
        </div>
        <button className="btn btn-ghost-danger" onClick={logout}>Sign Out</button>
      </header>

      {/* Welcome Banner */}
      <div style={{ marginTop: '2rem', marginBottom: '1rem', padding: '0 1rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontFamily: 'Sora' }}>Welcome back</p>
        <h2 className="heading-serif" style={{ fontSize: '1.8rem', margin: 0 }}>{greeting}, {user?.name || "Tester"}</h2>
      </div>

      <div className="dashboard-grid" style={{ marginTop: '1rem' }}>
        
        {/* Voice Engineering */}
        <section className="glass-panel" aria-labelledby="train-heading">
          <h2 id="train-heading">Voice Engineering</h2>
          <p className="section-desc">Upload a clean, noise-free voice sample alongside its exact transcript to construct a high-fidelity synthetic clone.</p>
          
          {uploadState.error && <div className="alert alert-error">{uploadState.error}</div>}
          
          <form onSubmit={handleUploadAndTrain}>
            <div className="input-group">
              <label className="input-label" htmlFor="audio-upload">Audio File (.wav)</label>
              <label className="upload-zone">
                <div className="upload-box" style={{ borderColor: audioFileValid ? 'transparent' : 'var(--error)' }}>
                  <svg className="marching-border"><rect width="100%" height="100%" /></svg>
                  <span style={{ color: 'var(--text-muted)' }}>Drag & Drop or Click to Select</span>
                </div>
                <input id="audio-upload" type="file" accept=".wav,audio/wav,audio/x-wav,audio/wave" onChange={handleFileChange} required disabled={isTraining} />
              </label>
              {!audioFileValid && <div style={{ color: '#F59E0B', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 500 }}>{audioFileError}</div>}
              {audioFile && audioFileValid && (
                <div style={{ color: 'var(--glow-cyan)', fontSize: '0.85rem', marginTop: '0.5rem', fontFamily: 'IBM Plex Mono' }}>
                  Selected: {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
            </div>
            
            <div className="input-group">
              <label className="input-label" htmlFor="transcript">Transcript</label>
              <textarea 
                id="transcript" 
                className="input-field synthesis-textarea" 
                rows="4" 
                value={transcript} 
                onChange={handleTranscriptChange}
                onPaste={handleTranscriptPaste}
                maxLength={5000}
                required 
                disabled={isTraining}
              ></textarea>
              <div style={{ fontSize: '0.75rem', color: transcript.length < 20 ? '#F59E0B' : 'var(--text-muted)', textAlign: 'right', marginTop: '0.25rem', fontFamily: 'IBM Plex Mono' }}>
                {transcript.length < 20 && <span>Longer transcripts produce better voice models | </span>}
                {transcript.length}/5000
              </div>
            </div>
            
            <div title={isTraining ? "Training in progress..." : "Upload a .wav file and transcript to begin"}>
              <button type="submit" className={`btn btn-cta btn-morph ${isTraining ? 'is-training' : ''}`} disabled={isTraining || !audioFileValid}>
                <span className="btn-morph-text" style={{ opacity: isTraining ? 0 : 1 }}>Initialize Voice Model</span>
                {isTraining && (
                  <div className="shimmer-container" style={{ margin: 0, position: 'absolute', top: '50%', left: 0, right: 0, transform: 'translateY(-50%)', opacity: trainingProgress > 0 ? 1 : 0, transition: 'opacity 0.3s ease' }}>
                    <div className="shimmer-fill shimmer-fill-cyan" style={{ width: `${trainingProgress}%` }}></div>
                  </div>
                )}
              </button>
            </div>
          </form>

          {(isTraining || trainingLogs.length > 0) && (
            <div className="animate-slide-up stagger-2" style={{ marginTop: '2rem' }}>
              <div className="ai-console">
                {trainingLogs.length === 0 ? (
                  <span className="thinking-dots" style={{ color: 'var(--text-muted)' }}>Establishing secure ML container connection</span>
                ) : (
                  <>
                    {trainingLogs.map((logObj, i) => formatLog(logObj, i))}
                    {modelReady && !isTraining && (
                      <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }} className="animate-slide-up">
                        <div style={{ color: 'var(--glow-cyan)', marginBottom: '1rem', fontWeight: 500, fontFamily: 'Sora' }}>
                          ✨ Your voice profile is ready!
                        </div>
                        <button 
                          type="button"
                          className="btn btn-primary" 
                          onClick={() => {
                            const el = document.getElementById('generate-heading');
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            // Optionally focus the textarea
                            setTimeout(() => document.getElementById('tts-text')?.focus(), 500);
                          }}
                        >
                          Start Synthesizing ↓
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Synthesis Engine */}
        <section className="glass-panel" aria-labelledby="generate-heading">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2 id="generate-heading" style={{ margin: 0 }}>Synthesis Engine</h2>
            {modelReady ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--glow-cyan)', fontFamily: 'IBM Plex Mono' }}>Model ready ✓</span>
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-faint)', fontFamily: 'IBM Plex Mono' }}>No model trained</span>
            )}
          </div>
          <p className="section-desc">Type your text below to synthesize zero-shot speech using the active acoustic model.</p>
          
          {!modelReady ? (
            <div style={{ position: 'relative', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', overflow: 'hidden' }}>
              <div className="empty-state-wave">
                <svg viewBox="0 0 400 100" preserveAspectRatio="none">
                  <path d="M0,50 Q50,0 100,50 T200,50 T300,50 T400,50" />
                </svg>
              </div>
              <p style={{ position: 'relative', zIndex: 1, fontFamily: 'IBM Plex Mono', fontStyle: 'italic', color: 'var(--text-faint)', fontSize: '0.85rem' }}>
                Train a voice model to unlock synthesis
              </p>
            </div>
          ) : (
            <>
              {ttsState.error && <div className="alert alert-error">{ttsState.error}</div>}
              
              <form onSubmit={handleGenerateTTS}>
                <div className="input-group">
                  <label className="input-label" htmlFor="tts-text">Message (Max 250 chars)</label>
                  <textarea 
                    id="tts-text" 
                    className="input-field synthesis-textarea" 
                    rows="4" 
                    value={ttsText} 
                    onChange={(e) => setTtsText(e.target.value)} 
                    maxLength={250}
                    required
                  ></textarea>
                  <div style={{ fontSize: '0.75rem', color: charCountColor, textAlign: 'right', marginTop: '0.25rem', fontFamily: 'IBM Plex Mono', transition: 'color 0.3s' }}>
                    {ttsCharCount}/250
                  </div>
                </div>
                <div title={modelReady ? "Generate new speech from text" : "A trained voice model is required"}>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={ttsState.loading || !modelReady}>
                    {ttsState.loading ? <span className="thinking-dots">Synthesizing vocal tract</span> : 'Generate Speech'}
                  </button>
                </div>
              </form>
              
              <AudioStatusBadge status={audioStatus} />

              {ttsState.audioUrl && (
                <div className="reveal-wrapper" style={{ marginTop: '2rem' }}>
                  <div style={{ background: 'var(--bg-input)', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>Playback</h3>
                      <button type="button" onClick={handleDownload} className="btn btn-ghost-danger" style={{ padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        Export .wav
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '6px' }}>
                          <path d="M12 5v14M19 12l-7 7-7-7"/>
                        </svg>
                      </button>
                    </div>

                    <div className="audio-visualizer-container">
                      <div className="audio-bar ghost-bar stagger-1 hide-on-mobile"></div>
                      <div className="audio-bar stagger-2"></div>
                      <div className="audio-bar stagger-3"></div>
                      <div className="audio-bar stagger-4" style={{ background: 'var(--glow-cyan)' }}></div>
                      <div className="audio-bar stagger-3"></div>
                      <div className="audio-bar stagger-2"></div>
                      <div className="audio-bar ghost-bar stagger-1 hide-on-mobile"></div>
                    </div>
                    
                    <div className="custom-player">
                      <button type="button" className="play-btn" onClick={togglePlayback}>
                        <svg width="44" height="44" viewBox="0 0 44 44" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                          <circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                          <circle className="progress-ring-circle" cx="22" cy="22" r="19" fill="none" strokeWidth="2" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={dashOffset} />
                        </svg>
                        {isPlaying ? (
                          <svg className="play-icon" viewBox="0 0 24 24" width="16" height="16">
                            <rect x="6" y="4" width="4" height="16" />
                            <rect x="14" y="4" width="4" height="16" />
                          </svg>
                        ) : (
                          <svg className="play-icon" viewBox="0 0 24 24" width="16" height="16" style={{ transform: 'translateX(1px)' }}>
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        )}
                      </button>
                      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', color: 'var(--glow-cyan)' }}>
                        {isPlaying ? 'PLAYING' : 'READY'}
                      </div>
                    </div>

                    {/* Hidden Native Audio Element */}
                    <audio
                      ref={audioRef}
                      src={audioSrc}
                      preload="metadata"
                      style={{ display: "none" }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </section>

      </div>
    </div>
  );
};

export default Dashboard;
