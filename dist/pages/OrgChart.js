'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { useUi } from '@hit/ui-kit';
import { OrgChart as OrgChartFlow } from '../ui/components/OrgChart';
export function OrgChart({ onNavigate }) {
    const { Page } = useUi();
    const navigate = (path) => {
        if (onNavigate) {
            onNavigate(path);
        }
        else if (typeof window !== 'undefined') {
            window.location.href = path;
        }
    };
    return (_jsx(Page, { title: "Org Chart", description: "Full organization reporting structure", onNavigate: navigate, children: _jsx(OrgChartFlow, { apiPath: "/api/hrm/employees/org-tree", onNavigate: navigate }) }));
}
export default OrgChart;
