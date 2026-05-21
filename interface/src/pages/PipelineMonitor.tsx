import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { usePipeline } from "@/contexts/PipelineContext";
import { PageHeader } from "@/components/console/PageHeader";
import { StatusPill } from "@/components/console/StatusPill";
import { KpiTile } from "@/components/console/KpiTile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity, RefreshCw, X, PlayCircle, Clock, Trash2, ExternalLink,
  ChevronRight, Terminal, AlertTriangle, AlertCircle, CheckCircle2,
  HelpCircle, ShieldCheck, Loader2, History
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from "@/components/ui/tooltip";

export default function PipelineMonitor() {
  const navigate = useNavigate();
  const {
    activeJob,
    queueStatus,
    jobs,
    loading,
    refreshJobs,
    refreshQueueStatus,
    cancelJob
  } = usePipeline();

  const [inspectedJobId, setInspectedJobId] = useState<string | null>(null);

  const handleRefresh = async () => {
    await Promise.all([refreshJobs(), refreshQueueStatus()]);
  };

  const getStatusTone = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "failed":
        return "danger";
      case "running":
        return "warning";
      case "queued":
        return "info";
      case "cancelled":
      case "interrupted":
      default:
        return "default";
    }
  };

  const relTime = (d?: string | null) => {
    if (!d) return "—";
    try {
      return formatDistanceToNow(parseISO(d), { addSuffix: true });
    } catch {
      return "—";
    }
  };

  const formatDuration = (sec?: number | null) => {
    if (sec === undefined || sec === null) return "—";
    if (sec < 1) return "< 1s";
    if (sec < 60) return `${sec.toFixed(1)}s`;
    const mins = Math.floor(sec / 60);
    const secs = Math.round(sec % 60);
    return `${mins}m ${secs}s`;
  };

  const formatMs = (ms?: number | null) => {
    if (ms === undefined || ms === null) return "";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Extract jobs currently queued (excluding the active running job if there is one)
  const activeJobId = activeJob?.job_id;
  const queuedJobs = jobs.filter(
    (j) => j.status === "queued" && j.job_id !== activeJobId
  );

  // Filter history: completed, failed, cancelled, interrupted, or active jobs that aren't currently running
  const recentJobs = jobs.filter(
    (j) => j.job_id !== activeJobId && j.status !== "queued"
  );

  const activeStepIdx = activeJob?.steps.findIndex((s) => s.status === "running") ?? -1;
  const lastCompletedIdx = activeJob
    ? [...activeJob.steps].reverse().findIndex((s) => s.status === "completed")
    : -1;

  const progressIdx = activeStepIdx !== -1
    ? activeStepIdx
    : lastCompletedIdx !== -1
    ? activeJob!.steps.length - 1 - lastCompletedIdx
    : 0;

  const totalSteps = activeJob?.steps.length ?? 1;
  const progressPercent = totalSteps > 1
    ? (progressIdx / (totalSteps - 1)) * 100
    : 0;

  const inspectedJob = jobs.find((j) => j.job_id === inspectedJobId);

  return (
    <div className="container mx-auto p-4 max-w-6xl space-y-6">
      <PageHeader
        title="Pipeline Monitor"
        description="Real-time progress tracking, sequential queue status, and run execution history."
        breadcrumbs={[{ label: "Causal Lab" }, { label: "Pipeline Monitor" }]}
        icon={<Activity className="h-5 w-5 text-primary" />}
        actions={
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Status
          </Button>
        }
      />

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          label="Execution Worker"
          value={activeJob?.status === "running" ? "Active" : "Idle"}
          icon={<Activity className={`h-4 w-4 ${activeJob?.status === "running" ? "text-warning animate-pulse" : "text-muted-foreground"}`} />}
          hint={activeJob?.status === "running" ? `Running job: ${activeJob.job_id.slice(0, 8)}` : "Worker waiting for jobs"}
        />
        <KpiTile
          label="Queue Occupancy"
          value={`${queueStatus?.queued_count ?? 0} / ${queueStatus?.max_queued ?? 3}`}
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          hint="Sequential FIFO capacity"
        />
        <KpiTile
          label="Success Rate"
          value={
            jobs.length > 0
              ? `${Math.round(
                  (jobs.filter((j) => j.status === "completed").length / jobs.length) * 100
                )}%`
              : "—"
          }
          icon={<ShieldCheck className="h-4 w-4 text-success" />}
          hint={`${jobs.filter((j) => j.status === "completed").length} of ${jobs.length} completed`}
        />
        <KpiTile
          label="Recent Failures"
          value={jobs.filter((j) => j.status === "failed" || j.status === "interrupted").length}
          icon={<AlertCircle className="h-4 w-4 text-danger" />}
          hint="Runs failing convergence or limits"
          className={
            jobs.filter((j) => j.status === "failed" || j.status === "interrupted").length > 0
              ? "border-danger/20 bg-danger-soft/10"
              : ""
          }
        />
      </div>

      {/* Active Run Card */}
      <Card className="border border-border/80 shadow-md">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {activeJob?.status === "running" && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${activeJob?.status === "running" ? "bg-warning" : activeJob?.status === "queued" ? "bg-info" : "bg-muted-foreground"}`}></span>
              </span>
              Active Pipeline Execution
            </CardTitle>
            <CardDescription>
              {activeJob
                ? `Job ${activeJob.job_id.slice(0, 8)} submission details`
                : "No active pipelines currently running."}
            </CardDescription>
          </div>
          {activeJob && (
            <div className="flex items-center gap-2">
              <StatusPill tone={getStatusTone(activeJob.status)}>{activeJob.status}</StatusPill>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 gap-1"
                onClick={() => cancelJob(activeJob.job_id)}
              >
                <X className="h-3.5 w-3.5" />
                Cancel Run
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-6">
          {activeJob ? (
            <div className="space-y-6">
              {/* Job Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono border-b border-border/40 pb-4">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-sans">Job Type</span>
                  <span className="font-semibold text-foreground">
                    {activeJob.pipeline_type === "causal" ? "Causal Modeling 🧠" : "Evaluation Run 🔬"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-sans">Session ID</span>
                  <span className="truncate block" title={activeJob.session_id}>
                    {activeJob.session_id.slice(0, 12)}...
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-sans">Submitted At</span>
                  <span>{relTime(activeJob.submitted_at)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-sans">Elapsed Duration</span>
                  <span className="flex items-center gap-1 font-sans">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {activeJob.started_at
                      ? `${Math.round((Date.now() - new Date(activeJob.started_at).getTime()) / 1000)}s`
                      : "Waiting to start..."}
                  </span>
                </div>
              </div>

              {/* Stepper progress description */}
              {activeJob.status === "queued" ? (
                <div className="flex items-center justify-center p-6 bg-surface-sunken rounded-lg border border-border border-dashed text-center">
                  <div className="space-y-2">
                    <Loader2 className="h-8 w-8 text-info animate-spin mx-auto" />
                    <h4 className="font-medium text-sm text-foreground">Job is Queued</h4>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      This job is queued and waiting for execution slot. It will start automatically when the running task finishes.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Stepper Desktop Layout */}
                  <div className="hidden md:block">
                    <div className="relative flex justify-between items-start w-full px-4">
                      {/* Connection bar background */}
                      <div className="absolute top-4 left-8 right-8 h-0.5 bg-border -z-10" />
                      {/* Connected animated bar */}
                      <div
                        className="absolute top-4 left-8 h-0.5 bg-primary -z-10 transition-all duration-500"
                        style={{ width: `calc(${progressPercent}% - 16px)` }}
                      />

                      {activeJob.steps.map((step, idx) => {
                        const isPending = step.status === "pending";
                        const isRunning = step.status === "running";
                        const isCompleted = step.status === "completed";
                        const isFailed = step.status === "failed";

                        return (
                          <div key={step.step_number} className="flex flex-col items-center w-28 text-center relative">
                            {/* Circle Node */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                                      isCompleted
                                        ? "bg-success border-success text-white shadow-md shadow-success/15"
                                        : isRunning
                                        ? "bg-primary border-primary text-white shadow-md shadow-primary/25 animate-pulse"
                                        : isFailed
                                        ? "bg-danger border-danger text-white shadow-md shadow-danger/15"
                                        : "bg-surface border-border text-muted-foreground"
                                    }`}
                                  >
                                    {isCompleted ? (
                                      <CheckCircle2 className="h-4 w-4" />
                                    ) : isRunning ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : isFailed ? (
                                      <X className="h-4 w-4" />
                                    ) : (
                                      <span className="text-xs font-semibold">{step.step_number}</span>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <div className="text-xs space-y-1">
                                    <div className="font-semibold">{step.name}</div>
                                    <div className="text-muted-foreground text-[10px]">
                                      Status: <span className="capitalize">{step.status}</span>
                                    </div>
                                    {step.detail && <div className="text-foreground">{step.detail}</div>}
                                    {step.error && <div className="text-danger font-mono text-[9px]">{step.error}</div>}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            {/* Label */}
                            <span className={`text-[11px] font-medium mt-2 leading-tight ${isRunning ? "text-primary font-bold" : "text-muted-foreground"}`}>
                              {step.name}
                            </span>
                            {/* Time & detail snippet */}
                            {step.duration_ms !== null && step.duration_ms !== undefined && (
                              <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                {formatMs(step.duration_ms)}
                              </span>
                            )}
                            {step.detail && (
                              <span className="text-[9px] bg-surface-sunken text-muted-foreground border border-border/40 rounded px-1 mt-1 truncate max-w-[100px]" title={step.detail}>
                                {step.detail}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stepper Mobile Layout */}
                  <div className="md:hidden space-y-4">
                    {activeJob.steps.map((step) => {
                      const isPending = step.status === "pending";
                      const isRunning = step.status === "running";
                      const isCompleted = step.status === "completed";
                      const isFailed = step.status === "failed";

                      return (
                        <div key={step.step_number} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center border-2 shrink-0 ${
                                isCompleted
                                  ? "bg-success border-success text-white"
                                  : isRunning
                                  ? "bg-primary border-primary text-white animate-pulse"
                                  : isFailed
                                  ? "bg-danger border-danger text-white"
                                  : "bg-surface border-border text-muted-foreground"
                              }`}
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : isRunning ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : isFailed ? (
                                <X className="h-3 w-3" />
                              ) : (
                                <span className="text-[10px] font-semibold">{step.step_number}</span>
                              )}
                            </div>
                            <div className="w-0.5 h-full bg-border mt-1" />
                          </div>
                          <div className="flex-1 pb-4 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h5 className={`text-xs font-semibold ${isRunning ? "text-primary" : "text-foreground"}`}>
                                {step.name}
                              </h5>
                              <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                                {formatMs(step.duration_ms)}
                              </span>
                            </div>
                            {step.detail && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 italic">{step.detail}</p>
                            )}
                            {step.error && (
                              <div className="text-[10px] text-danger font-mono mt-1 p-2 bg-danger-soft/10 border border-danger/10 rounded">
                                {step.error}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Exception Trace Panel */}
              {(activeJob.error || activeJob.steps.some((s) => s.status === "failed")) && (
                <div className="p-4 bg-surface-sunken border border-danger/30 rounded-lg text-left overflow-x-auto font-mono text-[11px] text-danger">
                  <div className="flex items-center gap-1.5 font-bold mb-2 text-danger">
                    <AlertTriangle className="h-4 w-4" /> Pipeline Run Log Failure
                  </div>
                  <pre className="whitespace-pre-wrap">
                    {activeJob.steps.find((s) => s.status === "failed")?.error ||
                      activeJob.error ||
                      "System execution exception. See console output."}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-foreground">No active pipeline executes</h4>
                <p className="text-xs text-muted-foreground max-w-sm">
                  The background workers are currently idle. Start a new causal mapping or model training pipeline to run analysis.
                </p>
              </div>
              <Button size="sm" asChild className="h-8">
                <Link to="/new-analysis">
                  <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                  New Analysis Wizard
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Queue Section */}
      {queuedJobs.length > 0 && (
        <Card className="border border-border/80">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-info" /> Job Queue List
            </CardTitle>
            <CardDescription>
              Sequence of pending jobs in queue. Maximum concurrent runner is 1.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {queuedJobs.map((job, index) => (
                <li key={job.job_id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                  <div className="flex items-center gap-3">
                    <span className="h-6 w-6 rounded-full bg-info-soft text-info flex items-center justify-center font-mono text-xs font-semibold shrink-0">
                      #{index + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground">
                          {job.pipeline_type === "causal" ? "Causal Modeling" : "Evaluation Pipeline"}
                        </span>
                        <StatusPill tone="info">queued</StatusPill>
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground space-x-2 mt-0.5">
                        <span>Job: {job.job_id.slice(0, 8)}</span>
                        <span>•</span>
                        <span>Session: {job.session_id.slice(0, 8)}</span>
                        <span>•</span>
                        <span>Submitted {relTime(job.submitted_at)}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-danger hover:bg-danger-soft/20"
                    onClick={() => cancelJob(job.job_id)}
                    title="Cancel queued run"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* History Section */}
      <Card className="border border-border/80">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" /> Pipeline History
          </CardTitle>
          <CardDescription>
            Audited execution list of past modeling and evaluation pipelines.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {recentJobs.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No historical runs found. Completed jobs will show here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Pipeline Job</TableHead>
                    <TableHead>Session ID</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentJobs.map((job) => {
                    const isCompleted = job.status === "completed";
                    const isFailed = job.status === "failed" || job.status === "interrupted";

                    return (
                      <TableRow key={job.job_id} className="hover:bg-muted/20">
                        <TableCell className="font-medium text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-foreground">
                              {job.pipeline_type === "causal" ? "Causal Modeling" : "Evaluation"}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {job.job_id.slice(0, 8)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">
                          {job.session_id.slice(0, 12)}...
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {relTime(job.submitted_at)}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {formatDuration(job.duration_seconds)}
                        </TableCell>
                        <TableCell>
                          <StatusPill tone={getStatusTone(job.status)}>{job.status}</StatusPill>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isCompleted && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs px-2 text-primary hover:text-primary-foreground hover:bg-primary gap-1"
                                asChild
                              >
                                <Link to={`/dashboard?session_id=${job.session_id}`}>
                                  <ExternalLink className="h-3 w-3" />
                                  Dashboard
                                </Link>
                              </Button>
                            )}
                            {isFailed && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs px-2 text-danger hover:text-danger-foreground hover:bg-danger gap-1"
                                onClick={() => setInspectedJobId(job.job_id)}
                              >
                                <Terminal className="h-3 w-3" />
                                Inspect Error
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inspect Error Dialog */}
      <Dialog open={!!inspectedJobId} onOpenChange={(open) => !open && setInspectedJobId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger text-base">
              <AlertTriangle className="h-5 w-5" /> Inspect Pipeline Failure Trace
            </DialogTitle>
            <DialogDescription className="font-mono text-[11px]">
              Job ID: {inspectedJob?.job_id} | Session: {inspectedJob?.session_id}
            </DialogDescription>
          </DialogHeader>
          {inspectedJob && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-muted/40 p-3 rounded border border-border">
                <div>
                  <span className="text-muted-foreground block text-[10px] font-sans">SUBMITTED</span>
                  {new Date(inspectedJob.submitted_at).toLocaleString()}
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] font-sans">DURATION</span>
                  {formatDuration(inspectedJob.duration_seconds)}
                </div>
              </div>

              {/* Steps overview */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-foreground">Step Execution Summary:</h4>
                <div className="border border-border rounded overflow-hidden divide-y divide-border text-xs">
                  {inspectedJob.steps.map((step) => (
                    <div key={step.step_number} className="flex items-center justify-between p-2.5 bg-surface">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-muted-foreground font-mono text-[11px]">
                          #{step.step_number}
                        </span>
                        <span>{step.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatMs(step.duration_ms)}
                        </span>
                        <StatusPill tone={getStatusTone(step.status)}>{step.status}</StatusPill>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expanded Error block */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Terminal className="h-3.5 w-3.5" /> Exception Traceback:
                </h4>
                <div className="bg-surface-sunken border border-border/80 rounded p-4 font-mono text-[11px] text-danger max-h-72 overflow-y-auto whitespace-pre-wrap">
                  {inspectedJob.steps.find((s) => s.status === "failed")?.error ||
                    inspectedJob.error ||
                    "No traceback or exception text saved for this run."}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
