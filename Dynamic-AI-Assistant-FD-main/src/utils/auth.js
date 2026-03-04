import { fetchWithTimeout, API_BASE_URL } from './api';

export const authAPI = {
  async signup(email, password) {
    const response = await fetchWithTimeout(`/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Signup failed');
    }

    return response.json();
  },

  async login(email, password) {
    const response = await fetchWithTimeout(`/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    return response.json();
  },

  async logout() {
    const response = await fetchWithTimeout(`/api/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });

    return response.json();
  },

  async getCurrentUser() {
    const response = await fetchWithTimeout(`/api/auth/me`, {
      credentials: 'include'
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  },

  async checkAuth() {
    try {
      const response = await fetchWithTimeout(`/api/auth/check`, {
        credentials: 'include'
      });
      if (!response.ok) return { authenticated: false };
      return response.json();
    } catch (error) {
      console.error('Check auth error:', error);
      return { authenticated: false };
    }
  }
};

