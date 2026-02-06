/**
 * Centralized API client with authentication
 */

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export const API_KEY = import.meta.env.VITE_API_KEY || '';

/**
 * Fetch with API key authentication
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
    ...options.headers,
  };

  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * GET request helper
 */
export async function apiGet<T = any>(endpoint: string): Promise<T> {
  const response = await apiFetch(endpoint);

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * POST request helper
 */
export async function apiPost<T = any>(endpoint: string, data?: any): Promise<T> {
  const response = await apiFetch(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * PATCH request helper
 */
export async function apiPatch<T = any>(endpoint: string, data?: any): Promise<T> {
  const response = await apiFetch(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * DELETE request helper
 */
export async function apiDelete<T = any>(endpoint: string): Promise<T> {
  const response = await apiFetch(endpoint, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
