'use client';

export function getStoredToken(): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const match = document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((cookie) => cookie.startsWith('hit_token='));
    if (match) return decodeURIComponent(match.split('=').slice(1).join('='));
    if (typeof localStorage !== 'undefined') return localStorage.getItem('hit_token');
    return null;
  } catch {
    return null;
  }
}

