/**
 * HRM pack contributions (dynamically loaded by the platform).
 *
 * The platform uses this module to resolve schema-driven extensions like
 * detail extras (widgets) and header action handlers.
 */
'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { OrgChart } from '../ui/components/OrgChart';
function resolveEmployeeId(args) {
    const spec = args?.spec || {};
    const record = args?.record || {};
    const employeeIdFrom = spec?.employeeIdFrom || {};
    const fromField = String(employeeIdFrom.field || 'id').trim() || 'id';
    const value = employeeIdFrom?.kind === 'parentField'
        ? record?.[fromField]
        : record?.[fromField] ?? record?.id;
    return value == null ? '' : String(value).trim();
}
export const contrib = {
    detailExtras: {
        orgChart: (args) => {
            const employeeId = resolveEmployeeId(args);
            if (!employeeId)
                return null;
            return _jsx(OrgChart, { employeeId: employeeId, onNavigate: args?.navigate });
        },
    },
};
export default contrib;
