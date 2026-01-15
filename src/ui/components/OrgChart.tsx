'use client';

import React, { useMemo, useState, useEffect } from 'react';
import ReactFlow, { Background, Controls, type Edge, type Node, type NodeMouseHandler } from 'reactflow';
import 'reactflow/dist/style.css';

type OrgTreeNode = {
  id: string;
  managerId: string | null;
  userEmail: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  isActive: boolean;
  children: OrgTreeNode[];
};

type OrgChartProps = {
  employeeId: string;
  onNavigate?: (path: string) => void;
};

function buildLevels(root: OrgTreeNode | null): Map<number, OrgTreeNode[]> {
  const levels = new Map<number, OrgTreeNode[]>();
  if (!root) return levels;

  const walk = (node: OrgTreeNode, depth: number) => {
    const level = levels.get(depth) || [];
    level.push(node);
    levels.set(depth, level);
    for (const child of node.children || []) {
      walk(child, depth + 1);
    }
  };

  walk(root, 0);
  return levels;
}

export function OrgChart({ employeeId, onNavigate }: OrgChartProps) {
  const [tree, setTree] = useState<OrgTreeNode | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const fetchTree = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/hrm/employees/${encodeURIComponent(employeeId)}/direct-reports`);
        const json = res.ok ? await res.json() : null;
        const root = Array.isArray(json?.orgTree) ? json.orgTree[0] : null;
        if (mounted) setTree(root || null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchTree();
    return () => {
      mounted = false;
    };
  }, [employeeId]);

  const { nodes, edges } = useMemo(() => {
    if (!tree) return { nodes: [] as Node[], edges: [] as Edge[] };
    const levels = buildLevels(tree);
    const nodesOut: Node[] = [];
    const edgesOut: Edge[] = [];

    const nodePosition = new Map<string, { x: number; y: number }>();
    for (const [depth, levelNodes] of levels.entries()) {
      const x = depth * 260;
      levelNodes.forEach((node, idx) => {
        const y = idx * 120;
        nodePosition.set(node.id, { x, y });
      });
    }

    const walk = (node: OrgTreeNode) => {
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

    walk(tree);
    return { nodes: nodesOut, edges: edgesOut };
  }, [tree]);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading org chart...</div>;
  }

  if (!tree) {
    return <div className="text-sm text-gray-500">No org chart data available.</div>;
  }

  return (
    <div className="h-[520px] w-full border rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        onNodeClick={((_, node) => {
          if (!onNavigate) return;
          const id = String(node?.id || '').trim();
          if (!id) return;
          onNavigate(`/hrm/employees/${encodeURIComponent(id)}`);
        }) as NodeMouseHandler}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
