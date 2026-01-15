'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Alert } from '@hit/ui-kit';
import { HrmEmployeesEmbeddedTable } from './HrmEmployeesEmbeddedTable';
export function EmbeddedEntityTable({ spec, parent, navigate, }) {
    const entityType = String(spec?.entityType || '').trim();
    if (!entityType) {
        return _jsx(Alert, { variant: "error", title: "Missing embedded table entityType", children: "Invalid embedded table spec." });
    }
    if (entityType === 'hrm.employee') {
        return _jsx(HrmEmployeesEmbeddedTable, { spec: spec, parent: parent, navigate: navigate });
    }
    return (_jsxs(Alert, { variant: "warning", title: "Unsupported embedded table", children: ["No embedded table renderer is registered for `", entityType, "` yet."] }));
}
