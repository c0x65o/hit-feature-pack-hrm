'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEntityUiSpec } from './useHitUiSpecs';
import { getStoredToken } from './authToken';
function authHeaders() {
    const token = getStoredToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}
async function fetchTableDataQuery(args) {
    const tableId = String(args.tableId || '').trim();
    if (!tableId) {
        throw new Error('Missing tableId');
    }
    const body = {
        tableId,
        page: args.page,
        pageSize: args.pageSize,
    };
    const viewId = typeof args.viewId === 'string' ? args.viewId.trim() : '';
    if (viewId)
        body.viewId = viewId;
    if (args.search)
        body.search = String(args.search);
    if (args.sortBy)
        body.sortBy = String(args.sortBy);
    if (args.sortOrder)
        body.sortOrder = String(args.sortOrder);
    if (Array.isArray(args.filters) && args.filters.length > 0)
        body.filters = args.filters;
    if (args.filterMode)
        body.filterMode = args.filterMode;
    body.groupPageSize = 10000;
    const res = await fetch('/api/table-data/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok)
        throw new Error(json?.error || json?.detail || 'Failed to load data');
    const items = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.data?.items)
            ? json.data.items
            : [];
    const pagination = json?.pagination || json?.data?.pagination || null;
    const groupMeta = json?.groupCounts || json?.groupOrder || json?.groups
        ? {
            order: Array.isArray(json?.groupOrder) ? json.groupOrder : [],
            counts: json?.groupCounts && typeof json.groupCounts === 'object' ? json.groupCounts : {},
            groups: Array.isArray(json?.groups) ? json.groups : [],
        }
        : null;
    return { ...json, items, pagination, groupMeta };
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
function isAbsoluteUrl(value) {
    return value.startsWith('http://') || value.startsWith('https://');
}
function normalizeEndpointPath(value) {
    const raw = String(value || '').trim();
    if (!raw)
        return '';
    if (isAbsoluteUrl(raw))
        return raw;
    if (raw.startsWith('/'))
        return raw;
    return `/${raw}`;
}
function applyEndpointId(endpoint, id) {
    const safeId = encodeURIComponent(id);
    if (!endpoint)
        return endpoint;
    if (endpoint.includes('{id}'))
        return endpoint.replaceAll('{id}', safeId);
    if (endpoint.includes(':id'))
        return endpoint.replaceAll(':id', safeId);
    if (endpoint.includes('[id]'))
        return endpoint.replaceAll('[id]', safeId);
    if (endpoint.includes('<id>'))
        return endpoint.replaceAll('<id>', safeId);
    if (endpoint.endsWith('/'))
        return `${endpoint}${safeId}`;
    return `${endpoint}/${safeId}`;
}
function appendQuery(endpoint, params) {
    const qs = params.toString();
    if (!qs)
        return endpoint;
    return endpoint.includes('?') ? `${endpoint}&${qs}` : `${endpoint}?${qs}`;
}
function resolveCrudEndpointsFromSpec(entityKey, uiSpec) {
    const api = uiSpec && typeof uiSpec === 'object' ? uiSpec.api : null;
    if (!api || typeof api !== 'object')
        return null;
    const endpointsRaw = api.endpoints && typeof api.endpoints === 'object' ? api.endpoints : null;
    const baseUrl = String(api.baseUrl || api.base_url || '').trim();
    const resource = String(api.resource || '').trim();
    const namespace = String(api.namespace || api.ns || '').trim();
    let basePath = '';
    if (baseUrl) {
        basePath = normalizeEndpointPath(baseUrl);
    }
    else if (resource) {
        if (isAbsoluteUrl(resource) || resource.startsWith('/')) {
            basePath = normalizeEndpointPath(resource);
        }
        else {
            const group = namespace || entityKey.split('.')[0] || '';
            basePath = group ? `/api/${group}/${resource}` : `/api/${resource}`;
        }
    }
    const listRaw = endpointsRaw ? String(endpointsRaw.list || '').trim() : '';
    const detailRaw = endpointsRaw ? String(endpointsRaw.detail || '').trim() : '';
    const createRaw = endpointsRaw ? String(endpointsRaw.create || '').trim() : '';
    const updateRaw = endpointsRaw ? String(endpointsRaw.update || '').trim() : '';
    const deleteRaw = endpointsRaw ? String(endpointsRaw.delete || '').trim() : '';
    const list = listRaw ? normalizeEndpointPath(listRaw) : basePath;
    const create = createRaw ? normalizeEndpointPath(createRaw) : list;
    const detail = detailRaw
        ? normalizeEndpointPath(detailRaw)
        : basePath
            ? `${basePath.replace(/\/+$/, '')}/{id}`
            : '';
    const update = updateRaw ? normalizeEndpointPath(updateRaw) : detail;
    const del = deleteRaw ? normalizeEndpointPath(deleteRaw) : detail;
    if (!list && !detail && !create && !update && !del)
        return null;
    return { list, detail, create, update, delete: del };
}
function resolveCrudEndpointsFromResource(entityKey, resource) {
    const group = entityKey.split('.')[0] || '';
    const base = resource.startsWith('/api/') || resource.startsWith('/')
        ? normalizeEndpointPath(resource)
        : `/api/${group}/${resource}`;
    const detail = `${base.replace(/\/+$/, '')}/{id}`;
    return { list: base, detail, create: base, update: detail, delete: detail };
}
function useSchemaCrudList(endpoints, args) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const loadTokenRef = useRef(0);
    const fetchData = useCallback(async () => {
        const token = ++loadTokenRef.current;
        setLoading(true);
        try {
            if (args.tableId) {
                const json = await fetchTableDataQuery(args);
                if (token !== loadTokenRef.current)
                    return;
                setData(json);
                return;
            }
            const qp = new URLSearchParams();
            qp.set('page', String(args.page || 1));
            qp.set('pageSize', String(args.pageSize || 25));
            if (args.search)
                qp.set('search', String(args.search));
            if (args.sortBy)
                qp.set('sortBy', String(args.sortBy));
            if (args.sortOrder)
                qp.set('sortOrder', String(args.sortOrder));
            const listEndpoint = endpoints.list || '';
            if (!listEndpoint)
                throw new Error('Missing list endpoint');
            const res = await fetch(appendQuery(listEndpoint, qp), { headers: authHeaders(), credentials: 'include' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(json?.error || json?.detail || 'Failed to load data');
            if (token !== loadTokenRef.current)
                return;
            setData(json);
        }
        finally {
            if (token === loadTokenRef.current) {
                setLoading(false);
            }
        }
    }, [args.page, args.pageSize, args.search, args.sortBy, args.sortOrder, args.tableId, args.viewId, args.filters, args.filterMode, endpoints.list]);
    useEffect(() => {
        void fetchData();
    }, [fetchData]);
    const deleteItem = async (id) => {
        const deleteEndpoint = endpoints.delete || endpoints.detail;
        if (!deleteEndpoint)
            throw new Error('Missing delete endpoint');
        const res = await fetch(applyEndpointId(deleteEndpoint, id), {
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
function useSchemaCrudDetail(endpoints, id) {
    const [record, setRecord] = useState(null);
    const [loading, setLoading] = useState(false);
    const fetchData = useCallback(async () => {
        if (!id)
            return;
        setLoading(true);
        try {
            const detailEndpoint = endpoints.detail || '';
            if (!detailEndpoint)
                throw new Error('Missing detail endpoint');
            const res = await fetch(applyEndpointId(detailEndpoint, id), { headers: authHeaders(), credentials: 'include' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(json?.error || json?.detail || 'Failed to load record');
            setRecord(json);
        }
        finally {
            setLoading(false);
        }
    }, [endpoints.detail, id]);
    useEffect(() => {
        void fetchData();
    }, [fetchData]);
    return { record, loading, refetch: fetchData };
}
function useSchemaCrudUpsert(endpoints, id) {
    const detail = useSchemaCrudDetail(endpoints, id || '');
    return {
        record: detail.record,
        loading: detail.loading,
        create: async (payload) => {
            const createEndpoint = endpoints.create || endpoints.list;
            if (!createEndpoint)
                throw new Error('Missing create endpoint');
            const res = await fetch(createEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                credentials: 'include',
                body: JSON.stringify(payload || {}),
            });
            // Throw the Response object so useFormSubmit can parse structured errors
            if (!res.ok)
                throw res;
            const json = await res.json().catch(() => ({}));
            return json;
        },
        update: async (rid, payload) => {
            const updateEndpoint = endpoints.update || endpoints.detail;
            if (!updateEndpoint)
                throw new Error('Missing update endpoint');
            const res = await fetch(applyEndpointId(updateEndpoint, rid), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                credentials: 'include',
                body: JSON.stringify(payload || {}),
            });
            // Throw the Response object so useFormSubmit can parse structured errors
            if (!res.ok)
                throw res;
            const json = await res.json().catch(() => ({}));
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
    const loadTokenRef = useRef(0);
    const fetchData = useCallback(async () => {
        const token = ++loadTokenRef.current;
        setLoading(true);
        try {
            if (args.tableId) {
                const json = await fetchTableDataQuery(args);
                if (token !== loadTokenRef.current)
                    return;
                setData(json);
                return;
            }
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
            if (token !== loadTokenRef.current)
                return;
            setData(json);
        }
        finally {
            if (token === loadTokenRef.current) {
                setLoading(false);
            }
        }
    }, [args.page, args.pageSize, args.search, args.sortBy, args.sortOrder, args.tableId, args.viewId, args.filters, args.filterMode]);
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
    const uiSpec = useEntityUiSpec(entityKey);
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
                        // Throw the Response object so useFormSubmit can parse structured errors
                        if (!res.ok)
                            throw res;
                        const json = await res.json().catch(() => ({}));
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
        'hrm.holiday': 'holidays',
        'hrm.leaveType': 'leave-types',
        'hrm.ptoPolicy': 'pto-policies',
        'hrm.ptoPolicyAssignment': 'pto-policy-assignments',
        'hrm.ptoRequest': 'pto-requests',
        'hrm.ptoRequestSelf': 'pto-requests-self',
        'hrm.ptoBalance': 'pto-balances',
        'hrm.ptoLedgerEntry': 'pto-ledger-entries',
    };
    const resource = resourceMap[entityKey];
    const specEndpoints = resolveCrudEndpointsFromSpec(entityKey, uiSpec);
    const fallbackEndpoints = resource ? resolveCrudEndpointsFromResource(entityKey, resource) : null;
    const endpoints = specEndpoints || fallbackEndpoints;
    if (!endpoints)
        return null;
    return {
        useList: (args) => useSchemaCrudList(endpoints, args),
        useDetail: ({ id }) => useSchemaCrudDetail(endpoints, id),
        useUpsert: ({ id }) => useSchemaCrudUpsert(endpoints, id),
        useFormRegistries: () => baseRegistries,
    };
}
export function useDirectReports(employeeId) {
    return useHrmDirectReports(employeeId);
}
