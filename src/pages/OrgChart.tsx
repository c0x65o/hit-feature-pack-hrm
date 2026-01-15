'use client';

import React from 'react';
import { useUi } from '@hit/ui-kit';
import { OrgChart as OrgChartFlow } from '../ui/components/OrgChart';

export function OrgChart({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { Page } = useUi();

  const navigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  };

  return (
    <Page title="Org Chart" description="Full organization reporting structure" onNavigate={navigate}>
      <OrgChartFlow apiPath="/api/hrm/employees/org-tree" onNavigate={navigate} />
    </Page>
  );
}

export default OrgChart;
