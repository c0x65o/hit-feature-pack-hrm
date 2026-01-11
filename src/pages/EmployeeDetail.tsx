'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Shield,
  User,
  Users,
  Clock,
  Camera,
  Mail,
  Calendar,
  Upload,
  Edit2,
  Save,
  X,
} from 'lucide-react';
import type { BreadcrumbItem } from '@hit/ui-kit';
import { useUi } from '@hit/ui-kit';
import { UserAvatar } from '@hit/ui-kit/components/UserAvatar';
import { Box } from '@hit/ui-kit/components/Box';
import { Row } from '@hit/ui-kit/components/Row';
import { Stack } from '@hit/ui-kit/components/Stack';
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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuthUser {
  email: string;
  role?: string;
  roles?: string[];
  last_login?: string | null;
  created_at?: string;
  profile_picture_url?: string | null;
  profile_fields?: Record<string, unknown> | null;
}

interface UserGroup {
  id: string;
  name: string;
  description?: string | null;
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

export function EmployeeDetail({ id, onNavigate }: EmployeeDetailProps) {
  const { Page, Card, Button, Badge, Spinner, Alert, Input, Modal } = useUi();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [effectivePerms, setEffectivePerms] = useState<EffectivePermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [saving, setSaving] = useState(false);

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
      const authRes = await fetch(`/api/proxy/auth/admin/users/${encodeURIComponent(emp.userEmail)}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (authRes.ok) {
        const user = await authRes.json();
        setAuthUser(user);
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

  const openEdit = () => {
    if (!employee) return;
    setFirstName(employee.firstName || '');
    setLastName(employee.lastName || '');
    setPreferredName(employee.preferredName || '');
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!employee) return;
    try {
      setSaving(true);
      setError(null);
      const token = getStoredToken();
      if (!token) throw new Error('You must be signed in.');

      const res = await fetch(`/api/hrm/employees/${encodeURIComponent(employee.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({
          firstName,
          lastName,
          preferredName: preferredName || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.detail || 'Failed to update employee');

      setEditOpen(false);
      await fetchData();
    } catch (e: any) {
      setError(e?.message || 'Failed to update employee');
    } finally {
      setSaving(false);
    }
  };

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

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'HRM', href: '/hrm/employees', icon: <Users size={14} /> },
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
          <Button variant="primary" onClick={openEdit}>
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
              {employee.isActive ? (
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
                groups.map((g) => (
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
              <Text size="base">{formatRelativeTime(authUser?.last_login)}</Text>
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
            <Text size="base">{formatDate(authUser?.created_at)}</Text>
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

      {/* Edit Modal */}
      {editOpen && (
        <Modal open={true} onClose={() => setEditOpen(false)} title="Edit Employee">
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label="Email" value={employee.userEmail} disabled />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input
                label="First Name"
                value={firstName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
              />
              <Input
                label="Last Name"
                value={lastName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
              />
            </div>
            <Input
              label="Preferred Name (optional)"
              value={preferredName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPreferredName(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button variant="secondary" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Page>
  );
}

export default EmployeeDetail;
