/**
 * HRM pack contributions (dynamically loaded by the platform).
 *
 * The platform uses this module to resolve schema-driven extensions like
 * detail extras (widgets) and header action handlers.
 */
'use client';

import React from 'react';
import { OrgChart } from '../ui/components/OrgChart';

export type PackDetailExtraRendererArgs = {
  entityKey: string;
  record: any;
  uiSpec?: any;
  spec: any;
  navigate?: (path: string) => void;
  ui?: any;
  platform?: string;
};

export type PackContrib = {
  detailExtras?: Record<string, (args: PackDetailExtraRendererArgs) => React.ReactNode>;
};

function resolveEmployeeId(args: PackDetailExtraRendererArgs): string {
  const spec = args?.spec || {};
  const record = args?.record || {};
  const employeeIdFrom = spec?.employeeIdFrom || {};
  const fromField = String(employeeIdFrom.field || 'id').trim() || 'id';
  const value =
    employeeIdFrom?.kind === 'parentField'
      ? record?.[fromField]
      : record?.[fromField] ?? record?.id;
  return value == null ? '' : String(value).trim();
}

export const contrib: PackContrib = {
  detailExtras: {
    orgChart: (args) => {
      const employeeId = resolveEmployeeId(args);
      if (!employeeId) return null;
      return <OrgChart employeeId={employeeId} onNavigate={args?.navigate} />;
    },
  },
};

export default contrib;
