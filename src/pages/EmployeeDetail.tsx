'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Shield,
  User,
  Users,
  Clock,
  Mail,
  Calendar,
  Edit2,
} from 'lucide-react';
import type { BreadcrumbItem } from '@hit/ui-kit';
import { useUi } from '@hit/ui-kit';
import { UserAvatar } from '@hit/ui-kit/components/UserAvatar';
import { Text } from '@hit/ui-kit/components/Text';

interface EmployeeDetailProps {
  id: string;
  onNavigate?: (path: string) => void;
}

interface Employee {
  id: string;
  userEmail: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuthUser {
  email: string;
  role?: string;
  roles?: string[];
  last_login?: string | null;
  created_at?: string;
  createdAt?: string;
  lastLogin?: string | null;
  profile_picture_url?: string | null;
  profile_fields?: Record<string, unknown> | null;
}

interface EffectivePermissions {
  user_email: string;
  role: string;
  is_admin: boolean;
  groups: Array<{ id: string; name: string; description: string | null }>;
}

function getStoredToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((cookie) => cookie.startsWith('hit_token='));
  if (match) return decodeURIComponent(match.split('=').slice(1).join('='));
  if (typeof localStorage !== 'undefined') return localStorage.getItem('hit_token');
  return null;
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Unknown';
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Unknown';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Unknown';
  }
}

function normalizeAuthUser(raw: any): AuthUser | null {
  if (!raw) return null;
  const u = raw?.user && typeof raw.user === 'object' ? raw.user : raw;
  const email = String(u?.email || '').trim();
  if (!email) return null;

  const createdAt = String(u?.created_at || u?.createdAt || '').trim() || undefined;
  const lastLoginRaw =
    u?.last_login === null || u?.last_login === undefined
      ? u?.lastLogin
      : u?.last_login;
  const lastLogin = lastLoginRaw === null || lastLoginRaw === undefined ? null : String(lastLoginRaw).trim() || null;

  return {
    ...u,
    email,
    created_at: createdAt,
    createdAt,
    last_login: lastLogin,
    lastLogin,
  } as AuthUser;
}

function mostRecentIso(dates: Array<string | null | undefined>): string | null {
  let best: number | null = null;
  for (const d of dates) {
    if (!d) continue;
    const t = new Date(d).getTime();
    if (!Number.isFinite(t)) continue;
    if (best === null || t > best) best = t;
  }
  return best === null ? null : new Date(best).toISOString();
}

