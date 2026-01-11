'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  Shield,
  User,
  Users,
  Clock,
  Mail,
  Calendar,
  Edit2,
  Phone,
  MapPin,
  Camera,
  Trash2,
  Download,
  Building2,
  Briefcase,
  MapPinned,
} from 'lucide-react';
import { downloadVCard } from '../utils/vcard';
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
  phone: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
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

interface OrgAssignment {
  id: string;
  userKey: string;
  divisionId: string | null;
  departmentId: string | null;
  locationId: string | null;
  division?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  location?: { id: string; name: string } | null;
}

interface OrgOption {
  id: string;
  name: string;
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
  
  // LDD (Location/Division/Department) state
  const [orgAssignment, setOrgAssignment] = useState<OrgAssignment | null>(null);
  const [divisions, setDivisions] = useState<OrgOption[]>([]);
  const [departments, setDepartments] = useState<OrgOption[]>([]);
  const [orgLocations, setOrgLocations] = useState<OrgOption[]>([]);
  const [editingLdd, setEditingLdd] = useState(false);
  const [savingLdd, setSavingLdd] = useState(false);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  
  // Photo upload state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };
  
  // Handle photo file selection
  const handlePhotoSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !employee) return;
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select an image file');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image must be less than 5MB');
      return;
    }
    
    try {
      setUploadingPhoto(true);
      setPhotoError(null);
      
      // Convert to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;
      
      // Upload via API
      const token = getStoredToken();
      if (!token) throw new Error('You must be signed in');
      
      const response = await fetch(`/api/hrm/employees/${encodeURIComponent(employee.id)}/photo`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profile_picture_url: base64Data }),
      });
      
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.detail || 'Failed to upload photo');
      }
      
      // Update local state
      setProfilePictureUrl(data.profile_picture_url || base64Data);
      setAuthUser((prev: AuthUser | null) => prev ? { ...prev, profile_picture_url: data.profile_picture_url || base64Data } : prev);
    } catch (e: any) {
      setPhotoError(e?.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  }, [employee]);
  
  // Handle photo deletion
  const handlePhotoDelete = useCallback(async () => {
    if (!employee) return;
    
    try {
      setUploadingPhoto(true);
      setPhotoError(null);
      
      const token = getStoredToken();
      if (!token) throw new Error('You must be signed in');
      
      const response = await fetch(`/api/hrm/employees/${encodeURIComponent(employee.id)}/photo`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profile_picture_url: null }),
      });
      
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.detail || 'Failed to remove photo');
      }
      
      setProfilePictureUrl(null);
      setAuthUser((prev: AuthUser | null) => prev ? { ...prev, profile_picture_url: null } : prev);
    } catch (e: any) {
      setPhotoError(e?.message || 'Failed to remove photo');
    } finally {
      setUploadingPhoto(false);
    }
  }, [employee]);

  // Handle vCard download
  const handleDownloadVCard = useCallback(() => {
    if (!employee) return;
    
    const displayName = employee.preferredName?.trim() 
      || `${employee.firstName} ${employee.lastName}`.trim();
    
    downloadVCard({
      firstName: employee.firstName,
      lastName: employee.lastName,
      fullName: displayName,
      email: employee.userEmail,
      phone: employee.phone,
      address1: employee.address1,
      address2: employee.address2,
      city: employee.city,
      state: employee.state,
      postalCode: employee.postalCode,
      country: employee.country,
      photoUrl: profilePictureUrl || authUser?.profile_picture_url,
    }, `${displayName.replace(/\s+/g, '_')}.vcf`);
  }, [employee, profilePictureUrl, authUser?.profile_picture_url]);

  // Handle LDD save
  const handleSaveLdd = useCallback(async () => {
    if (!employee) return;
    
    // Must have at least one selection
    if (!selectedDivisionId && !selectedDepartmentId && !selectedLocationId) {
      setEditingLdd(false);
      return;
    }
    
    try {
      setSavingLdd(true);
      const token = getStoredToken();
      if (!token) throw new Error('You must be signed in');
      
      const body = {
        userKey: employee.userEmail,
        divisionId: selectedDivisionId || null,
        departmentId: selectedDepartmentId || null,
        locationId: selectedLocationId || null,
      };
      
      let response: Response;
      if (orgAssignment?.id) {
        // Update existing
        response = await fetch(`/api/org/assignments/${orgAssignment.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
      } else {
        // Create new
        response = await fetch('/api/org/assignments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
      }
      
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.detail || 'Failed to save organization assignment');
      }
      
      // Update local state
      setOrgAssignment({
        id: data.id || orgAssignment?.id || '',
        userKey: employee.userEmail,
        divisionId: selectedDivisionId || null,
        departmentId: selectedDepartmentId || null,
        locationId: selectedLocationId || null,
        division: divisions.find(d => d.id === selectedDivisionId) || null,
        department: departments.find(d => d.id === selectedDepartmentId) || null,
        location: orgLocations.find(d => d.id === selectedLocationId) || null,
      });
      setEditingLdd(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to save LDD');
    } finally {
      setSavingLdd(false);
    }
  }, [employee, orgAssignment, selectedDivisionId, selectedDepartmentId, selectedLocationId, divisions, departments, orgLocations]);

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

      // Fetch org assignment (LDD)
      const assignmentRes = await fetch(
        `/api/org/assignments?userKey=${encodeURIComponent(emp.userEmail)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }
      );
      if (assignmentRes.ok) {
        const assignmentData = await assignmentRes.json();
        const items = assignmentData?.items || [];
        if (items.length > 0) {
          const assignment = items[0];
          setOrgAssignment(assignment);
          setSelectedDivisionId(assignment.divisionId || '');
          setSelectedDepartmentId(assignment.departmentId || '');
          setSelectedLocationId(assignment.locationId || '');
        }
      }

      // Fetch org options for editing
      const [divisionsRes, departmentsRes, locationsRes] = await Promise.all([
        fetch('/api/org/divisions', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' }),
        fetch('/api/org/departments', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' }),
        fetch('/api/org/locations', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' }),
      ]);
      
      if (divisionsRes.ok) {
        const data = await divisionsRes.json();
        setDivisions((data?.items || data || []).filter((d: OrgOption & { isActive?: boolean }) => d?.isActive !== false));
      }
      if (departmentsRes.ok) {
        const data = await departmentsRes.json();
        setDepartments((data?.items || data || []).filter((d: OrgOption & { isActive?: boolean }) => d?.isActive !== false));
      }
      if (locationsRes.ok) {
        const data = await locationsRes.json();
        setOrgLocations((data?.items || data || []).filter((d: OrgOption & { isActive?: boolean }) => d?.isActive !== false));
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
          <Button variant="secondary" onClick={handleDownloadVCard}>
            <Download size={16} style={{ marginRight: 4 }} />
            vCard
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

      {/* Photo upload error */}
      {photoError && (
        <Alert variant="error" title="Photo Error" style={{ marginBottom: 16 }}>
          {photoError}
        </Alert>
      )}

      {/* Profile Header Card */}
      <Card>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          {/* Avatar Section with Photo Upload */}
          <div style={{ position: 'relative' }}>
            <UserAvatar
              email={employee.userEmail}
              name={displayName}
              src={profilePictureUrl || authUser?.profile_picture_url || undefined}
              size="lg"
            />
            
            {/* Photo upload overlay */}
            <div 
              style={{ 
                position: 'absolute', 
                bottom: 0, 
                right: 0, 
                display: 'flex', 
                gap: 4,
              }}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: 'var(--color-primary, #3b82f6)',
                  color: 'white',
                  cursor: uploadingPhoto ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
                title="Upload photo"
              >
                {uploadingPhoto ? (
                  <div style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Camera size={14} />
                )}
              </button>
              
              {(profilePictureUrl || authUser?.profile_picture_url) && (
                <button
                  type="button"
                  onClick={handlePhotoDelete}
                  disabled={uploadingPhoto}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: 'var(--color-error, #ef4444)',
                    color: 'white',
                    cursor: uploadingPhoto ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                  title="Remove photo"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              style={{ display: 'none' }}
            />
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4, opacity: 0.8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={14} />
                <Text size="base">{employee.userEmail}</Text>
              </div>
              {employee.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Phone size={14} />
                  <Text size="base">{employee.phone}</Text>
                </div>
              )}
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

      {/* Contact Information Card */}
      {(employee.phone || employee.address1 || employee.city) && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <MapPin size={18} />
            <Text size="lg" weight="semibold">Contact Information</Text>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
            {employee.phone && (
              <div>
                <Text size="sm" color="secondary">Phone</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Phone size={14} style={{ opacity: 0.6 }} />
                  <Text size="base">{employee.phone}</Text>
                </div>
              </div>
            )}

            {(employee.address1 || employee.city) && (
              <div>
                <Text size="sm" color="secondary">Address</Text>
                <div style={{ marginTop: 4 }}>
                  {employee.address1 && <Text size="base">{employee.address1}</Text>}
                  {employee.address2 && <Text size="base">{employee.address2}</Text>}
                  {(employee.city || employee.state || employee.postalCode) && (
                    <Text size="base">
                      {[employee.city, employee.state].filter(Boolean).join(', ')}
                      {employee.postalCode && ` ${employee.postalCode}`}
                    </Text>
                  )}
                  {employee.country && <Text size="base">{employee.country}</Text>}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Organization (LDD) Card */}
      <Card style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={18} />
            <Text size="lg" weight="semibold">Organization</Text>
          </div>
          {!editingLdd ? (
            <Button variant="secondary" size="sm" onClick={() => setEditingLdd(true)}>
              <Edit2 size={14} style={{ marginRight: 4 }} />
              Edit
            </Button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" size="sm" onClick={() => {
                setEditingLdd(false);
                setSelectedDivisionId(orgAssignment?.divisionId || '');
                setSelectedDepartmentId(orgAssignment?.departmentId || '');
                setSelectedLocationId(orgAssignment?.locationId || '');
              }}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveLdd} disabled={savingLdd}>
                {savingLdd ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )}
        </div>

        {editingLdd ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div>
              <Text size="sm" color="secondary" style={{ marginBottom: 4 }}>Division</Text>
              <select
                value={selectedDivisionId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedDivisionId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--color-border, #374151)',
                  backgroundColor: 'var(--color-bg-input, #1f2937)',
                  color: 'inherit',
                  fontSize: '14px',
                }}
              >
                <option value="">-- None --</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Text size="sm" color="secondary" style={{ marginBottom: 4 }}>Department</Text>
              <select
                value={selectedDepartmentId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedDepartmentId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--color-border, #374151)',
                  backgroundColor: 'var(--color-bg-input, #1f2937)',
                  color: 'inherit',
                  fontSize: '14px',
                }}
              >
                <option value="">-- None --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Text size="sm" color="secondary" style={{ marginBottom: 4 }}>Location</Text>
              <select
                value={selectedLocationId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedLocationId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--color-border, #374151)',
                  backgroundColor: 'var(--color-bg-input, #1f2937)',
                  color: 'inherit',
                  fontSize: '14px',
                }}
              >
                <option value="">-- None --</option>
                {orgLocations.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
            <div>
              <Text size="sm" color="secondary">Division</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Briefcase size={14} style={{ opacity: 0.6 }} />
                <Text size="base">
                  {orgAssignment?.division?.name || divisions.find(d => d.id === orgAssignment?.divisionId)?.name || '—'}
                </Text>
              </div>
            </div>
            <div>
              <Text size="sm" color="secondary">Department</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Users size={14} style={{ opacity: 0.6 }} />
                <Text size="base">
                  {orgAssignment?.department?.name || departments.find(d => d.id === orgAssignment?.departmentId)?.name || '—'}
                </Text>
              </div>
            </div>
            <div>
              <Text size="sm" color="secondary">Location</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <MapPinned size={14} style={{ opacity: 0.6 }} />
                <Text size="base">
                  {orgAssignment?.location?.name || orgLocations.find(d => d.id === orgAssignment?.locationId)?.name || '—'}
                </Text>
              </div>
            </div>
          </div>
        )}
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
