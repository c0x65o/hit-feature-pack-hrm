'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { EntityDetailPage } from '../ui/EntityDetailPage';
export function EntityDetail({ entityKey, id, onNavigate, }) {
    if (!entityKey)
        return _jsx("div", { style: { padding: 16 }, children: "Missing required prop: entityKey" });
    if (!id)
        return _jsx("div", { style: { padding: 16 }, children: "Missing required prop: id" });
    return _jsx(EntityDetailPage, { entityKey: entityKey, id: id, onNavigate: onNavigate });
}
export default EntityDetail;
