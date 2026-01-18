'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState, useEffect, memo } from 'react';
import ReactFlow, { Background, Controls, Handle, Position, } from 'reactflow';
import 'reactflow/dist/style.css';
/**
 * Custom node component with circular avatar
 */
const EmployeeNode = memo(({ data }) => {
    const { label, profilePictureUrl, positionName, isActive, initials } = data;
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: 12,
            minWidth: 140,
            opacity: isActive ? 1 : 0.6,
        }, children: [_jsx(Handle, { type: "target", position: Position.Top, style: { opacity: 0 } }), _jsx("div", { style: {
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '3px solid #e2e8f0',
                    backgroundColor: profilePictureUrl ? 'transparent' : '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                }, children: profilePictureUrl ? (_jsx("img", { src: profilePictureUrl, alt: label, style: {
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    } })) : (_jsx("span", { style: {
                        color: '#ffffff',
                        fontSize: 24,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                    }, children: initials })) }), _jsx("div", { style: {
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#0f172a',
                    textAlign: 'center',
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }, children: label }), positionName && (_jsx("div", { style: {
                    fontSize: 11,
                    color: '#64748b',
                    textAlign: 'center',
                    marginTop: 2,
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }, children: positionName })), _jsx(Handle, { type: "source", position: Position.Bottom, style: { opacity: 0 } })] }));
});
EmployeeNode.displayName = 'EmployeeNode';
const nodeTypes = {
    employee: EmployeeNode,
};
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
function getInitials(firstName, lastName, preferredName) {
    const first = (preferredName || firstName || '').trim();
    const last = (lastName || '').trim();
    const firstInitial = first.charAt(0) || '';
    const lastInitial = last.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase() || '?';
}
export function FullOrgChart({ apiPath, onNavigate }) {
    const [roots, setRoots] = useState([]);
    const [loading, setLoading] = useState(true);
    const endpoint = (apiPath || '').trim() || '/api/hrm/employees/org-tree';
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
        // Calculate positions - horizontal layout with levels as columns
        const NODE_WIDTH = 160;
        const NODE_HEIGHT = 140;
        const HORIZONTAL_SPACING = 40;
        const VERTICAL_SPACING = 30;
        // First pass: count nodes at each level to calculate total height
        const levelHeights = new Map();
        for (const [depth, levelNodes] of levels.entries()) {
            levelHeights.set(depth, levelNodes.length * NODE_HEIGHT + (levelNodes.length - 1) * VERTICAL_SPACING);
        }
        // Second pass: position nodes centered at each level
        const nodePosition = new Map();
        const maxHeight = Math.max(...Array.from(levelHeights.values()));
        for (const [depth, levelNodes] of levels.entries()) {
            const levelHeight = levelHeights.get(depth) || 0;
            const startY = (maxHeight - levelHeight) / 2;
            const x = depth * (NODE_WIDTH + HORIZONTAL_SPACING);
            levelNodes.forEach((node, idx) => {
                const y = startY + idx * (NODE_HEIGHT + VERTICAL_SPACING);
                nodePosition.set(node.id, { x, y });
            });
        }
        const walk = (node) => {
            const pos = nodePosition.get(node.id) || { x: 0, y: 0 };
            const label = `${node.preferredName || node.firstName} ${node.lastName}`.trim() || node.userEmail;
            nodesOut.push({
                id: node.id,
                type: 'employee',
                position: pos,
                data: {
                    label,
                    profilePictureUrl: node.profilePictureUrl,
                    positionName: node.positionName,
                    isActive: node.isActive,
                    initials: getInitials(node.firstName, node.lastName, node.preferredName),
                },
            });
            for (const child of node.children || []) {
                edgesOut.push({
                    id: `${node.id}-${child.id}`,
                    source: node.id,
                    target: child.id,
                    type: 'smoothstep',
                    animated: false,
                    style: {
                        stroke: '#94a3b8',
                        strokeWidth: 2,
                    },
                });
                walk(child);
            }
        };
        roots.forEach((root) => walk(root));
        return { nodes: nodesOut, edges: edgesOut };
    }, [roots]);
    if (loading) {
        return (_jsx("div", { style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                minHeight: 400,
            }, children: _jsx("div", { style: { color: '#64748b', fontSize: 14 }, children: "Loading organization chart..." }) }));
    }
    if (!roots.length) {
        return (_jsx("div", { style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                minHeight: 400,
            }, children: _jsx("div", { style: { color: '#64748b', fontSize: 14 }, children: "No organization chart data available." }) }));
    }
    return (_jsx("div", { style: { height: '100%', width: '100%', minHeight: 600 }, children: _jsxs(ReactFlow, { nodes: nodes, edges: edges, nodeTypes: nodeTypes, fitView: true, fitViewOptions: { padding: 0.2 }, nodesDraggable: false, nodesConnectable: false, elementsSelectable: false, onNodeClick: ((_, node) => {
                if (!onNavigate)
                    return;
                const id = String(node?.id || '').trim();
                if (!id)
                    return;
                onNavigate(`/hrm/employees/${encodeURIComponent(id)}`);
            }), proOptions: { hideAttribution: true }, children: [_jsx(Background, { color: "#f1f5f9", gap: 20 }), _jsx(Controls, { showInteractive: false })] }) }));
}
