import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard from '../pages/Dashboard';
import { AuthContext } from '../contexts/AuthContext';
import { api } from '../services/api';

const mockUser = {
  token: 'fake-token',
  userId: '123'
};

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderDashboard = (user = mockUser, loading = false) => {
    return render(
      <AuthContext.Provider value={{ user, logout: vi.fn(), loading }}>
        <Dashboard />
      </AuthContext.Provider>
    );
  };

  it('renders loading state initially', () => {
    renderDashboard(mockUser, true);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('fetches and displays voice status on mount', async () => {
    api.get.mockResolvedValueOnce({ voice: { status: 'ready', name: 'My Voice', _id: 'voice123' } });
    renderDashboard();

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/model/status');
    });
    expect(screen.getByText('Your Digital Voice is Ready')).toBeInTheDocument();
  });

  it('handles TTS generation successfully', async () => {
    api.get.mockResolvedValueOnce({ voice: { status: 'ready', name: 'My Voice', _id: 'voice123' } });
    api.post.mockResolvedValueOnce({ audioUrl: 'https://fake-audio-url.com/test.wav' });
    
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type something for your digital voice/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Type something for your digital voice/i), { target: { value: 'Hello world' } });
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/tts/generate', { text: 'Hello world', voiceId: 'voice123' });
    });
    
    // The component sets the audio URL
    expect(screen.getByRole('button', { name: /generate/i })).not.toBeDisabled();
  });

  it('handles upload workflow successfully', async () => {
    api.get.mockResolvedValueOnce({ voice: null });
    api.postFormData.mockResolvedValueOnce({ uploadId: 'upload123', gcsUri: 'gs://bucket/file' });
    api.post.mockResolvedValueOnce({ jobId: 'job123' });
    
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Upload Voice Samples')).toBeInTheDocument();
    });

    const file = new File(['dummy content'], 'test.wav', { type: 'audio/wav' });
    const input = document.querySelector('input[type="file"]');
    
    // Simulating the file selection
    fireEvent.change(input, { target: { files: [file] } });
    
    // Trigger upload
    fireEvent.click(screen.getByRole('button', { name: /start voice cloning/i }));

    await waitFor(() => {
      expect(api.postFormData).toHaveBeenCalled();
      expect(api.post).toHaveBeenCalledWith('/training/start', { uploadId: 'upload123' });
    });
  });
});
