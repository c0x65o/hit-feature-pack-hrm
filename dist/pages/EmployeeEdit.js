'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Save, Users, User, Edit2 } from 'lucide-react';
import { useUi } from '@hit/ui-kit';
function getStoredToken() {
    if (typeof document === 'undefined')
        return null;
    const match = document.cookie
        .split(';')
        .map((c) => c.trim())
        .find((cookie) => cookie.startsWith('hit_token='));
    if (match)
        return decodeURIComponent(match.split('=').slice(1).join('='));
    if (typeof localStorage !== 'undefined')
        return localStorage.getItem('hit_token');
    return null;
}
export function EmployeeEdit({ id, onNavigate }) {
    const { Page, Card, Button, Input, Alert, Spinner, Badge } = useUi();
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [preferredName, setPreferredName] = useState('');
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    const fetchEmployee = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const token = getStoredToken();
            if (!token)
                throw new Error('You must be signed in.');
            const res = await fetch(`/api/hrm/employees/${encodeURIComponent(id)}`, {
                headers: { Authorization: `Bearer ${token}` },
                credentials: 'include',
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(json?.error || json?.detail || 'Failed to load employee');
            const emp = json;
            setEmployee(emp);
            setFirstName(emp.firstName || '');
            setLastName(emp.lastName || '');
            setPreferredName(emp.preferredName || '');
        }
        catch (e) {
            setError(e?.message || 'Failed to load employee');
            setEmployee(null);
        }
        finally {
            setLoading(false);
        }
    }, [id]);
    useEffect(() => {
        fetchEmployee();
    }, [fetchEmployee]);
    const handleSave = async () => {
        if (!employee)
            return;
        try {
            setSaving(true);
            setError(null);
            const token = getStoredToken();
            if (!token)
                throw new Error('You must be signed in.');
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
            if (!res.ok)
                throw new Error(json?.error || json?.detail || 'Failed to update employee');
            navigate(`/hrm/employees/${encodeURIComponent(employee.id)}`);
        }
        catch (e) {
            setError(e?.message || 'Failed to update employee');
        }
        finally {
            setSaving(false);
        }
    };
    const title = employee
        ? employee.preferredName?.trim() || `${employee.firstName} ${employee.lastName}`.trim() || employee.userEmail
        : 'Edit Employee';
    const breadcrumbs = useMemo(() => {
        const empLabel = employee
            ? employee.preferredName?.trim() || `${employee.firstName} ${employee.lastName}`.trim() || employee.userEmail
            : 'Employee';
        return [
            { label: 'HRM', icon: _jsx(Users, { size: 14 }) },
            { label: 'Employees', href: '/hrm/employees', icon: _jsx(User, { size: 14 }) },
            { label: empLabel, href: `/hrm/employees/${encodeURIComponent(id)}` },
            { label: 'Edit' },
        ];
    }, [employee, id]);
    if (loading) {
        return (_jsx("div", { style: { display: 'flex', justifyContent: 'center', padding: 48 }, children: _jsx(Spinner, {}) }));
    }
    if (!employee) {
        return (_jsx(Alert, { variant: "error", title: "Not Found", children: error || "Employee doesn't exist." }));
    }
    const isActive = employee.isActive !== false;
    return (_jsxs(Page, { title: title, breadcrumbs: breadcrumbs, onNavigate: navigate, actions: _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsxs(Button, { variant: "secondary", onClick: () => navigate(`/hrm/employees/${encodeURIComponent(employee.id)}`), children: [_jsx(ArrowLeft, { size: 16, style: { marginRight: 4 } }), "Back"] }), _jsxs(Button, { variant: "primary", onClick: handleSave, disabled: saving, children: [_jsx(Save, { size: 16, style: { marginRight: 4 } }), saving ? 'Saving…' : 'Save'] })] }), children: [error ? (_jsx(Alert, { variant: "error", title: "Error", style: { marginBottom: 16 }, children: error })) : null, _jsxs(Card, { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }, children: [_jsx(Edit2, { size: 18 }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontWeight: 600 }, children: "Employee" }), _jsx("div", { style: { opacity: 0.75, fontSize: '0.9em' }, children: employee.userEmail })] }), _jsx(Badge, { variant: isActive ? 'success' : 'default', children: isActive ? 'Active' : 'Inactive' })] }), _jsx(Input, { label: "User email", value: employee.userEmail, disabled: true }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }, children: [_jsx(Input, { label: "First name", value: firstName, onChange: (e) => setFirstName(e.target.value) }), _jsx(Input, { label: "Last name", value: lastName, onChange: (e) => setLastName(e.target.value) })] }), _jsx("div", { style: { marginTop: 12 }, children: _jsx(Input, { label: "Preferred name (optional)", value: preferredName, onChange: (e) => setPreferredName(e.target.value) }) })] })] }));
}
export default EmployeeEdit;
