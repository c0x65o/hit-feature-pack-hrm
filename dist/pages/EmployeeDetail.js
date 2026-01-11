'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Shield, User, Users, Clock, Mail, Calendar, Edit2, } from 'lucide-react';
import { useUi } from '@hit/ui-kit';
import { UserAvatar } from '@hit/ui-kit/components/UserAvatar';
import { Text } from '@hit/ui-kit/components/Text';
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
function formatRelativeTime(dateStr) {
    if (!dateStr)
        return 'Never';
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1)
            return 'Just now';
        if (diffMins < 60)
            return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        if (diffHours < 24)
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        if (diffDays < 7)
            return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    catch {
        return 'Unknown';
    }
}
function formatDate(dateStr) {
    if (!dateStr)
        return 'Unknown';
    try {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    }
    catch {
        return 'Unknown';
    }
}
export function EmployeeDetail({ id, onNavigate }) {
    const { Page, Card, Button, Badge, Spinner, Alert, Input, Modal } = useUi();
    const [employee, setEmployee] = useState(null);
    const [authUser, setAuthUser] = useState(null);
    const [effectivePerms, setEffectivePerms] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Edit state
    const [editOpen, setEditOpen] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [preferredName, setPreferredName] = useState('');
    const [saving, setSaving] = useState(false);
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const token = getStoredToken();
            if (!token)
                throw new Error('You must be signed in.');
            // Fetch employee
            const empRes = await fetch(`/api/hrm/employees/${encodeURIComponent(id)}`, {
                headers: { Authorization: `Bearer ${token}` },
                credentials: 'include',
            });
            if (!empRes.ok) {
                const json = await empRes.json().catch(() => ({}));
                throw new Error(json?.error || json?.detail || 'Failed to load employee');
            }
            const emp = await empRes.json();
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
            const permsRes = await fetch(`/api/proxy/auth/admin/permissions/users/${encodeURIComponent(emp.userEmail)}/effective`, {
                headers: { Authorization: `Bearer ${token}` },
                credentials: 'include',
            });
            if (permsRes.ok) {
                const perms = await permsRes.json();
                setEffectivePerms(perms);
            }
        }
        catch (e) {
            setError(e?.message || 'Failed to load employee');
        }
        finally {
            setLoading(false);
        }
    }, [id]);
    useEffect(() => {
        fetchData();
    }, [fetchData]);
    const openEdit = () => {
        if (!employee)
            return;
        setFirstName(employee.firstName || '');
        setLastName(employee.lastName || '');
        setPreferredName(employee.preferredName || '');
        setEditOpen(true);
    };
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
            setEditOpen(false);
            await fetchData();
        }
        catch (e) {
            setError(e?.message || 'Failed to update employee');
        }
        finally {
            setSaving(false);
        }
    };
    if (loading) {
        return (_jsx("div", { style: { display: 'flex', justifyContent: 'center', padding: 48 }, children: _jsx(Spinner, {}) }));
    }
    if (error && !employee) {
        return (_jsx(Alert, { variant: "error", title: "Error", children: error }));
    }
    if (!employee) {
        return (_jsx(Alert, { variant: "error", title: "Not Found", children: "Employee not found." }));
    }
    const displayName = employee.preferredName?.trim() || `${employee.firstName} ${employee.lastName}`.trim();
    const roleName = effectivePerms?.role || authUser?.role || (authUser?.roles?.[0]) || 'user';
    const groups = effectivePerms?.groups || [];
    const breadcrumbs = [
        { label: 'HRM', href: '/hrm/employees', icon: _jsx(Users, { size: 14 }) },
        { label: 'Employees', href: '/hrm/employees', icon: _jsx(User, { size: 14 }) },
        { label: displayName },
    ];
    return (_jsxs(Page, { title: displayName, breadcrumbs: breadcrumbs, onNavigate: navigate, actions: _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsxs(Button, { variant: "secondary", onClick: () => navigate('/hrm/employees'), children: [_jsx(ArrowLeft, { size: 16, style: { marginRight: 4 } }), "Back"] }), _jsxs(Button, { variant: "primary", onClick: openEdit, children: [_jsx(Edit2, { size: 16, style: { marginRight: 4 } }), "Edit"] })] }), children: [error && (_jsx(Alert, { variant: "error", title: "Error", style: { marginBottom: 16 }, children: error })), _jsx(Card, { children: _jsxs("div", { style: { display: 'flex', gap: 24, alignItems: 'flex-start' }, children: [_jsx("div", { style: { position: 'relative' }, children: _jsx(UserAvatar, { email: employee.userEmail, name: displayName, src: authUser?.profile_picture_url || undefined, size: "lg" }) }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }, children: [_jsx(Text, { size: "2xl", weight: "bold", children: displayName }), employee.isActive ? (_jsx(Badge, { variant: "success", children: "Active" })) : (_jsx(Badge, { variant: "default", children: "Inactive" }))] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, opacity: 0.8 }, children: [_jsx(Mail, { size: 14 }), _jsx(Text, { size: "base", children: employee.userEmail })] }), _jsxs("div", { style: { display: 'flex', gap: 24, marginTop: 16 }, children: [_jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "First Name" }), _jsx(Text, { size: "base", weight: "medium", children: employee.firstName })] }), _jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "Last Name" }), _jsx(Text, { size: "base", weight: "medium", children: employee.lastName })] }), employee.preferredName && (_jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "Preferred Name" }), _jsx(Text, { size: "base", weight: "medium", children: employee.preferredName })] }))] })] })] }) }), _jsxs(Card, { style: { marginTop: 16 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }, children: [_jsx(Shield, { size: 18 }), _jsx(Text, { size: "lg", weight: "semibold", children: "Access & Security" })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }, children: [_jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "Role" }), _jsx("div", { style: { marginTop: 4 }, children: _jsx(Badge, { variant: roleName === 'admin' ? 'warning' : 'default', children: roleName }) })] }), _jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "Security Groups" }), _jsx("div", { style: { marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }, children: groups.length > 0 ? (groups.map((g) => (_jsx(Badge, { variant: "default", children: g.name }, g.id)))) : (_jsx(Text, { size: "sm", color: "secondary", style: { fontStyle: 'italic' }, children: "No groups" })) })] }), _jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "Last Login" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }, children: [_jsx(Clock, { size: 14, style: { opacity: 0.6 } }), _jsx(Text, { size: "base", children: formatRelativeTime(authUser?.last_login) })] })] }), _jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "Is Admin" }), _jsx("div", { style: { marginTop: 4 }, children: effectivePerms?.is_admin ? (_jsx(Badge, { variant: "warning", children: "Yes" })) : (_jsx(Badge, { variant: "default", children: "No" })) })] })] })] }), _jsxs(Card, { style: { marginTop: 16 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }, children: [_jsx(Calendar, { size: 18 }), _jsx(Text, { size: "lg", weight: "semibold", children: "Timeline" })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }, children: [_jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "Auth Account Created" }), _jsx(Text, { size: "base", children: formatDate(authUser?.created_at) })] }), _jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "HRM Record Created" }), _jsx(Text, { size: "base", children: formatDate(employee.createdAt) })] }), _jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "HRM Record Updated" }), _jsx(Text, { size: "base", children: formatDate(employee.updatedAt) })] })] })] }), editOpen && (_jsx(Modal, { open: true, onClose: () => setEditOpen(false), title: "Edit Employee", children: _jsxs("div", { style: { padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsx(Input, { label: "Email", value: employee.userEmail, disabled: true }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }, children: [_jsx(Input, { label: "First Name", value: firstName, onChange: (e) => setFirstName(e.target.value) }), _jsx(Input, { label: "Last Name", value: lastName, onChange: (e) => setLastName(e.target.value) })] }), _jsx(Input, { label: "Preferred Name (optional)", value: preferredName, onChange: (e) => setPreferredName(e.target.value) }), _jsxs("div", { style: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }, children: [_jsx(Button, { variant: "secondary", onClick: () => setEditOpen(false), children: "Cancel" }), _jsx(Button, { variant: "primary", onClick: handleSave, disabled: saving, children: saving ? 'Saving…' : 'Save' })] })] }) }))] }));
}
export default EmployeeDetail;
