import { useSession } from "@/contexts/SessionContext";
import { useDAGLibrary } from "@/lib/dag-store";
import { ChevronDown, FolderKanban, Workflow, CircleDot, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export function SessionContextBar() {
  const { sessionId, selectedDagId, setSelectedDagId } = useSession();
  const { dags } = useDAGLibrary();
  const dag = dags.find((d) => d.dag_id === selectedDagId);
  const location = useLocation();

  // Hide on Home page since the page itself summarises this
  if (location.pathname === "/") return null;

  const ready = !!sessionId || !!selectedDagId;

  return (
    <div className="h-9 border-b border-border bg-surface-sunken flex items-center px-3 gap-3 text-xs shrink-0 overflow-x-auto">
      {/* Session picker */}
      <Popover>
        <PopoverTrigger className="flex items-center gap-1.5 h-6 px-2 rounded hover:bg-muted text-foreground transition-colors">
          <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Session:</span>
          <span className="font-mono text-[11px] font-medium truncate max-w-[200px]">
            {sessionId ? sessionId : "No active session"}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pb-1">
            Active session
          </div>
          <div className="px-2 py-1.5 text-xs font-mono break-all border-b border-border mb-2">
            {sessionId ?? "—"}
          </div>
          <Link
            to="/sessions"
            className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-accent text-foreground"
          >
            Browse all sessions →
          </Link>
          <Link
            to="/new-analysis"
            className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-accent text-foreground"
          >
            Start new analysis →
          </Link>
        </PopoverContent>
      </Popover>

      <span className="text-border">·</span>

      {/* Active DAG selector */}
      <Popover>
        <PopoverTrigger className="flex items-center gap-1.5 h-6 px-2 rounded hover:bg-muted text-foreground transition-colors">
          <Workflow className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">DAG:</span>
          <span className="truncate max-w-[180px]">{dag ? dag.name : "Not selected"}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pb-1">
            Active DAG
          </div>
          <div className="max-h-64 overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedDagId(null)}
              className={cn(
                "w-full text-left rounded px-2 py-1.5 text-xs hover:bg-accent flex items-center justify-between",
                !selectedDagId && "bg-accent/60"
              )}
            >
              <span className="text-muted-foreground">None</span>
              {!selectedDagId && <Check className="h-3 w-3" />}
            </button>
            {dags.map((d) => (
              <button
                key={d.dag_id}
                type="button"
                onClick={() => setSelectedDagId(d.dag_id)}
                className={cn(
                  "w-full text-left rounded px-2 py-1.5 text-xs hover:bg-accent flex items-center justify-between gap-2",
                  selectedDagId === d.dag_id && "bg-accent/60"
                )}
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{d.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {d.edges.length} edges · {d.creation_mode === "llm_assisted" ? "AI" : "Manual"}
                  </div>
                </div>
                {selectedDagId === d.dag_id && <Check className="h-3 w-3 shrink-0" />}
              </button>
            ))}
          </div>
          <div className="border-t border-border mt-2 pt-1">
            <Link
              to="/discover"
              className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-accent text-foreground"
            >
              Manage DAGs →
            </Link>
          </div>
        </PopoverContent>
      </Popover>

      <span className="text-border hidden sm:inline">·</span>

      {/* Status */}
      <div className="hidden sm:flex items-center gap-1.5 ml-auto">
        {ready ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-success-soft text-success text-[10px] font-medium">
            <CircleDot className="h-2.5 w-2.5" />
            Ready
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium">
            <CircleDot className="h-2.5 w-2.5" />
            Idle
          </span>
        )}
      </div>
    </div>
  );
}
