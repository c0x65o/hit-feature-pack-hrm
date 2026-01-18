'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStoredToken } from './authToken';
function authHeaders() {
    const token = getStoredToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}
function extractItems(json) {
    if (Array.isArray(json))
        return json;
    if (Array.isArray(json?.items))
        return json.items;
    return [];
}
function buildOptions(args) {
    const { items, valueKey, labelKey, emptyLabel } = args;
    return [
        { value: '', label: emptyLabel },
        ...items.map((item) => ({
            value: String(item?.[valueKey] ?? ''),
            label: String(item?.[labelKey] ?? ''),
        })),
    ];
}
function useSchemaCrudList(basePath, resource, args) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const qp = new URLSearchParams();
            qp.set('page', String(args.page || 1));
            qp.set('pageSize', String(args.pageSize || 25));
            if (args.search)
                qp.set('search', String(args.search));
            if (args.sortBy)
                qp.set('sortBy', String(args.sortBy));
            if (args.sortOrder)
                qp.set('sortOrder', String(args.sortOrder));
            const res = await fetch(`${basePath}/${resource}?${qp.toString()}`, { headers: authHeaders(), credentials: 'include' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(json?.error || json?.detail || 'Failed to load data');
            setData(json);
        }
        finally {
            setLoading(false);
        }
    }, [args.page, args.pageSize, args.search, args.sortBy, args.sortOrder, basePath, resource]);
    useEffect(() => {
        void fetchData();
    }, [fetchData]);
    const deleteItem = async (id) => {
        const res = await fetch(`${basePath}/${resource}/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: authHeaders(),
            credentials: 'include',
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok)
            throw new Error(json?.error || json?.detail || 'Failed to delete');
        await fetchData();
        return json;
    };
    return { data, loading, refetch: fetchData, deleteItem };
}
function useSchemaCrudDetail(basePath, resource, id) {
    const [record, setRecord] = useState(null);
    const [loading, setLoading] = useState(false);
    const fetchData = useCallback(async () => {
        if (!id)
            return;
        setLoading(true);
        try {
            const res = await fetch(`${basePath}/${resource}/${encodeURIComponent(id)}`, { headers: authHeaders(), credentials: 'include' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(json?.error || json?.detail || 'Failed to load record');
            setRecord(json);
        }
        finally {
            setLoading(false);
        }
    }, [basePath, resource, id]);
    useEffect(() => {
        void fetchData();
    }, [fetchData]);
    return { record, loading, refetch: fetchData };
}
function useSchemaCrudUpsert(basePath, resource, id) {
    const detail = useSchemaCrudDetail(basePath, resource, id || '');
    return {
        record: detail.record,
        loading: detail.loading,
        create: async (payload) => {
            const res = await fetch(`${basePath}/${resource}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                credentials: 'include',
                body: JSON.stringify(payload || {}),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(json?.error || json?.detail || 'Failed to create');
            return json;
        },
        update: async (rid, payload) => {
            const res = await fetch(`${basePath}/${resource}/${encodeURIComponent(rid)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                credentials: 'include',
                body: JSON.stringify(payload || {}),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(json?.error || json?.detail || 'Failed to update');
            await detail.refetch();
            return json;
        },
    };
}
function toEmployeeOption(row) {
    const id = String(row?.id || '').trim();
    if (!id)
        return null;
    const label = String(row?.displayName || row?.name || row?.userEmail || '').trim() || id;
    const description = String(row?.userEmail || '').trim();
    return {
        value: id,
        label,
        description: description && description !== label ? description : undefined,
    };
}
function useEmployeeReferenceRenderer() {
    return useMemo(() => ({ label, value, setValue, placeholder, ui }) => (_jsx(ui.Autocomplete, { label: label, placeholder: placeholder || 'Search employees…', value: value, onChange: setValue, minQueryLength: 2, debounceMs: 200, limit: 10, emptyMessage: "No employees found", searchingMessage: "Searching\u2026", clearable: true, onSearch: async (query, lim) => {
            const params = new URLSearchParams();
            params.set('search', query);
            params.set('pageSize', String(lim));
            const res = await fetch(`/api/hrm/employees/picker?${params.toString()}`, {
                headers: authHeaders(),
                credentials: 'include',
            });
            const json = await res.json().catch(() => ({}));
            const items = extractItems(json);
            return items
                .map((row) => toEmployeeOption(row))
                .filter((opt) => Boolean(opt))
                .slice(0, lim);
        }, resolveValue: async (id) => {
            if (!id)
                return null;
            const params = new URLSearchParams();
            params.set('id', id);
            params.set('pageSize', '1');
            const res = await fetch(`/api/hrm/employees/picker?${params.toString()}`, {
                headers: authHeaders(),
                credentials: 'include',
            });
            const json = await res.json().catch(() => ({}));
            const items = extractItems(json);
            const row = items[0];
            return row ? toEmployeeOption(row) : null;
        } })), []);
}
function useOptionSource(args) {
    const { basePath, resource, valueKey, labelKey, emptyLabel } = args;
    const [options, setOptions] = useState([{ value: '', label: emptyLabel }]);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            try {
                const qp = new URLSearchParams();
                qp.set('page', '1');
                qp.set('pageSize', '200');
                qp.set('sortBy', labelKey);
                qp.set('sortOrder', 'asc');
                const res = await fetch(`${basePath}/${resource}?${qp.toString()}`, { headers: authHeaders(), credentials: 'include' });
                const json = await res.json().catch(() => ({}));
                if (!res.ok)
                    throw new Error(json?.error || json?.detail || 'Failed to load options');
                const items = extractItems(json);
                const next = buildOptions({ items, valueKey, labelKey, emptyLabel });
                if (!cancelled)
                    setOptions(next);
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [basePath, resource, valueKey, labelKey, emptyLabel]);
    return { options, loading };
}
function useHrmEmployeesList(args) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const qp = new URLSearchParams();
            qp.set('page', String(args.page || 1));
            qp.set('pageSize', String(args.pageSize || 25));
            if (args.search)
                qp.set('search', String(args.search));
            if (args.sortBy)
                qp.set('sortBy', String(args.sortBy));
            if (args.sortOrder)
                qp.set('sortOrder', String(args.sortOrder));
            const res = await fetch(`/api/hrm/employees?${qp.toString()}`, { headers: authHeaders(), credentials: 'include' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(json?.error || json?.detail || 'Failed to load employees');
            setData(json);
        }
        finally {
            setLoading(false);
        }
    }, [args.page, args.pageSize, args.search, args.sortBy, args.sortOrder]);
    useEffect(() => {
        void fetchData();
    }, [fetchData]);
    return { data, loading, refetch: fetchData };
}
function useHrmEmployeeDetail(id) {
    const [record, setRecord] = useState(null);
    const [loading, setLoading] = useState(false);
    const fetchData = useCallback(async () => {
        if (!id)
            return;
        setLoading(true);
        try {
            const res = await fetch(`/api/hrm/employees/${encodeURIComponent(id)}`, { headers: authHeaders(), credentials: 'include' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(json?.error || json?.detail || 'Failed to load employee');
            setRecord(json);
        }
        finally {
            setLoading(false);
        }
    }, [id]);
    useEffect(() => {
        void fetchData();
    }, [fetchData]);
    return { record, loading, refetch: fetchData };
}
function useHrmDirectReports(employeeId) {
    const [directReports, setDirectReports] = useState([]);
    const [orgTree, setOrgTree] = useState([]);
    const [loading, setLoading] = useState(false);
    const fetchData = useCallback(async () => {
        if (!employeeId)
            return;
        setLoading(true);
        try {
            const res = await fetch(`/api/hrm/employees/${encodeURIComponent(employeeId)}/direct-reports`, {
                headers: authHeaders(),
                credentials: 'include',
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(json?.error || json?.detail || 'Failed to load direct reports');
            setDirectReports(Array.isArray(json?.directReports) ? json.directReports : []);
            setOrgTree(Array.isArray(json?.orgTree) ? json.orgTree : []);
        }
        finally {
            setLoading(false);
        }
    }, [employeeId]);
    useEffect(() => {
        void fetchData();
    }, [fetchData]);
    return { directReports, orgTree, loading, refetch: fetchData };
}
export function useEntityDataSource(entityKey) {
    const employeeReferenceRenderer = useEmployeeReferenceRenderer();
    const positionsSource = useOptionSource({
        basePath: '/api/hrm',
        resource: 'positions',
        valueKey: 'id',
        labelKey: 'name',
        emptyLabel: '(No position)',
    });
    const leaveTypesSource = useOptionSource({
        basePath: '/api/hrm',
        resource: 'leave-types',
        valueKey: 'id',
        labelKey: 'name',
        emptyLabel: '(Select leave type)',
    });
    const ptoPoliciesSource = useOptionSource({
        basePath: '/api/hrm',
        resource: 'pto-policies',
        valueKey: 'id',
        labelKey: 'name',
        emptyLabel: '(Select policy)',
    });
    const employeesSource = useOptionSource({
        basePath: '/api/hrm',
        resource: 'employees/picker',
        valueKey: 'id',
        labelKey: 'displayName',
        emptyLabel: '(Select employee)',
    });
    const locationsSource = useOptionSource({
        basePath: '/api/org',
        resource: 'locations',
        valueKey: 'id',
        labelKey: 'name',
        emptyLabel: '(No location)',
    });
    const departmentsSource = useOptionSource({
        basePath: '/api/org',
        resource: 'departments',
        valueKey: 'id',
        labelKey: 'name',
        emptyLabel: '(No department)',
    });
    const divisionsSource = useOptionSource({
        basePath: '/api/org',
        resource: 'divisions',
        valueKey: 'id',
        labelKey: 'name',
        emptyLabel: '(No division)',
    });
    const baseRegistries = {
        optionSources: {
            'hrm.positions': { options: positionsSource.options, loading: positionsSource.loading },
            'hrm.leaveTypes': { options: leaveTypesSource.options, loading: leaveTypesSource.loading },
            'hrm.ptoPolicies': { options: ptoPoliciesSource.options, loading: ptoPoliciesSource.loading },
            'hrm.employees': { options: employeesSource.options, loading: employeesSource.loading },
            'org.locations': { options: locationsSource.options, loading: locationsSource.loading },
            'org.departments': { options: departmentsSource.options, loading: departmentsSource.loading },
            'org.divisions': { options: divisionsSource.options, loading: divisionsSource.loading },
        },
        referenceRenderers: {
            'hrm.employee': employeeReferenceRenderer,
        },
    };
    if (entityKey === 'hrm.employee') {
        return {
            useList: (args) => {
                const { data, loading, refetch } = useHrmEmployeesList(args);
                return { data, loading, refetch };
            },
            useDetail: ({ id }) => {
                const { record, loading } = useHrmEmployeeDetail(id);
                return { record, loading };
            },
            useUpsert: ({ id }) => {
                const recordId = id || '';
                const detail = useHrmEmployeeDetail(recordId);
                return {
                    record: detail.record,
                    loading: detail.loading,
                    create: async () => {
                        throw new Error('Employees are auto-provisioned; creation is not supported.');
                    },
                    update: async (rid, payload) => {
                        const res = await fetch(`/api/hrm/employees/${encodeURIComponent(rid)}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', ...authHeaders() },
                            credentials: 'include',
                            body: JSON.stringify(payload || {}),
                        });
                        const json = await res.json().catch(() => ({}));
                        if (!res.ok)
                            throw new Error(json?.error || json?.detail || 'Failed to update employee');
                        // refresh detail cache
                        await detail.refetch();
                        return json;
                    },
                };
            },
            useFormRegistries: () => baseRegistries,
        };
    }
    const resourceMap = {
        'hrm.position': 'positions',
        'hrm.leaveType': 'leave-types',
        'hrm.ptoPolicy': 'pto-policies',
        'hrm.ptoPolicyAssignment': 'pto-policy-assignments',
        'hrm.ptoRequest': 'pto-requests',
        'hrm.ptoBalance': 'pto-balances',
        'hrm.ptoLedgerEntry': 'pto-ledger-entries',
    };
    const resource = resourceMap[entityKey];
    if (!resource)
        return null;
    return {
        useList: (args) => useSchemaCrudList('/api/hrm', resource, args),
        useDetail: ({ id }) => useSchemaCrudDetail('/api/hrm', resource, id),
        useUpsert: ({ id }) => useSchemaCrudUpsert('/api/hrm', resource, id),
        useFormRegistries: () => baseRegistries,
    };
}
export function useDirectReports(employeeId) {
    return useHrmDirectReports(employeeId);
}
