'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo, useRef, useState } from 'react';
import { useUi, Avatar } from '@hit/ui-kit';
import { ProfilePictureCropModal } from '@hit/feature-pack-auth-core';
import { getStoredToken } from './authToken';
function resolveUploadEndpoint({ entityId, apiBaseUrl, uploadEndpoint, }) {
    const endpoint = (uploadEndpoint || '').trim();
    if (endpoint) {
        return endpoint.includes('{id}')
            ? endpoint.replace('{id}', encodeURIComponent(entityId))
            : endpoint;
    }
    const base = (apiBaseUrl || '').trim().replace(/\/+$/, '');
    return base ? `${base}/${encodeURIComponent(entityId)}/photo` : '';
}
export function ProfilePhotoUploader({ fieldSpec, value, setValue, entityId, apiBaseUrl, }) {
    const { Button, Alert } = useUi();
    const fileInputRef = useRef(null);
    const [imageToCrop, setImageToCrop] = useState(null);
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const spec = fieldSpec && typeof fieldSpec === 'object' ? fieldSpec : {};
    const label = String(spec.label || 'Photo');
    const widgetConfig = spec.widgetConfig && typeof spec.widgetConfig === 'object' ? spec.widgetConfig : {};
    const allowDelete = widgetConfig.allowDelete !== false;
    const maxSizeMbRaw = Number(widgetConfig.maxSizeMB);
    const maxSizeMb = Number.isFinite(maxSizeMbRaw) && maxSizeMbRaw > 0 ? maxSizeMbRaw : 5;
    const uploadEndpoint = typeof widgetConfig.uploadEndpoint === 'string' ? widgetConfig.uploadEndpoint : '';
    const hasEntityId = Boolean(entityId && String(entityId).trim());
    const endpoint = useMemo(() => (hasEntityId ? resolveUploadEndpoint({ entityId: String(entityId), apiBaseUrl, uploadEndpoint }) : ''), [apiBaseUrl, entityId, hasEntityId, uploadEndpoint]);
    const handleFileSelect = useCallback((event) => {
        const file = event.target.files?.[0];
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        if (!file)
            return;
        if (!hasEntityId) {
            setError('Save the employee record before uploading a photo.');
            return;
        }
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file.');
            return;
        }
        if (file.size > maxSizeMb * 1024 * 1024) {
            setError(`Image must be smaller than ${maxSizeMb}MB.`);
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setImageToCrop(reader.result);
            setCropModalOpen(true);
        };
        reader.onerror = () => setError('Failed to read image file.');
        reader.readAsDataURL(file);
    }, [hasEntityId, maxSizeMb]);
    const uploadPhoto = useCallback(async (payload) => {
        if (!endpoint) {
            setError('Photo upload endpoint is not configured.');
            return;
        }
        const token = getStoredToken();
        if (!token) {
            setError('You must be signed in to update a profile photo.');
            return;
        }
        try {
            setUploading(true);
            setError(null);
            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                credentials: 'include',
                body: JSON.stringify({ profile_picture_url: payload }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.detail || data?.error || 'Failed to upload photo');
            }
            const next = typeof data?.profile_picture_url === 'string' ? data.profile_picture_url : payload;
            setValue(next || '');
        }
        catch (err) {
            setError(err?.message || 'Failed to upload photo.');
        }
        finally {
            setUploading(false);
        }
    }, [endpoint, setValue]);
    const handleCropComplete = useCallback(async (croppedImageBase64) => {
        await uploadPhoto(croppedImageBase64);
    }, [uploadPhoto]);
    const handleDelete = useCallback(async () => {
        await uploadPhoto(null);
    }, [uploadPhoto]);
    return (_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "text-sm text-gray-400", children: label }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx(Avatar, { name: label, src: value?.trim() || undefined, size: "lg" }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Button, { type: "button", variant: "secondary", onClick: () => fileInputRef.current?.click(), disabled: uploading, children: uploading ? 'Uploading…' : (value ? 'Change photo' : 'Upload photo') }), allowDelete && value ? (_jsx(Button, { type: "button", variant: "ghost", onClick: handleDelete, disabled: uploading, children: "Remove" })) : null] })] }), error ? (_jsx(Alert, { variant: "error", title: "Photo upload", children: error })) : null, _jsx("input", { ref: fileInputRef, type: "file", accept: "image/*", onChange: handleFileSelect, className: "hidden" }), imageToCrop && (_jsx(ProfilePictureCropModal, { open: cropModalOpen, onClose: () => setCropModalOpen(false), imageSrc: imageToCrop, onCropComplete: handleCropComplete }))] }));
}
