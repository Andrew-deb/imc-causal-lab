import { useMemo, useEffect, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
  addEdge,
  type Edge,
  type Node,
  type Connection,
  type NodeChange,
  applyNodeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Trash2, Undo, Redo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_COLORS } from "@/lib/causal-graph";
import type { CausalEdgeFull, VariableRoles } from "@/lib/dag-store";
import CustomNode from "./CustomNode";

const RELATIONSHIP_COLOR: Record<CausalEdgeFull["relationship_type"], string> = {
  direct: "hsl(var(--primary))",
  confounder: ROLE_COLORS.confounder,
  mediator: ROLE_COLORS.mediator,
};

export function getNodeRole(
  node: string,
  treatment: string,
  outcome: string,
  roles: VariableRoles
): string {
  if (node === treatment) return "treatment";
  if (node === outcome) return "outcome";
  if (roles.confounders.includes(node)) return "confounder";
  if (roles.mediators.includes(node)) return "mediator";
  if (roles.colliders.includes(node)) return "collider";
  if (roles.instrumental_variables.includes(node)) return "instrumental_variable";
  return "confounder";
}

export function layoutNodes(
  variables: string[],
  treatment: string,
  outcome: string,
  roles: VariableRoles
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  positions.set(treatment, { x: 80, y: 240 });
  positions.set(outcome, { x: 720, y: 240 });
  const place = (arr: string[], y: number, spacing = 180) => {
    const startX = 400 - ((arr.length - 1) * spacing) / 2;
    arr.forEach((v, i) => positions.set(v, { x: startX + i * spacing, y }));
  };
  place(roles.confounders, 40);
  place(roles.mediators, 240);
  place(roles.colliders, 440);
  place(roles.instrumental_variables, 540, 160);
  let idx = 0;
  variables.forEach((v) => {
    if (!positions.has(v)) {
      positions.set(v, { x: 200 + (idx % 4) * 160, y: 600 + Math.floor(idx / 4) * 100 });
      idx += 1;
    }
  });
  return positions;
}

interface Props {
  treatment: string;
  outcome: string;
  variables: string[];
  edges: CausalEdgeFull[];
  variable_roles: VariableRoles;
  selectedEdgeKey?: string | null;
  onEdgeClick?: (edge: CausalEdgeFull) => void;
  onConnect?: (source: string, target: string) => void;
  onNodesDeleteRequest?: (deletedIds: string[]) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  readOnly?: boolean;
  height?: string;
}

export function edgeKey(e: { source: string; target: string }) {
  return `${e.source}__${e.target}`;
}

