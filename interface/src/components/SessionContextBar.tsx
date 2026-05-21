import { useSession } from "@/contexts/SessionContext";
import { useDAGLibrary } from "@/lib/dag-store";
import { usePipeline } from "@/contexts/PipelineContext";
import {
  ChevronDown, FolderKanban, Workflow, CircleDot, Check, Activity,
  Loader2, ArrowRight, Clock, HelpCircle, CheckCircle2, AlertCircle
} from "lucide-react";
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
  const { activeJob, queueStatus } = usePipeline();
  const dag = dags.find((d) => d.dag_id === selectedDagId);
  const location = useLocation();

  // Hide on Home page since the page itself summarises this
  if (location.pathname === "/") return null;

  const ready = !!sessionId || !!selectedDagId;
  const isRunning = activeJob?.status === "running";
  const isQueued = activeJob?.status === "queued";

  // Find active step description
  const activeStep = activeJob?.steps.find((s) => s.status === "running");
  const completedStepsCount = activeJob?.steps.filter((s) => s.status === "completed").length ?? 0;
  const totalStepsCount = activeJob?.steps.length ?? 0;

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

      <span className="text-border">·</span>

      {/* Pipeline Status Popover */}
      <Popover>
        <PopoverTrigger className={cn(
          "flex items-center gap-1.5 h-6 px-2 rounded hover:bg-muted text-foreground transition-colors",
          isRunning && "bg-primary-soft/40 hover:bg-primary-soft/60"
        )}>
          <Activity className={cn(
            "h-3.5 w-3.5 text-muted-foreground",
            isRunning && "text-primary animate-pulse",
            isQueued && "text-info"
          )} />
          <span className="text-muted-foreground">Pipeline:</span>
          {activeJob ? (
            <span className={cn("font-medium", isRunning ? "text-primary" : "text-info")}>
              {isRunning ? `Running (${completedStepsCount}/${totalStepsCount})` : "Queued"}
            </span>
          ) : (
            <span className="text-muted-foreground/80">Idle</span>
          )}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3 space-y-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground pb-1 border-b border-border">
            Pipeline Execution
          </div>

          {activeJob ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="font-semibold text-foreground">
                  {activeJob.pipeline_type === "causal" ? "Causal Modeling" : "Evaluation"}
                </span>
                <span className="text-muted-foreground">
                  Job: {activeJob.job_id.slice(0, 8)}
                </span>
              </div>

              {isRunning && activeStep ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                    <Loader2 className="h-3 w-3 text-primary animate-spin" />
                    <span>{activeStep.name}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1">
                    <div
                      className="bg-primary h-1 rounded-full transition-all duration-300"
                      style={{ width: `${(completedStepsCount / totalStepsCount) * 100}%` }}
                    />
                  </div>
                </div>
              ) : isQueued ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-info shrink-0" />
                  <span>Queued in sequential worker queue.</span>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground py-1">
              No active pipeline runs are currently executing. Queue is idle.
            </div>
          )}

          {queueStatus && queueStatus.queued_count > 0 && (
            <div className="text-[10px] bg-muted/60 text-muted-foreground rounded p-1.5 font-mono">
              Queue status: {queueStatus.queued_count} pending job(s)
            </div>
          )}

          <div className="border-t border-border pt-1 flex flex-col gap-0.5">
            <Link
              to="/monitor"
              className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-accent text-foreground"
            >
              Open Pipeline Monitor <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              to="/logs"
              className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-accent text-foreground"
            >
              Browse Diagnostics Logs <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </PopoverContent>
      </Popover>

      <span className="text-border hidden sm:inline">·</span>

      {/* Status */}
      <div className="hidden sm:flex items-center gap-1.5 ml-auto">
        {isRunning ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary-soft text-primary text-[10px] font-semibold animate-pulse">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Running
          </span>
        ) : isQueued ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-info-soft text-info text-[10px] font-semibold animate-pulse">
            <CircleDot className="h-2.5 w-2.5 animate-pulse" />
            Queued
          </span>
        ) : ready ? (
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
