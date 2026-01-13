'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { EntityListPage } from '../ui/EntityListPage';
export function EntityList({ entityKey, onNavigate }) {
    if (!entityKey)
        return _jsx("div", { style: { padding: 16 }, children: "Missing required prop: entityKey" });
    return _jsx(EntityListPage, { entityKey: entityKey, onNavigate: onNavigate });
}
export default EntityList;