export default function DAGCanvas({
  treatment,
  outcome,
  variables,
  edges,
  variable_roles,
  selectedEdgeKey,
  onEdgeClick,
  onConnect,
  onNodesDeleteRequest,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  readOnly,
  height = "65vh",
}: Props) {
  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  const initial = useMemo(() => {
    const positions = layoutNodes(variables, treatment, outcome, variable_roles);
    const nodes: Node[] = variables.map((id) => {
      const role = getNodeRole(id, treatment, outcome, variable_roles);
      const color = ROLE_COLORS[role] ?? ROLE_COLORS.confounder;
      const isFixed = id === treatment || id === outcome;
      return {
        id,
        type: "custom",
        position: positions.get(id) ?? { x: 0, y: 0 },
        data: { label: `${id}\n(${role.replace("_", " ")})`, style: {
          background: color.replace("hsl(", "hsla(").replace(")", ", 0.15)"),
          border: `2px solid ${color}`,
          borderRadius: 10,
          padding: "10px 16px",
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: "pre-line" as const,
          textAlign: "center" as const,
          minWidth: 110,
          color: "hsl(var(--foreground))",
        } },
        draggable: !readOnly,
        // Treatment and Outcome nodes cannot be deleted
        deletable: !readOnly && !isFixed,
      };
    });
    const rfEdges: Edge[] = edges.map((e) => {
      const id = edgeKey(e);
      const isSelected = id === selectedEdgeKey;
      const stroke = RELATIONSHIP_COLOR[e.relationship_type] ?? "hsl(var(--primary))";
      const isManual = e.origin === "manual";
      return {
        id,
        source: e.source,
        target: e.target,
        animated: isSelected,
        label: isManual ? `✏️ ${(e.confidence * 100).toFixed(0)}%` : `${(e.confidence * 100).toFixed(0)}%`,
        labelStyle: { fontSize: 10, fontWeight: 600, fill: "hsl(var(--muted-foreground))" },
        labelBgStyle: { fill: "hsl(var(--card))" },
        style: {
          stroke,
          strokeWidth: isSelected ? 3.5 : 1.8,
          strokeDasharray: isManual ? "6 4" : undefined,
          opacity: selectedEdgeKey && !isSelected ? 0.35 : 1,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
      };
    });
    return { nodes, rfEdges };
  }, [variables, edges, treatment, outcome, variable_roles, selectedEdgeKey, readOnly]);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(initial.nodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(initial.rfEdges);

  // Reset nodes when graph identity changes (variables/roles/treatment/outcome).
  // We preserve the user's dragged positions if the node already exists.
  useEffect(() => {
    setRfNodes((prev) => {
      const prevPos = new Map(prev.map(n => [n.id, n.position]));
      return initial.nodes.map(n => ({
        ...n,
        position: prevPos.has(n.id) ? prevPos.get(n.id)! : n.position
      }));
    });
  }, [initial.nodes, setRfNodes]);

  // Refresh edges (selection or content change).
  useEffect(() => {
    setRfEdges(initial.rfEdges);
  }, [initial.rfEdges, setRfEdges]);

  const handleConnect = useCallback(
    (c: Connection) => {
      if (readOnly || !c.source || !c.target || !onConnect) return;
      onConnect(c.source, c.target);
      setRfEdges((eds) => addEdge({ ...c, animated: false }, eds));
    },
    [onConnect, readOnly, setRfEdges]
  );

  // Handle node changes including deletions
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const removeChanges = changes.filter((c) => c.type === "remove");
      
      if (removeChanges.length > 0) {
        if (!readOnly && onNodesDeleteRequest) {
          // Notify parent to confirm deletion, but do NOT apply removal to internal state yet
          onNodesDeleteRequest(removeChanges.map((c) => c.id));
        }
        
        // Only apply non-remove changes (like position updates)
        const otherChanges = changes.filter((c) => c.type !== "remove");
        if (otherChanges.length > 0) {
          onNodesChange(otherChanges);
        }
      } else {
        // No removals, just apply all changes
        onNodesChange(changes);
      }
    },
    [onNodesChange, onNodesDeleteRequest, readOnly]
  );

  const selectedDeletableNodes = useMemo(() => {
    return rfNodes.filter((n) => n.selected && n.deletable);
  }, [rfNodes]);

  const handleUiDelete = () => {
    if (!readOnly && onNodesDeleteRequest && selectedDeletableNodes.length > 0) {
      onNodesDeleteRequest(selectedDeletableNodes.map((n) => n.id));
    }
  };

  return (
    <div className="flex flex-col gap-2" style={{ height }}>
      {/* Top Border Toolbar */}
      {!readOnly && (
        <div className="flex items-center justify-between bg-card border rounded-lg p-1.5 shadow-sm min-h-[44px]">
          <div className="flex items-center gap-1">
            {onUndo && (
              <Button variant="ghost" size="sm" onClick={onUndo} disabled={!canUndo}>
                <Undo className="w-4 h-4 mr-1" /> Undo
              </Button>
            )}
            {onRedo && (
              <Button variant="ghost" size="sm" onClick={onRedo} disabled={!canRedo}>
                <Redo className="w-4 h-4 mr-1" /> Redo
              </Button>
            )}
          </div>
          <div>
            {selectedDeletableNodes.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="shadow-sm gap-1.5 px-3 h-8 animate-in fade-in slide-in-from-right-4"
                onClick={handleUiDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete {selectedDeletableNodes.length === 1 ? `'${selectedDeletableNodes[0].id}'` : `${selectedDeletableNodes.length} nodes`}
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="relative border rounded-lg overflow-hidden flex-1">
        {/* Legend */}
        <div className="absolute top-2 right-2 z-10 bg-card/90 backdrop-blur border rounded-md px-2.5 py-1.5 text-[10px] flex items-center gap-3 shadow-sm">
          <span className="flex items-center gap-1.5">
            <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="hsl(var(--primary))" strokeWidth="2" /></svg>
            <span className="text-muted-foreground">AI</span>
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="4 3" /></svg>
            <span className="text-muted-foreground">✏️ Manual</span>
          </span>
        </div>
        
        {/* Delete hint - keep as fallback hint but remove old floating button container */}
        {!readOnly && selectedDeletableNodes.length === 0 && (
          <div className="absolute bottom-12 right-2 z-10 bg-card/80 backdrop-blur border rounded-md px-2 py-1 text-[10px] text-muted-foreground shadow-sm pointer-events-none animate-in fade-in">
            Select node → <kbd className="font-mono bg-muted px-1 rounded">Delete</kbd> to remove
          </div>
        )}

        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        nodesConnectable={!readOnly}
        nodesDraggable={!readOnly}
        deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        onEdgeClick={(_, edge) => {
          const found = edges.find((e) => edgeKey(e) === edge.id);
          if (found && onEdgeClick) onEdgeClick(found);
        }}
      >
        <Background />
        {/* Controls styled for dark mode visibility */}
        <Controls
          style={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
          className="[&_button]:bg-card [&_button]:text-foreground [&_button]:border-border [&_button:hover]:bg-muted"
        />
      </ReactFlow>
      </div>
    </div>
  );
}
