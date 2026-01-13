'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { EntityUpsertPage } from '../ui/EntityUpsertPage';
export function EntityEdit({ entityKey, id, onNavigate, }) {
    if (!entityKey)
        return _jsx("div", { style: { padding: 16 }, children: "Missing required prop: entityKey" });
    if (!id)
        return _jsx("div", { style: { padding: 16 }, children: "Missing required prop: id" });
    return _jsx(EntityUpsertPage, { entityKey: entityKey, id: id, onNavigate: onNavigate });
}
export default EntityEdit;
