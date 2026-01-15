'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState, useEffect } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
function buildLevels(roots) {
    const levels = new Map();
    if (!roots.length)
        return levels;
    const walk = (node, depth) => {
        const level = levels.get(depth) || [];
        level.push(node);
        levels.set(depth, level);
        for (const child of node.children || []) {
            walk(child, depth + 1);
        }
    };
    roots.forEach((root) => walk(root, 0));
    return levels;
}
export function OrgChart({ employeeId, apiPath, onNavigate }) {
    const [roots, setRoots] = useState([]);
    const [loading, setLoading] = useState(true);
    const endpoint = (apiPath || '').trim() || (employeeId ? `/api/hrm/employees/${encodeURIComponent(employeeId)}/direct-reports` : '');
    useEffect(() => {
        if (!endpoint) {
            setRoots([]);
            setLoading(false);
            return;
        }
        let mounted = true;
        const fetchTree = async () => {
            setLoading(true);
            try {
                const res = await fetch(endpoint);
                const json = res.ok ? await res.json() : null;
                const orgTree = Array.isArray(json?.orgTree) ? json.orgTree : [];
                if (mounted)
                    setRoots(orgTree);
            }
            finally {
                if (mounted)
                    setLoading(false);
            }
        };
        fetchTree();
        return () => {
            mounted = false;
        };
    }, [endpoint]);
    const { nodes, edges } = useMemo(() => {
        if (!roots.length)
            return { nodes: [], edges: [] };
        const levels = buildLevels(roots);
        const nodesOut = [];
        const edgesOut = [];
        const nodePosition = new Map();
        for (const [depth, levelNodes] of levels.entries()) {
            const x = depth * 260;
            levelNodes.forEach((node, idx) => {
                const y = idx * 120;
                nodePosition.set(node.id, { x, y });
            });
        }
        const walk = (node) => {
            const pos = nodePosition.get(node.id) || { x: 0, y: 0 };
            nodesOut.push({
                id: node.id,
                position: pos,
                data: { label: `${node.preferredName || node.firstName} ${node.lastName}`.trim() || node.userEmail },
                style: {
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: node.isActive ? '#ffffff' : '#f8fafc',
                    color: '#0f172a',
                    minWidth: 140,
                    textAlign: 'center',
                    fontSize: 13,
                },
            });
            for (const child of node.children || []) {
                edgesOut.push({
                    id: `${node.id}-${child.id}`,
                    source: node.id,
                    target: child.id,
                    animated: false,
                });
                walk(child);
            }
        };
        roots.forEach((root) => walk(root));
        return { nodes: nodesOut, edges: edgesOut };
    }, [roots]);
    if (loading) {
        return _jsx("div", { className: "text-sm text-gray-500", children: "Loading org chart..." });
    }
    if (!roots.length) {
        return _jsx("div", { className: "text-sm text-gray-500", children: "No org chart data available." });
    }
    return (_jsx("div", { className: "h-[520px] w-full border rounded-lg overflow-hidden", children: _jsxs(ReactFlow, { nodes: nodes, edges: edges, fitView: true, nodesDraggable: false, onNodeClick: ((_, node) => {
                if (!onNavigate)
                    return;
                const id = String(node?.id || '').trim();
                if (!id)
                    return;
                onNavigate(`/hrm/employees/${encodeURIComponent(id)}`);
            }), children: [_jsx(Background, {}), _jsx(Controls, {})] }) }));
}
