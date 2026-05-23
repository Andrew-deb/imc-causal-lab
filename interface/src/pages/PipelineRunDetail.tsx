import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { usePipeline } from "@/contexts/PipelineContext";
import { PageHeader } from "@/components/console/PageHeader";
import { StatusPill } from "@/components/console/StatusPill";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity, RefreshCw, X, PlayCircle, Clock, ExternalLink,
  AlertTriangle, AlertCircle, ShieldCheck, Loader2, ArrowLeft, Database
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { api, SessionSummary, PipelineJob } from "@/lib/api";
import { PipelineFlow } from "./PipelineMonitor";

export default function PipelineRunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const {
    jobs,
    loading,
    refreshJobs
  } = usePipeline();

  const [sessionsList, setSessionsList] = useState<SessionSummary[]>([]);
  const [fetchingSessions, setFetchingSessions] = useState(false);

  const fetchSessions = async () => {
    setFetchingSessions(true);
    try {
      const list = await api.getSessions();
      setSessionsList(list);
    } catch (e) {
      console.error("Failed to fetch sessions metadata:", e);
    } finally {
      setFetchingSessions(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRefresh = async () => {
    await Promise.all([refreshJobs(), fetchSessions()]);
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

    return Object.entries(groups).map(([id, runJobs]) => {
      const earliestJob = [...runJobs].sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())[0];
      const sessionId = earliestJob.session_id;
      const sessionSummary = sessionsList.find(s => s.session_id === sessionId);
      
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
        run_id: id,
        session_id: sessionId,
        created_at: earliestJob.submitted_at,
        last_active: latestJob.submitted_at,
        jobs: sortedJobs,
        status: overallStatus,
        dataset_meta: sessionSummary?.dataset_meta || earliestJob.config?.dataset_meta || null,
        total_duration: totalDuration,
      };
    });
  };

  const groupedRuns = groupJobsByRun(jobs);
  const run = groupedRuns.find(r => r.run_id === runId);

  // If loading and run not found yet
  if (loading && !run) {
    return (
      <div className="container mx-auto p-4 max-w-6xl flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading pipeline run details...</p>
      </div>
    );
  }

  // If not loading and run not found
  if (!run) {
    return (
      <div className="container mx-auto p-4 max-w-6xl space-y-6">
        <PageHeader
          title="Run Details"
          description="Pipeline run execution not found."
          breadcrumbs={[{ label: "Causal Lab", to: "/" }, { label: "Pipeline Monitor", to: "/monitor" }, { label: "Run details" }]}
          icon={<AlertCircle className="h-5 w-5 text-danger" />}
        />
        <Card className="border border-danger/20 bg-danger-soft/10 p-6 flex flex-col items-center text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-danger" />
          <div className="space-y-1">
            <h4 className="font-semibold text-base text-foreground">Pipeline Run Not Found</h4>
            <p className="text-xs text-muted-foreground max-w-sm">
              The run ID "{runId}" could not be found in active or historical executions.
            </p>
          </div>
          <Button size="sm" asChild>
            <Link to="/monitor">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Back to Pipeline Monitor
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  const hasResults = run.status === "completed";

  return (
    <div className="container mx-auto p-4 max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 shadow-none hover:bg-muted/50" onClick={() => navigate("/monitor")}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Monitor
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Details
        </Button>
      </div>

      <PageHeader
        title={`Pipeline Run Details`}
        description={`Detailed status, metrics, and sequential execution logs for pipeline run.`}
        breadcrumbs={[{ label: "Causal Lab", to: "/" }, { label: "Pipeline Monitor", to: "/monitor" }, { label: `Run: ${run.run_id.startsWith("run_") ? run.run_id.slice(4, 16) : run.run_id.slice(0, 12)}...` }]}
        icon={<Activity className="h-5 w-5 text-primary" />}
      />

      {/* Main Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Metrics and Parameters */}
        <div className="md:col-span-1 space-y-6">
          <Card className="border border-border/80 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" /> Run Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <span className="text-muted-foreground block text-[10px] font-sans font-medium uppercase tracking-wider">Run ID</span>
                <span className="text-foreground block bg-muted/40 p-1.5 rounded truncate" title={run.run_id}>{run.run_id}</span>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground block text-[10px] font-sans font-medium uppercase tracking-wider">Session ID</span>
                <span className="text-foreground block bg-muted/40 p-1.5 rounded truncate" title={run.session_id}>{run.session_id}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <span className="text-muted-foreground block text-[10px] font-sans font-medium uppercase tracking-wider">Status</span>
                  <div className="mt-1">
                    <StatusPill tone={getStatusTone(run.status)}>{run.status}</StatusPill>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] font-sans font-medium uppercase tracking-wider">Total Duration</span>
                  <span className="text-foreground block font-bold text-sm mt-1">{formatDuration(run.total_duration)}</span>
                </div>
              </div>
              <div className="border-t border-border/40 pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-sans">Created:</span>
                  <span className="text-foreground font-bold">{new Date(run.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-sans">Last Active:</span>
                  <span className="text-foreground font-bold">{relTime(run.last_active)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dataset Context Card */}
          <Card className="border border-border/80 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Database className="h-4 w-4 text-primary" /> Dataset Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {run.dataset_meta ? (
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-muted/40 border rounded-md">
                    <span className="text-muted-foreground block text-[10px]">Customers</span>
                    <span className="font-mono font-bold text-foreground text-sm">
                      {formatRows(run.dataset_meta.customers_rows)}
                    </span>
                  </div>
                  <div className="p-2 bg-muted/40 border rounded-md">
                    <span className="text-muted-foreground block text-[10px]">Transactions</span>
                    <span className="font-mono font-bold text-foreground text-sm">
                      {formatRows(run.dataset_meta.transactions_rows)}
                    </span>
                  </div>
                  <div className="p-2 bg-muted/40 border rounded-md">
                    <span className="text-muted-foreground block text-[10px]">Campaigns</span>
                    <span className="font-mono font-bold text-foreground text-sm">
                      {formatRows(run.dataset_meta.campaigns_rows)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-muted-foreground font-sans">
                  No dataset metadata available for this run.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Interactive Dashboard Shortcut */}
          {hasResults && (
            <Button asChild className="w-full gap-1.5 shadow-sm">
              <Link to={`/dashboard?session_id=${run.session_id}`}>
                <ExternalLink className="h-4 w-4" />
                Go to Interactive Dashboard
              </Link>
            </Button>
          )}
        </div>

        {/* Right Column: Execution sequence and jobs */}
        <div className="md:col-span-2 space-y-6">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Associated Jobs ({run.jobs.length})</h3>
          </div>

          <div className="space-y-6">
            {run.jobs.map((job, jIdx) => {
              const isCompleted = job.status === "completed";
              const isFailed = job.status === "failed" || job.status === "interrupted";
              const isCausal = job.pipeline_type === "causal";

              return (
                <Card key={job.job_id} className="border border-border/80 rounded-lg overflow-hidden bg-card shadow-sm">
                  {/* Job Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-muted/40 border-b border-border/60 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground font-sans">
                        #{jIdx + 1} {isCausal ? "Causal Modeling Pipeline" : "Evaluation Pipeline"}
                      </span>
                      <span className="text-muted-foreground text-[10px]">({job.job_id.slice(0, 8)})</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                      <span>Submitted: {new Date(job.submitted_at).toLocaleTimeString()}</span>
                      <span>•</span>
                      <span>Duration: {formatDuration(job.duration_seconds)}</span>
                      <StatusPill tone={getStatusTone(job.status)}>{job.status}</StatusPill>
                    </div>
                  </div>

                  {/* Job Steps Flow */}
                  <CardContent className="p-4 bg-card">
                    <PipelineFlow steps={job.steps} status={job.status} />

                    {/* Exception traceback */}
                    {(job.error || job.steps.some(s => s.status === "failed")) && (
                      <div className="mt-4 p-3 bg-surface-sunken border border-danger/25 rounded-md text-left overflow-x-auto font-mono text-[10px] text-danger max-h-60 overflow-y-auto">
                        <div className="flex items-center gap-1.5 font-bold mb-1 text-danger">
                          <AlertTriangle className="h-3.5 w-3.5" /> Pipeline Execution Error Traceback
                        </div>
                        <pre className="whitespace-pre-wrap leading-relaxed">
                          {job.steps.find((s) => s.status === "failed")?.error ||
                            job.error ||
                            "No traceback or exception text saved for this run."}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
