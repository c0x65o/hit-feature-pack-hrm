'use client';
import { useCallback, useEffect, useState } from 'react';
import { getStoredToken } from './authToken';
function authHeaders() {
    const token = getStoredToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
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
    if (entityKey !== 'hrm.employee')
        return null;
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
        useFormRegistries: () => ({
            optionSources: {},
            referenceRenderers: {},
        }),
    };
}
export function useDirectReports(employeeId) {
    return useHrmDirectReports(employeeId);
}
