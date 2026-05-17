const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.error ?? 'Error de servidor', response.status);
  }
  return response.json();
}

export function buildAuthUrl(returnTo = '/') {
  const baseUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000';
  return `${baseUrl}/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
}

export const authUrl = buildAuthUrl('/');
export const logoutUrl = `${import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000'}/auth/logout`;
