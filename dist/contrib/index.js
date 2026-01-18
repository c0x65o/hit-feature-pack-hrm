/**
 * HRM pack contributions (dynamically loaded by the platform).
 *
 * The platform uses this module to resolve schema-driven extensions like
 * detail extras (widgets) and header action handlers.
 */
'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { OrgChart } from '@hit/ui-kit';
import { getEntityActionHandler } from '../ui/entityActions';
export const contrib = {
    listWidgets: {
        orgChart: (args) => {
            const listSpec = (args?.listSpec || {});
            const options = listSpec?.widgetOptions && typeof listSpec.widgetOptions === 'object' ? listSpec.widgetOptions : {};
            const spec = {
                endpoint: String(options.endpoint || listSpec.endpoint || '').trim(),
                navigateTo: String(options.navigateTo || listSpec.navigateTo || '').trim(),
                variant: options.variant || listSpec.variant || 'full',
                height: options.height || listSpec.height || 640,
            };
            return _jsx(OrgChart, { spec: spec, onNavigate: args?.navigate });
        },
    },
    detailExtras: {
        orgChart: (args) => {
            return _jsx(OrgChart, { spec: args?.spec, record: args?.record, onNavigate: args?.navigate });
        },
    },
    actionHandlers: {
        'hrm.employees.sync': async ({ entityKey, record, uiSpec, navigate }) => {
            const handler = getEntityActionHandler('hrm.employees.sync');
            if (!handler)
                throw new Error('Missing HRM handler: hrm.employees.sync');
            await handler({ entityKey, record, uiSpec, navigate });
        },
    },
};
export default contrib;
