/**
 * HRM pack contributions (dynamically loaded by the platform).
 *
 * The platform uses this module to resolve schema-driven extensions like
 * detail extras (widgets) and header action handlers.
 */
'use client';

import React from 'react';
import { OrgChart } from '@hit/ui-kit';
import { getEntityActionHandler } from '../ui/entityActions';

export type PackListWidgetRendererArgs = {
  entityKey: string;
  uiSpec: any;
  listSpec: any;
  navigate?: (path: string) => void;
  ui?: any;
  platform?: string;
  params?: Record<string, string>;
};

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
  listWidgets?: Record<string, (args: PackListWidgetRendererArgs) => React.ReactNode>;
  detailExtras?: Record<string, (args: PackDetailExtraRendererArgs) => React.ReactNode>;
  actionHandlers?: Record<string, (args: PackActionHandlerContext) => void | Promise<void>>;
};

export type PackActionHandlerContext = {
  entityKey: string;
  record?: any;
  uiSpec?: any;
  navigate?: (path: string) => void;
};

export const contrib: PackContrib = {
  listWidgets: {
    orgChart: (args) => {
      const listSpec = (args?.listSpec || {}) as any;
      const options = listSpec?.widgetOptions && typeof listSpec.widgetOptions === 'object' ? listSpec.widgetOptions : {};
      const spec = {
        endpoint: String(options.endpoint || listSpec.endpoint || '').trim(),
        navigateTo: String(options.navigateTo || listSpec.navigateTo || '').trim(),
        variant: options.variant || listSpec.variant || 'full',
        height: options.height || listSpec.height || 640,
      };
      return <OrgChart spec={spec} onNavigate={args?.navigate} />;
    },
  },
  detailExtras: {
    orgChart: (args) => {
      return <OrgChart spec={args?.spec} record={args?.record} onNavigate={args?.navigate} />;
    },
  },
  actionHandlers: {
    'hrm.employees.sync': async ({ entityKey, record, uiSpec, navigate }) => {
      const handler = getEntityActionHandler('hrm.employees.sync');
      if (!handler) throw new Error('Missing HRM handler: hrm.employees.sync');
      await handler({ entityKey, record, uiSpec, navigate });
    },
    'hrm.employees.deactivate': async ({ entityKey, record, uiSpec, navigate }) => {
      const handler = getEntityActionHandler('hrm.employees.deactivate');
      if (!handler) throw new Error('Missing HRM handler: hrm.employees.deactivate');
      await handler({ entityKey, record, uiSpec, navigate });
    },
    'hrm.employees.activate': async ({ entityKey, record, uiSpec, navigate }) => {
      const handler = getEntityActionHandler('hrm.employees.activate');
      if (!handler) throw new Error('Missing HRM handler: hrm.employees.activate');
      await handler({ entityKey, record, uiSpec, navigate });
    },
  },
};

export default contrib;