export function EmployeeDetail({ id, onNavigate }: EmployeeDetailProps) {
  const { Page, Card, Button, Badge, Spinner, Alert } = useUi();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [effectivePerms, setEffectivePerms] = useState<EffectivePermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getStoredToken();
      if (!token) throw new Error('You must be signed in.');

      // Fetch employee
      const empRes = await fetch(`/api/hrm/employees/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (!empRes.ok) {
        const json = await empRes.json().catch(() => ({}));
        throw new Error(json?.error || json?.detail || 'Failed to load employee');
      }
      const emp: Employee = await empRes.json();
      setEmployee(emp);

      // Fetch auth user info
      const authRes = await fetch(`/api/proxy/auth/users/${encodeURIComponent(emp.userEmail)}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (authRes.ok) {
        const userRaw = await authRes.json().catch(() => null);
        const normalized = normalizeAuthUser(userRaw);
        setAuthUser(normalized);

        // Fallback: if auth doesn't provide last_login, infer from sessions.
        const lastLoginCandidate = String((normalized as any)?.last_login || (normalized as any)?.lastLogin || '').trim();
        if (!lastLoginCandidate) {
          const sessionsRes = await fetch(
            `/api/proxy/auth/admin/users/${encodeURIComponent(emp.userEmail)}/sessions?limit=20&offset=0`,
            {
              headers: { Authorization: `Bearer ${token}` },
              credentials: 'include',
            }
          );
          if (sessionsRes.ok) {
            const s = await sessionsRes.json().catch(() => null);
            const sessions = Array.isArray(s?.sessions) ? s.sessions : Array.isArray(s) ? s : [];
            const inferred = mostRecentIso(
              sessions.map((x: any) =>
                String(x?.created_at || x?.createdAt || x?.createdOnTimestamp || x?.created_on || '').trim() || null
              )
            );
            if (inferred) {
              setAuthUser((prev: AuthUser | null) => (prev ? { ...prev, last_login: inferred } : prev));
            }
          }
        }
      }

      // Fetch effective permissions (includes groups, role)
      const permsRes = await fetch(
        `/api/proxy/auth/admin/permissions/users/${encodeURIComponent(emp.userEmail)}/effective`,
        {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }
      );
      if (permsRes.ok) {
        const perms = await permsRes.json();
        setEffectivePerms(perms);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load employee');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner />
      </div>
    );
  }

  if (error && !employee) {
    return (
      <Alert variant="error" title="Error">
        {error}
      </Alert>
    );
  }

  if (!employee) {
    return (
      <Alert variant="error" title="Not Found">
        Employee not found.
      </Alert>
    );
  }

  const displayName = employee.preferredName?.trim() || `${employee.firstName} ${employee.lastName}`.trim();
  const roleName = effectivePerms?.role || authUser?.role || (authUser?.roles?.[0]) || 'user';
  const groups = effectivePerms?.groups || [];
  const isActive = employee.isActive !== false;
  const authCreatedAt = String((authUser as any)?.created_at || (authUser as any)?.createdAt || '').trim() || null;
  const authLastLogin = String((authUser as any)?.last_login || (authUser as any)?.lastLogin || '').trim() || null;

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'HRM', icon: <Users size={14} /> },
    { label: 'Employees', href: '/hrm/employees', icon: <User size={14} /> },
    { label: displayName },
  ];

  return (
    <Page
      title={displayName}
      breadcrumbs={breadcrumbs}
      onNavigate={navigate}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => navigate('/hrm/employees')}>
            <ArrowLeft size={16} style={{ marginRight: 4 }} />
            Back
          </Button>
          <Button variant="primary" onClick={() => navigate(`/hrm/employees/${encodeURIComponent(employee.id)}/edit`)}>
            <Edit2 size={16} style={{ marginRight: 4 }} />
            Edit
          </Button>
        </div>
      }
    >
      {error && (
        <Alert variant="error" title="Error" style={{ marginBottom: 16 }}>
          {error}
        </Alert>
      )}

      {/* Profile Header Card */}
      <Card>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          {/* Avatar Section */}
          <div style={{ position: 'relative' }}>
            <UserAvatar
              email={employee.userEmail}
              name={displayName}
              src={authUser?.profile_picture_url || undefined}
              size="lg"
            />
            {/* Future: camera icon overlay for photo edit */}
          </div>

          {/* Basic Info */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Text size="2xl" weight="bold">{displayName}</Text>
              {isActive ? (
                <Badge variant="success">Active</Badge>
              ) : (
                <Badge variant="default">Inactive</Badge>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, opacity: 0.8 }}>
              <Mail size={14} />
              <Text size="base">{employee.userEmail}</Text>
            </div>

            <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
              <div>
                <Text size="sm" color="secondary">First Name</Text>
                <Text size="base" weight="medium">{employee.firstName}</Text>
              </div>
              <div>
                <Text size="sm" color="secondary">Last Name</Text>
                <Text size="base" weight="medium">{employee.lastName}</Text>
              </div>
              {employee.preferredName && (
                <div>
                  <Text size="sm" color="secondary">Preferred Name</Text>
                  <Text size="base" weight="medium">{employee.preferredName}</Text>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Access & Security Card */}
      <Card style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Shield size={18} />
          <Text size="lg" weight="semibold">Access & Security</Text>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
          <div>
            <Text size="sm" color="secondary">Role</Text>
            <div style={{ marginTop: 4 }}>
              <Badge variant={roleName === 'admin' ? 'warning' : 'default'}>
                {roleName}
              </Badge>
            </div>
          </div>

          <div>
            <Text size="sm" color="secondary">Security Groups</Text>
            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {groups.length > 0 ? (
                groups.map((g: { id: string; name: string; description: string | null }) => (
                  <Badge key={g.id} variant="default">{g.name}</Badge>
                ))
              ) : (
                <Text size="sm" color="secondary" style={{ fontStyle: 'italic' }}>No groups</Text>
              )}
            </div>
          </div>

          <div>
            <Text size="sm" color="secondary">Last Login</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Clock size={14} style={{ opacity: 0.6 }} />
              <Text size="base">{formatRelativeTime(authLastLogin)}</Text>
            </div>
          </div>

          <div>
            <Text size="sm" color="secondary">Is Admin</Text>
            <div style={{ marginTop: 4 }}>
              {effectivePerms?.is_admin ? (
                <Badge variant="warning">Yes</Badge>
              ) : (
                <Badge variant="default">No</Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Timestamps Card */}
      <Card style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Calendar size={18} />
          <Text size="lg" weight="semibold">Timeline</Text>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
          <div>
            <Text size="sm" color="secondary">Auth Account Created</Text>
            <Text size="base">{formatDate(authCreatedAt)}</Text>
          </div>
          <div>
            <Text size="sm" color="secondary">HRM Record Created</Text>
            <Text size="base">{formatDate(employee.createdAt)}</Text>
          </div>
          <div>
            <Text size="sm" color="secondary">HRM Record Updated</Text>
            <Text size="base">{formatDate(employee.updatedAt)}</Text>
          </div>
        </div>
      </Card>

      {/* Placeholder for future PTO/Vacation - DO NOT IMPLEMENT YET */}
      {/* 
      <Card style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Umbrella size={18} />
          <Text size="lg" weight="semibold">Time Off</Text>
        </div>
        <Text size="sm" color="secondary">PTO tracking coming soon...</Text>
      </Card>
      */}

    </Page>
  );
}

export default EmployeeDetail;
