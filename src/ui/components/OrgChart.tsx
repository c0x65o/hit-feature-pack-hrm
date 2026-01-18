'use client';

import React, { useMemo, useState, useEffect, memo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

type OrgTreeNode = {
  id: string;
  managerId: string | null;
  userEmail: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  profilePictureUrl?: string | null;
  positionName?: string | null;
  isActive: boolean;
  children: OrgTreeNode[];
};

type OrgChartProps = {
  employeeId?: string;
  apiPath?: string;
  onNavigate?: (path: string) => void;
};

/**
 * Custom node component with circular avatar
 */
const EmployeeNode = memo(({ data }: NodeProps) => {
  const { label, profilePictureUrl, positionName, isActive, initials } = data;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 8,
        minWidth: 120,
        opacity: isActive ? 1 : 0.6,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      
      {/* Circular avatar */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '2px solid #e2e8f0',
          backgroundColor: profilePictureUrl ? 'transparent' : '#3b82f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 6,
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        {profilePictureUrl ? (
          <img
            src={profilePictureUrl}
            alt={label}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <span
            style={{
              color: '#ffffff',
              fontSize: 18,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {initials}
          </span>
        )}
      </div>
      
      {/* Name */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#0f172a',
          textAlign: 'center',
          maxWidth: 100,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
      
      {/* Position */}
      {positionName && (
        <div
          style={{
            fontSize: 10,
            color: '#64748b',
            textAlign: 'center',
            marginTop: 2,
            maxWidth: 100,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {positionName}
        </div>
      )}
      
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
});

EmployeeNode.displayName = 'EmployeeNode';

// Define nodeTypes outside the component to avoid React Flow warning
const nodeTypes = {
  employee: EmployeeNode,
};

function buildLevels(roots: OrgTreeNode[]): Map<number, OrgTreeNode[]> {
  const levels = new Map<number, OrgTreeNode[]>();
  if (!roots.length) return levels;

  const walk = (node: OrgTreeNode, depth: number) => {
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

function getInitials(firstName: string, lastName: string, preferredName: string | null): string {
  const first = (preferredName || firstName || '').trim();
  const last = (lastName || '').trim();
  const firstInitial = first.charAt(0) || '';
  const lastInitial = last.charAt(0) || '';
  return (firstInitial + lastInitial).toUpperCase() || '?';
}

export function OrgChart({ employeeId, apiPath, onNavigate }: OrgChartProps) {
  const [roots, setRoots] = useState<OrgTreeNode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
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
        if (mounted) setRoots(orgTree);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchTree();
    return () => {
      mounted = false;
    };
  }, [endpoint]);

  const { nodes, edges } = useMemo(() => {
    if (!roots.length) return { nodes: [] as Node[], edges: [] as Edge[] };
    const levels = buildLevels(roots);
    const nodesOut: Node[] = [];
    const edgesOut: Edge[] = [];

    const NODE_WIDTH = 140;
    const NODE_HEIGHT = 110;
    const HORIZONTAL_SPACING = 30;
    const VERTICAL_SPACING = 20;

    const levelHeights = new Map<number, number>();
    for (const [depth, levelNodes] of levels.entries()) {
      levelHeights.set(depth, levelNodes.length * NODE_HEIGHT + (levelNodes.length - 1) * VERTICAL_SPACING);
    }

    const nodePosition = new Map<string, { x: number; y: number }>();
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

    const walk = (node: OrgTreeNode) => {
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
    return <div className="text-sm text-gray-500">Loading org chart...</div>;
  }

  if (!roots.length) {
    return <div className="text-sm text-gray-500">No org chart data available.</div>;
  }

  return (
    <div style={{ height: 520, width: '100%' }} className="border rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodeClick={((_, node) => {
          if (!onNavigate) return;
          const id = String(node?.id || '').trim();
          if (!id) return;
          onNavigate(`/hrm/employees/${encodeURIComponent(id)}`);
        }) as NodeMouseHandler}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#f1f5f9" gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
