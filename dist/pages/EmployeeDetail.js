'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Shield, User, Users, Clock, Mail, Calendar, Edit2, Phone, MapPin, Camera, Trash2, Download, Building2, Briefcase, MapPinned, } from 'lucide-react';
import { downloadVCard } from '../utils/vcard';
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
function normalizeAuthUser(raw) {
    if (!raw)
        return null;
    const u = raw?.user && typeof raw.user === 'object' ? raw.user : raw;
    const email = String(u?.email || '').trim();
    if (!email)
        return null;
    const createdAt = String(u?.created_at || u?.createdAt || '').trim() || undefined;
    const lastLoginRaw = u?.last_login === null || u?.last_login === undefined
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
    };
}
function mostRecentIso(dates) {
    let best = null;
    for (const d of dates) {
        if (!d)
            continue;
        const t = new Date(d).getTime();
        if (!Number.isFinite(t))
            continue;
        if (best === null || t > best)
            best = t;
    }
    return best === null ? null : new Date(best).toISOString();
}
export function EmployeeDetail({ id, onNavigate }) {
    const { Page, Card, Button, Badge, Spinner, Alert } = useUi();
    const [employee, setEmployee] = useState(null);
    const [authUser, setAuthUser] = useState(null);
    const [effectivePerms, setEffectivePerms] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // LDD (Location/Division/Department) state
    const [orgAssignment, setOrgAssignment] = useState(null);
    const [divisions, setDivisions] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [orgLocations, setOrgLocations] = useState([]);
    const [editingLdd, setEditingLdd] = useState(false);
    const [savingLdd, setSavingLdd] = useState(false);
    const [selectedDivisionId, setSelectedDivisionId] = useState('');
    const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
    const [selectedLocationId, setSelectedLocationId] = useState('');
    // Photo upload state
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoError, setPhotoError] = useState(null);
    const [profilePictureUrl, setProfilePictureUrl] = useState(null);
    const fileInputRef = useRef(null);
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    // Handle photo file selection
    const handlePhotoSelect = useCallback(async (event) => {
        const file = event.target.files?.[0];
        if (!file || !employee)
            return;
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
            const base64Promise = new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
            });
            reader.readAsDataURL(file);
            const base64Data = await base64Promise;
            // Upload via API
            const token = getStoredToken();
            if (!token)
                throw new Error('You must be signed in');
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
            setAuthUser((prev) => prev ? { ...prev, profile_picture_url: data.profile_picture_url || base64Data } : prev);
        }
        catch (e) {
            setPhotoError(e?.message || 'Failed to upload photo');
        }
        finally {
            setUploadingPhoto(false);
        }
    }, [employee]);
    // Handle photo deletion
    const handlePhotoDelete = useCallback(async () => {
        if (!employee)
            return;
        try {
            setUploadingPhoto(true);
            setPhotoError(null);
            const token = getStoredToken();
            if (!token)
                throw new Error('You must be signed in');
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
            setAuthUser((prev) => prev ? { ...prev, profile_picture_url: null } : prev);
        }
        catch (e) {
            setPhotoError(e?.message || 'Failed to remove photo');
        }
        finally {
            setUploadingPhoto(false);
        }
    }, [employee]);
    // Handle vCard download
    const handleDownloadVCard = useCallback(() => {
        if (!employee)
            return;
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
        if (!employee)
            return;
        // Must have at least one selection
        if (!selectedDivisionId && !selectedDepartmentId && !selectedLocationId) {
            setEditingLdd(false);
            return;
        }
        try {
            setSavingLdd(true);
            const token = getStoredToken();
            if (!token)
                throw new Error('You must be signed in');
            const body = {
                userKey: employee.userEmail,
                divisionId: selectedDivisionId || null,
                departmentId: selectedDepartmentId || null,
                locationId: selectedLocationId || null,
            };
            let response;
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
            }
            else {
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
        }
        catch (e) {
            setError(e?.message || 'Failed to save LDD');
        }
        finally {
            setSavingLdd(false);
        }
    }, [employee, orgAssignment, selectedDivisionId, selectedDepartmentId, selectedLocationId, divisions, departments, orgLocations]);
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
            const authRes = await fetch(`/api/auth/users/${encodeURIComponent(emp.userEmail)}`, {
                headers: { Authorization: `Bearer ${token}` },
                credentials: 'include',
            });
            if (authRes.ok) {
                const userRaw = await authRes.json().catch(() => null);
                const normalized = normalizeAuthUser(userRaw);
                setAuthUser(normalized);
                // Fallback: if auth doesn't provide last_login, infer from sessions.
                const lastLoginCandidate = String(normalized?.last_login || normalized?.lastLogin || '').trim();
                if (!lastLoginCandidate) {
                    const sessionsRes = await fetch(`/api/auth/admin/users/${encodeURIComponent(emp.userEmail)}/sessions?limit=20&offset=0`, {
                        headers: { Authorization: `Bearer ${token}` },
                        credentials: 'include',
                    });
                    if (sessionsRes.ok) {
                        const s = await sessionsRes.json().catch(() => null);
                        const sessions = Array.isArray(s?.sessions) ? s.sessions : Array.isArray(s) ? s : [];
                        const inferred = mostRecentIso(sessions.map((x) => String(x?.created_at || x?.createdAt || x?.createdOnTimestamp || x?.created_on || '').trim() || null));
                        if (inferred) {
                            setAuthUser((prev) => (prev ? { ...prev, last_login: inferred } : prev));
                        }
                    }
                }
            }
            // Fetch effective permissions (includes groups, role)
            const permsRes = await fetch(`/api/auth/admin/permissions/users/${encodeURIComponent(emp.userEmail)}/effective`, {
                headers: { Authorization: `Bearer ${token}` },
                credentials: 'include',
            });
            if (permsRes.ok) {
                const perms = await permsRes.json();
                setEffectivePerms(perms);
            }
            // Fetch org assignment (LDD)
            const assignmentRes = await fetch(`/api/org/assignments?userKey=${encodeURIComponent(emp.userEmail)}`, {
                headers: { Authorization: `Bearer ${token}` },
                credentials: 'include',
            });
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
                setDivisions((data?.items || data || []).filter((d) => d?.isActive !== false));
            }
            if (departmentsRes.ok) {
                const data = await departmentsRes.json();
                setDepartments((data?.items || data || []).filter((d) => d?.isActive !== false));
            }
            if (locationsRes.ok) {
                const data = await locationsRes.json();
                setOrgLocations((data?.items || data || []).filter((d) => d?.isActive !== false));
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
    const isActive = employee.isActive !== false;
    const authCreatedAt = String(authUser?.created_at || authUser?.createdAt || '').trim() || null;
    const authLastLogin = String(authUser?.last_login || authUser?.lastLogin || '').trim() || null;
    const breadcrumbs = [
        { label: 'HRM', icon: _jsx(Users, { size: 14 }) },
        { label: 'Employees', href: '/hrm/employees', icon: _jsx(User, { size: 14 }) },
        { label: displayName },
    ];
    return (_jsxs(Page, { title: displayName, breadcrumbs: breadcrumbs, onNavigate: navigate, actions: _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsxs(Button, { variant: "secondary", onClick: () => navigate('/hrm/employees'), children: [_jsx(ArrowLeft, { size: 16, style: { marginRight: 4 } }), "Back"] }), _jsxs(Button, { variant: "secondary", onClick: handleDownloadVCard, children: [_jsx(Download, { size: 16, style: { marginRight: 4 } }), "vCard"] }), _jsxs(Button, { variant: "primary", onClick: () => navigate(`/hrm/employees/${encodeURIComponent(employee.id)}/edit`), children: [_jsx(Edit2, { size: 16, style: { marginRight: 4 } }), "Edit"] })] }), children: [error && (_jsx(Alert, { variant: "error", title: "Error", style: { marginBottom: 16 }, children: error })), photoError && (_jsx(Alert, { variant: "error", title: "Photo Error", style: { marginBottom: 16 }, children: photoError })), _jsx(Card, { children: _jsxs("div", { style: { display: 'flex', gap: 24, alignItems: 'flex-start' }, children: [_jsxs("div", { style: { position: 'relative' }, children: [_jsx(UserAvatar, { email: employee.userEmail, name: displayName, src: profilePictureUrl || authUser?.profile_picture_url || undefined, size: "lg" }), _jsxs("div", { style: {
                                        position: 'absolute',
                                        bottom: 0,
                                        right: 0,
                                        display: 'flex',
                                        gap: 4,
                                    }, children: [_jsx("button", { type: "button", onClick: () => fileInputRef.current?.click(), disabled: uploadingPhoto, style: {
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
                                            }, title: "Upload photo", children: uploadingPhoto ? (_jsx("div", { style: { width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' } })) : (_jsx(Camera, { size: 14 })) }), (profilePictureUrl || authUser?.profile_picture_url) && (_jsx("button", { type: "button", onClick: handlePhotoDelete, disabled: uploadingPhoto, style: {
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
                                            }, title: "Remove photo", children: _jsx(Trash2, { size: 14 }) }))] }), _jsx("input", { ref: fileInputRef, type: "file", accept: "image/*", onChange: handlePhotoSelect, style: { display: 'none' } })] }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }, children: [_jsx(Text, { size: "2xl", weight: "bold", children: displayName }), isActive ? (_jsx(Badge, { variant: "success", children: "Active" })) : (_jsx(Badge, { variant: "default", children: "Inactive" }))] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4, opacity: 0.8 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx(Mail, { size: 14 }), _jsx(Text, { size: "base", children: employee.userEmail })] }), employee.phone && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx(Phone, { size: 14 }), _jsx(Text, { size: "base", children: employee.phone })] }))] }), _jsxs("div", { style: { display: 'flex', gap: 24, marginTop: 16 }, children: [_jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "First Name" }), _jsx(Text, { size: "base", weight: "medium", children: employee.firstName })] }), _jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "Last Name" }), _jsx(Text, { size: "base", weight: "medium", children: employee.lastName })] }), employee.preferredName && (_jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "Preferred Name" }), _jsx(Text, { size: "base", weight: "medium", children: employee.preferredName })] }))] })] })] }) }), (employee.phone || employee.address1 || employee.city) && (_jsxs(Card, { style: { marginTop: 16 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }, children: [_jsx(MapPin, { size: 18 }), _jsx(Text, { size: "lg", weight: "semibold", children: "Contact Information" })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }, children: [employee.phone && (_jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "Phone" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }, children: [_jsx(Phone, { size: 14, style: { opacity: 0.6 } }), _jsx(Text, { size: "base", children: employee.phone })] })] })), (employee.address1 || employee.city) && (_jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "Address" }), _jsxs("div", { style: { marginTop: 4 }, children: [employee.address1 && _jsx(Text, { size: "base", children: employee.address1 }), employee.address2 && _jsx(Text, { size: "base", children: employee.address2 }), (employee.city || employee.state || employee.postalCode) && (_jsxs(Text, { size: "base", children: [[employee.city, employee.state].filter(Boolean).join(', '), employee.postalCode && ` ${employee.postalCode}`] })), employee.country && _jsx(Text, { size: "base", children: employee.country })] })] }))] })] })), _jsxs(Card, { style: { marginTop: 16 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx(Building2, { size: 18 }), _jsx(Text, { size: "lg", weight: "semibold", children: "Organization" })] }), !editingLdd ? (_jsxs(Button, { variant: "secondary", size: "sm", onClick: () => setEditingLdd(true), children: [_jsx(Edit2, { size: 14, style: { marginRight: 4 } }), "Edit"] })) : (_jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx(Button, { variant: "secondary", size: "sm", onClick: () => {
                                            setEditingLdd(false);
                                            setSelectedDivisionId(orgAssignment?.divisionId || '');
                                            setSelectedDepartmentId(orgAssignment?.departmentId || '');
                                            setSelectedLocationId(orgAssignment?.locationId || '');
                                        }, children: "Cancel" }), _jsx(Button, { variant: "primary", size: "sm", onClick: handleSaveLdd, disabled: savingLdd, children: savingLdd ? 'Saving...' : 'Save' })] }))] }), editingLdd ? (_jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }, children: [_jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", style: { marginBottom: 4 }, children: "Division" }), _jsxs("select", { value: selectedDivisionId, onChange: (e) => setSelectedDivisionId(e.target.value), style: {
                                            width: '100%',
                                            padding: '8px 12px',
                                            borderRadius: 6,
                                            border: '1px solid var(--color-border, #374151)',
                                            backgroundColor: 'var(--color-bg-input, #1f2937)',
                                            color: 'inherit',
                                            fontSize: '14px',
                                        }, children: [_jsx("option", { value: "", children: "-- None --" }), divisions.map((d) => (_jsx("option", { value: d.id, children: d.name }, d.id)))] })] }), _jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", style: { marginBottom: 4 }, children: "Department" }), _jsxs("select", { value: selectedDepartmentId, onChange: (e) => setSelectedDepartmentId(e.target.value), style: {
                                            width: '100%',
                                            padding: '8px 12px',
                                            borderRadius: 6,
                                            border: '1px solid var(--color-border, #374151)',
                                            backgroundColor: 'var(--color-bg-input, #1f2937)',
                                            color: 'inherit',
                                            fontSize: '14px',
                                        }, children: [_jsx("option", { value: "", children: "-- None --" }), departments.map((d) => (_jsx("option", { value: d.id, children: d.name }, d.id)))] })] }), _jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", style: { marginBottom: 4 }, children: "Location" }), _jsxs("select", { value: selectedLocationId, onChange: (e) => setSelectedLocationId(e.target.value), style: {
                                            width: '100%',
                                            padding: '8px 12px',
                                            borderRadius: 6,
                                            border: '1px solid var(--color-border, #374151)',
                                            backgroundColor: 'var(--color-bg-input, #1f2937)',
                                            color: 'inherit',
                                            fontSize: '14px',
                                        }, children: [_jsx("option", { value: "", children: "-- None --" }), orgLocations.map((d) => (_jsx("option", { value: d.id, children: d.name }, d.id)))] })] })] })) : (_jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }, children: [_jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "Division" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }, children: [_jsx(Briefcase, { size: 14, style: { opacity: 0.6 } }), _jsx(Text, { size: "base", children: orgAssignment?.division?.name || divisions.find(d => d.id === orgAssignment?.divisionId)?.name || '—' })] })] }), _jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "Department" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }, children: [_jsx(Users, { size: 14, style: { opacity: 0.6 } }), _jsx(Text, { size: "base", children: orgAssignment?.department?.name || departments.find(d => d.id === orgAssignment?.departmentId)?.name || '—' })] })] }), _jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "Location" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }, children: [_jsx(MapPinned, { size: 14, style: { opacity: 0.6 } }), _jsx(Text, { size: "base", children: orgAssignment?.location?.name || orgLocations.find(d => d.id === orgAssignment?.locationId)?.name || '—' })] })] })] }))] }), _jsxs(Card, { style: { marginTop: 16 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }, children: [_jsx(Shield, { size: 18 }), _jsx(Text, { size: "lg", weight: "semibold", children: "Access & Security" })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }, children: [_jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "Role" }), _jsx("div", { style: { marginTop: 4 }, children: _jsx(Badge, { variant: roleName === 'admin' ? 'warning' : 'default', children: roleName }) })] }), _jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "Security Groups" }), _jsx("div", { style: { marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }, children: groups.length > 0 ? (groups.map((g) => (_jsx(Badge, { variant: "default", children: g.name }, g.id)))) : (_jsx(Text, { size: "sm", color: "secondary", style: { fontStyle: 'italic' }, children: "No groups" })) })] }), _jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "Last Login" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }, children: [_jsx(Clock, { size: 14, style: { opacity: 0.6 } }), _jsx(Text, { size: "base", children: formatRelativeTime(authLastLogin) })] })] }), _jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "Is Admin" }), _jsx("div", { style: { marginTop: 4 }, children: effectivePerms?.is_admin ? (_jsx(Badge, { variant: "warning", children: "Yes" })) : (_jsx(Badge, { variant: "default", children: "No" })) })] })] })] }), _jsxs(Card, { style: { marginTop: 16 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }, children: [_jsx(Calendar, { size: 18 }), _jsx(Text, { size: "lg", weight: "semibold", children: "Timeline" })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }, children: [_jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "Auth Account Created" }), _jsx(Text, { size: "base", children: formatDate(authCreatedAt) })] }), _jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "HRM Record Created" }), _jsx(Text, { size: "base", children: formatDate(employee.createdAt) })] }), _jsxs("div", { children: [_jsx(Text, { size: "sm", color: "secondary", children: "HRM Record Updated" }), _jsx(Text, { size: "base", children: formatDate(employee.updatedAt) })] })] })] })] }));
}
export default EmployeeDetail;
