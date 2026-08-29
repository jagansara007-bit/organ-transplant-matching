import { AuthSession } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const AUTH_TOKEN_KEY = 'organ_tx_auth_token';
export const AUTH_SESSION_KEY = 'organ_tx_auth_session';

export const getStoredToken = (): string | null => {
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

export const getStoredSession = (): AuthSession | null => {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
};

export const setStoredSession = (session: AuthSession): void => {
  localStorage.setItem(AUTH_TOKEN_KEY, session.token);
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
};

export const clearStoredSession = (): void => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_SESSION_KEY);
};

export interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

/**
 * Fetch wrapper with automatic Bearer token injection and 401 Unauthorized interceptor
 */
export const apiClient = {
  async request(endpoint: string, options: RequestOptions = {}): Promise<Response> {
    const token = getStoredToken();
    const headers = new Headers(options.headers || {});

    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    let url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    if (options.params) {
      const searchParams = new URLSearchParams(options.params);
      url += `?${searchParams.toString()}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Handle 401 Unauthorized globally
      if (response.status === 401) {
        clearStoredSession();
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }

      return response;
    } catch (error) {
      console.error(`Network error requesting ${url}:`, error);
      throw error;
    }
  },

  async get<T = any>(endpoint: string, options: RequestOptions = {}): Promise<{ ok: boolean; status: number; data: T }> {
    const res = await this.request(endpoint, { ...options, method: 'GET' });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  },

  async post<T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<{ ok: boolean; status: number; data: T }> {
    const res = await this.request(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  },

  async patch<T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<{ ok: boolean; status: number; data: T }> {
    const res = await this.request(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  },

  async delete<T = any>(endpoint: string, options: RequestOptions = {}): Promise<{ ok: boolean; status: number; data: T }> {
    const res = await this.request(endpoint, { ...options, method: 'DELETE' });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  }
};
