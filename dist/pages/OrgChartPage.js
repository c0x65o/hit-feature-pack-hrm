'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { useUi } from '@hit/ui-kit';
import { FullOrgChart } from '../ui/components/FullOrgChart';
export function OrgChartPage({ onNavigate }) {
    const { Page, Card } = useUi();
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    const breadcrumbs = [
        { label: 'HRM', href: '/hrm' },
        { label: 'Organization Chart', href: '/hrm/org-chart' },
    ];
    return (_jsx(Page, { title: "Organization Chart", description: "Visual representation of the organizational hierarchy", breadcrumbs: breadcrumbs, onNavigate: navigate, children: _jsx(Card, { style: { height: 'calc(100vh - 200px)', minHeight: 600, padding: 0 }, children: _jsx(FullOrgChart, { onNavigate: navigate }) }) }));
}
export default OrgChartPage;
