import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Landing from '../pages/Landing';
import { AuthProvider } from '../contexts/AuthContext';
import { api } from '../services/api';

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          <Landing />
        </AuthProvider>
      </BrowserRouter>
    );
  };

  it('renders the login form', () => {
    renderComponent();
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  });

  it('handles successful login', async () => {
    api.post.mockResolvedValueOnce({
      token: 'fake-token',
      refreshToken: 'fake-refresh',
      userId: '123'
    });

    renderComponent();

    fireEvent.change(screen.getByPlaceholderText('Email address'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } });
    
    const submitButtons = screen.getAllByRole('button', { name: /sign in/i });
    fireEvent.click(submitButtons[0]);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123'
      });
    });
  });

  it('handles login failure and shows error', async () => {
    api.post.mockRejectedValueOnce(new Error('Invalid email or password'));

    renderComponent();

    fireEvent.change(screen.getByPlaceholderText('Email address'), { target: { value: 'wrong@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } });
    
    const submitButtons = screen.getAllByRole('button', { name: /sign in/i });
    fireEvent.click(submitButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
    });
  });

  it('logout clears storage', async () => {
    // Manually test the context behavior or mock the window event
    // Since AuthContext listens to 'auth:logout'
    window.localStorage.setItem('audium_token', 'fake-token');
    window.dispatchEvent(new Event('auth:logout'));
    
    await waitFor(() => {
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('audium_token');
    });
  });
});
