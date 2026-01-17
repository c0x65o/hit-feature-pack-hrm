'use client';

import { getStoredToken } from './authToken';

export type EntityActionResult = {
  title?: string;
  message?: string;
  variant?: 'success' | 'error' | 'warning' | 'info';
  refresh?: boolean;
};

export type EntityActionHandlerArgs = {
  entityKey: string;
  refetch?: () => Promise<any> | void;
};

export type EntityActionHandler = (
  args: EntityActionHandlerArgs
) => void | EntityActionResult | Promise<void | EntityActionResult>;

function getHrmHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function hrmFetch(path: string, init: RequestInit) {
  const res = await fetch(`/api/hrm${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getHrmHeaders(),
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.detail || body?.message || body?.error || `Request failed (${res.status})`;
    throw new Error(String(msg));
  }

  if (res.status === 204 || res.status === 205 || res.status === 304) return null;
  const textLen = res.headers.get('content-length');
  if (textLen === '0') return null;
  return res.json().catch(() => null);
}

const handlers: Record<string, EntityActionHandler | undefined> = {
  'hrm.employees.sync': async () => {
    const result = await hrmFetch('/employees/sync', { method: 'POST' });
    const ensured = Number(result?.ensured || 0);
    const reactivated = Number(result?.reactivated || 0);
    const deactivated = Number(result?.deactivated || 0);
    return {
      title: 'Employees synced',
      message: `Ensured ${ensured}, reactivated ${reactivated}, deactivated ${deactivated}.`,
      variant: 'success',
      refresh: true,
    };
  },
};

export function getEntityActionHandler(handlerId: string): EntityActionHandler | undefined {
  return handlers[handlerId];
}
