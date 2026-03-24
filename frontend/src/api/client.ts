const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? 'Error de servidor');
  }
  return response.json();
}

export const authUrl = `${import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000'}/auth/google`;
export const logoutUrl = `${import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000'}/auth/logout`;
