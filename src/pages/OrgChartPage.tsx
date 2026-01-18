'use client';

import React from 'react';
import { useUi } from '@hit/ui-kit';
import { FullOrgChart } from '../ui/components/FullOrgChart';

export function OrgChartPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { Page, Card } = useUi();

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  const breadcrumbs = [
    { label: 'HRM', href: '/hrm' },
    { label: 'Organization Chart', href: '/hrm/org-chart' },
  ];

  return (
    <Page
      title="Organization Chart"
      description="Visual representation of the organizational hierarchy"
      breadcrumbs={breadcrumbs}
      onNavigate={navigate}
    >
      <Card style={{ height: 'calc(100vh - 200px)', minHeight: 600, padding: 0 }}>
        <FullOrgChart onNavigate={navigate} />
      </Card>
    </Page>
  );
}

export default OrgChartPage;
