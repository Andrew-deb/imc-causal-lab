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
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from "@/components/ui/tooltip";
import { api, SessionSummary, PipelineStep, PipelineJob } from "@/lib/api";

interface PipelineFlowProps {
  steps: PipelineStep[];
  status: string;
}

export function PipelineFlow({ steps, status }: PipelineFlowProps) {
  const getStepIcon = (stepStatus: string, stepNumber: number) => {
    switch (stepStatus) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-success shrink-0" />;
      case "failed":
        return <X className="h-4 w-4 text-danger shrink-0" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-warning animate-spin shrink-0" />;
      case "skipped":
        return <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
      case "pending":
      default:
        return (
          <span className="text-[10px] font-mono font-bold bg-muted text-muted-foreground w-4 h-4 rounded-full flex items-center justify-center shrink-0">
            {stepNumber}
          </span>
        );
    }
  };

  const formatMs = (ms?: number | null) => {
    if (ms === undefined || ms === null) return "";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="w-full overflow-x-auto py-3 px-1 flex items-center gap-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
      {steps.map((step, idx) => {
        const isCompleted = step.status === "completed";
        const isRunning = step.status === "running";
        const isFailed = step.status === "failed";
        const isPending = step.status === "pending";

        let cardBorderColor = "border-border";
        let cardBg = "bg-card";
        let cardShadow = "";

        if (isCompleted) {
          cardBorderColor = "border-success/60 hover:border-success";
          cardBg = "bg-success/5";
        } else if (isRunning) {
          cardBorderColor = "border-warning bg-warning/5 animate-pulse border-2";
          cardShadow = "shadow-md shadow-warning/10";
        } else if (isFailed) {
          cardBorderColor = "border-danger";
          cardBg = "bg-danger/5";
          cardShadow = "shadow-sm shadow-danger/10";
        } else if (isPending) {
          cardBg = "bg-muted/10 opacity-70";
        }

        return (
          <React.Fragment key={step.step_number}>
            {/* Step Card */}
            <div
              className={`w-48 h-20 shrink-0 rounded-lg border p-2.5 relative overflow-hidden flex flex-col justify-between transition-all duration-300 ${cardBorderColor} ${cardBg} ${cardShadow}`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className={`text-[10px] font-semibold tracking-wide leading-tight truncate pr-1 ${isRunning ? "text-warning" : "text-foreground"}`}>
                  {step.name}
                </span>
                {getStepIcon(step.status, step.step_number)}
              </div>

              <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono mt-1 z-10">
                {step.duration_ms !== null && step.duration_ms !== undefined ? (
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {formatMs(step.duration_ms)}
                  </span>
                ) : isRunning ? (
                  <span className="flex items-center gap-1 text-[9px] font-sans font-medium text-warning">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning animate-pulse-glowing"></span>
                    </span>
                    In Progress
                  </span>
                ) : (
                  <span />
                )}
                {step.detail && (
                  <span 
                    className="max-w-[100px] pr-1 truncate bg-muted/40 px-1 py-0.2 rounded font-sans" 
                    title={step.detail}
                  >
                    {step.detail}
                  </span>
                )}
              </div>

              {/* Progress animation bar at the very bottom border of the card */}
              {isRunning && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-warning/10 overflow-hidden">
                  <div className="h-full bg-warning w-1/3 rounded-full animate-progress-infinite" />
                </div>
              )}
            </div>

            {/* Connecting Chevron Arrow */}
            {idx < steps.length - 1 && (
              <div className="flex items-center justify-center shrink-0 px-1">
                <ChevronRight
                  className={`h-4 w-4 transition-colors duration-300 ${
                    isCompleted
                      ? "text-success"
                      : isRunning
                      ? "text-warning animate-pulse"
                      : "text-muted-foreground/30"
                  }`}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

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
  const [sessionsList, setSessionsList] = useState<SessionSummary[]>([]);

  const fetchSessions = async () => {
    try {
      const list = await api.getSessions();
      setSessionsList(list);
    } catch (e) {
      console.error("Failed to fetch sessions metadata:", e);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([refreshJobs(), refreshQueueStatus(), fetchSessions()]);
  };

  React.useEffect(() => {
    fetchSessions();
  }, []);

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

  const formatRows = (num?: number) => {
    if (num === undefined || num === null) return "0";
    if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
    return num.toLocaleString();
  };

  // Group jobs by run_id (or fallback to session_id / job_id for legacy jobs)
  const groupJobsByRun = (jobsList: PipelineJob[]) => {
    const groups: Record<string, PipelineJob[]> = {};
    jobsList.forEach(job => {
      const runKey = job.run_id || job.session_id || job.job_id;
      if (!groups[runKey]) {
        groups[runKey] = [];
      }
      groups[runKey].push(job);
    });

    return Object.entries(groups).map(([runId, runJobs]) => {
      const earliestJob = [...runJobs].sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())[0];
      const sessionId = earliestJob.session_id;
      const sessionSummary = sessionsList.find(s => s.session_id === sessionId);
      
      // Sort jobs by submitted_at ascending for creation time, descending for latest
      const sortedJobs = [...runJobs].sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
      const latestJob = sortedJobs[sortedJobs.length - 1];

      let overallStatus = latestJob.status;
      const hasRunning = runJobs.some(j => j.status === "running");
      const hasQueued = runJobs.some(j => j.status === "queued");
      const hasCompleted = runJobs.some(j => j.status === "completed");

      if (hasRunning) {
        overallStatus = "running";
      } else if (hasQueued) {
        overallStatus = "queued";
      } else if (hasCompleted) {
        overallStatus = "completed";
      }

      const totalDuration = runJobs.reduce((acc, j) => acc + (j.duration_seconds || 0), 0);

      return {
        run_id: runId,
        session_id: sessionId,
        created_at: earliestJob.submitted_at,
        last_active: latestJob.submitted_at,
        jobs: sortedJobs, // sorted chronological list of runs
        status: overallStatus,
        dataset_meta: sessionSummary?.dataset_meta || earliestJob.config?.dataset_meta || null,
        total_duration: totalDuration,
      };
    }).sort((a, b) => new Date(b.last_active).getTime() - new Date(a.last_active).getTime());
  };

  const groupedRuns = groupJobsByRun(jobs);

  const successRate = groupedRuns.length > 0
    ? `${Math.round((groupedRuns.filter(r => r.status === "completed").length / groupedRuns.length) * 100)}%`
    : "—";

  const recentFailures = groupedRuns.filter(
    (r) => r.status === "failed" || r.status === "interrupted"
  ).length;

  // Extract jobs currently queued (excluding the active running job if there is one)
  const activeJobId = activeJob?.job_id;
  const queuedJobs = jobs.filter(
    (j) => j.status === "queued" && j.job_id !== activeJobId
  );

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
                <PipelineFlow steps={activeJob.steps} status={activeJob.status} />
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
          {groupedRuns.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No historical runs found. Completed sessions will show here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pipeline Run</TableHead>
                    <TableHead>Dataset Context</TableHead>
                    <TableHead>Execution Stages</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Total Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedRuns.map((run) => {
                    const hasResults = run.status === "completed";
                    const formattedRunId = run.run_id.startsWith("run_")
                      ? run.run_id.slice(4, 16)
                      : run.run_id.slice(0, 12);

                    return (
                      <TableRow key={run.run_id} className="hover:bg-muted/20">
                        {/* Pipeline Run ID & Session ID */}
                        <TableCell className="font-medium text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-foreground truncate max-w-[150px]" title={run.run_id}>
                              Run: {formattedRunId}...
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={run.session_id}>
                              Session: {run.session_id.slice(0, 12)}...
                            </span>
                          </div>
                        </TableCell>

                        {/* Dataset Context */}
                        <TableCell className="text-xs">
                          {run.dataset_meta ? (
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              Customers: {formatRows(run.dataset_meta.customers_rows)} | Transactions: {formatRows(run.dataset_meta.transactions_rows)} | Campaigns: {formatRows(run.dataset_meta.campaigns_rows)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">No dataset meta</span>
                          )}
                        </TableCell>

                        {/* Execution Stages */}
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {run.jobs.map((job) => {
                              let dotColor = "bg-muted-foreground";
                              if (job.status === "completed") dotColor = "bg-success";
                              else if (job.status === "running") dotColor = "bg-warning";
                              else if (job.status === "failed" || job.status === "interrupted") dotColor = "bg-danger";
                              else if (job.status === "queued") dotColor = "bg-info";

                              return (
                                <span
                                  key={job.job_id}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-muted/60 text-muted-foreground border border-border/80"
                                >
                                  <span className={`relative flex h-1.5 w-1.5`}>
                                    {job.status === "running" && (
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
                                    )}
                                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColor}`}></span>
                                  </span>
                                  {job.pipeline_type === "causal" ? "Causal Modeling" : "Evaluation"}
                                </span>
                              );
                            })}
                          </div>
                        </TableCell>

                        {/* Last Active */}
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {relTime(run.last_active)}
                        </TableCell>

                        {/* Total Duration */}
                        <TableCell className="text-xs font-mono whitespace-nowrap">
                          {formatDuration(run.total_duration)}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <StatusPill tone={getStatusTone(run.status)}>{run.status}</StatusPill>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground gap-1"
                              asChild
                            >
                              <Link to={`/monitor/${run.run_id}`}>
                                View Details
                              </Link>
                            </Button>
                            {hasResults && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs px-2 text-primary hover:text-primary-foreground hover:bg-primary gap-1"
                                asChild
                              >
                                <Link to={`/dashboard?session_id=${run.session_id}`}>
                                  <ExternalLink className="h-3 w-3" />
                                  Dashboard
                                </Link>
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
    </div>
  );
}
