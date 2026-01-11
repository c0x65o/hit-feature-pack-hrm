'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Save, Users, User, Edit2 } from 'lucide-react';
import type { BreadcrumbItem } from '@hit/ui-kit';
import { useUi } from '@hit/ui-kit';

interface EmployeeEditProps {
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

export function EmployeeEdit({ id, onNavigate }: EmployeeEditProps) {
  const { Page, Card, Button, Input, Alert, Spinner, Badge } = useUi();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [phone, setPhone] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  const fetchEmployee = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getStoredToken();
      if (!token) throw new Error('You must be signed in.');

      const res = await fetch(`/api/hrm/employees/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.detail || 'Failed to load employee');

      const emp: Employee = json;
      setEmployee(emp);
      setFirstName(emp.firstName || '');
      setLastName(emp.lastName || '');
      setPreferredName(emp.preferredName || '');
      setPhone(emp.phone || '');
      setAddress1(emp.address1 || '');
      setAddress2(emp.address2 || '');
      setCity(emp.city || '');
      setState(emp.state || '');
      setPostalCode(emp.postalCode || '');
      setCountry(emp.country || '');
    } catch (e: any) {
      setError(e?.message || 'Failed to load employee');
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);

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
          phone: phone || null,
          address1: address1 || null,
          address2: address2 || null,
          city: city || null,
          state: state || null,
          postalCode: postalCode || null,
          country: country || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.detail || 'Failed to update employee');

      navigate(`/hrm/employees/${encodeURIComponent(employee.id)}`);
    } catch (e: any) {
      setError(e?.message || 'Failed to update employee');
    } finally {
      setSaving(false);
    }
  };

  const title = employee
    ? employee.preferredName?.trim() || `${employee.firstName} ${employee.lastName}`.trim() || employee.userEmail
    : 'Edit Employee';

  const breadcrumbs: BreadcrumbItem[] = useMemo(() => {
    const empLabel = employee
      ? employee.preferredName?.trim() || `${employee.firstName} ${employee.lastName}`.trim() || employee.userEmail
      : 'Employee';
    return [
      { label: 'HRM', icon: <Users size={14} /> },
      { label: 'Employees', href: '/hrm/employees', icon: <User size={14} /> },
      { label: empLabel, href: `/hrm/employees/${encodeURIComponent(id)}` },
      { label: 'Edit' },
    ];
  }, [employee, id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner />
      </div>
    );
  }

  if (!employee) {
    return (
      <Alert variant="error" title="Not Found">
        {error || "Employee doesn't exist."}
      </Alert>
    );
  }

  const isActive = employee.isActive !== false;

  return (
    <Page
      title={title}
      breadcrumbs={breadcrumbs}
      onNavigate={navigate}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => navigate(`/hrm/employees/${encodeURIComponent(employee.id)}`)}>
            <ArrowLeft size={16} style={{ marginRight: 4 }} />
            Back
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            <Save size={16} style={{ marginRight: 4 }} />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      }
    >
      {error ? (
        <Alert variant="error" title="Error" style={{ marginBottom: 16 }}>
          {error}
        </Alert>
      ) : null}

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Edit2 size={18} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>Employee</div>
            <div style={{ opacity: 0.75, fontSize: '0.9em' }}>{employee.userEmail}</div>
          </div>
          <Badge variant={isActive ? 'success' : 'default'}>{isActive ? 'Active' : 'Inactive'}</Badge>
        </div>

        <Input label="User email" value={employee.userEmail} disabled />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <Input label="First name" value={firstName} onChange={setFirstName} />
          <Input label="Last name" value={lastName} onChange={setLastName} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Input
            label="Preferred name (optional)"
            value={preferredName}
            onChange={setPreferredName}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <Input
            label="Phone (optional)"
            value={phone}
            onChange={setPhone}
          />
        </div>

        <div style={{ marginTop: 24, marginBottom: 8, fontWeight: 600, opacity: 0.8 }}>Address</div>
        <Input
          label="Address line 1"
          value={address1}
          onChange={setAddress1}
        />
        <div style={{ marginTop: 12 }}>
          <Input
            label="Address line 2 (optional)"
            value={address2}
            onChange={setAddress2}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginTop: 12 }}>
          <Input label="City" value={city} onChange={setCity} />
          <Input label="State" value={state} onChange={setState} />
          <Input label="Postal code" value={postalCode} onChange={setPostalCode} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Input label="Country" value={country} onChange={setCountry} />
        </div>
      </Card>

      {/* Future sections: photo, role changes, groups, LDD, PTO setup, etc. (do not add yet) */}
    </Page>
  );
}

export default EmployeeEdit;
