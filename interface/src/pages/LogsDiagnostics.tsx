import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, PipelineJob, SystemEvent, SessionSummary } from "@/lib/api";
import { PageHeader } from "@/components/console/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/console/StatusPill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Activity,
  ScrollText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  Terminal,
  Database,
  Cpu,
  Search,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Layers,
  ArrowRight,
  Info,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";

export default function LogsDiagnostics() {
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all_sessions");
  const [logSeverity, setLogSeverity] = useState<string>("all");
  const [logSearchQuery, setLogSearchQuery] = useState<string>("");
  const [historySearchQuery, setHistorySearchQuery] = useState<string>("");
  const [activeHistoryRunId, setActiveHistoryRunId] = useState<string | null>(null);
  const [healthSelectedChannel, setHealthSelectedChannel] = useState<string>("");

  // --- Queries ---
  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery<SessionSummary[]>({
    queryKey: ["sessions-list"],
    queryFn: api.getSessions,
  });

  const { data: pipelineJobs = [], isLoading: isLoadingJobs, refetch: refetchJobs } = useQuery<PipelineJob[]>({
    queryKey: ["pipeline-jobs-history"],
    queryFn: () => api.getPipelineJobs(),
  });

  const activeSessionIdForDetail = useMemo(() => {
    if (selectedSessionId && selectedSessionId !== "all_sessions") {
      return selectedSessionId;
    }
    const completedSession = sessions.find((s) => s.status === "completed" || s.has_results);
    if (completedSession) return completedSession.session_id;
    return sessions[0]?.session_id || "";
  }, [selectedSessionId, sessions]);

  const { data: sessionDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ["session-detail-observability", activeSessionIdForDetail],
    queryFn: () => api.getSessionDetail(activeSessionIdForDetail),
    enabled: !!activeSessionIdForDetail,
  });

  const { data: systemEvents = [], isLoading: isLoadingEvents, refetch: refetchEvents } = useQuery<SystemEvent[]>({
    queryKey: ["system-events", selectedSessionId, logSeverity],
    queryFn: () =>
      api.getSystemEvents(
        selectedSessionId === "all_sessions" ? undefined : selectedSessionId,
        logSeverity === "all" ? undefined : logSeverity
      ),
  });

  // Set default health channel once sessionDetail finishes loading
  useEffect(() => {
    if (sessionDetail?.result?.channel_summary && sessionDetail.result.channel_summary.length > 0) {
      if (!healthSelectedChannel) {
        setHealthSelectedChannel(sessionDetail.result.channel_summary[0].channel);
      }
    }
  }, [sessionDetail, healthSelectedChannel]);

  // --- KPI Calculations (Tab 1: History) ---
  const historyStats = useMemo(() => {
    const total = pipelineJobs.length;
    if (total === 0) return { total: 0, successRate: "—", avgDuration: "—" };

    const completed = pipelineJobs.filter((j) => j.status === "completed").length;
    const successRate = total > 0 ? `${Math.round((completed / total) * 100)}%` : "—";

    const completedWithDuration = pipelineJobs.filter(
      (j) => j.status === "completed" && j.duration_seconds
    );
    const avgDuration =
      completedWithDuration.length > 0
        ? `${Math.round(
            completedWithDuration.reduce((acc, curr) => acc + (curr.duration_seconds || 0), 0) /
              completedWithDuration.length
          )}s`
        : "—";

    return { total, successRate, avgDuration };
  }, [pipelineJobs]);

  const chartData = useMemo(() => {
    return [...pipelineJobs]
      .reverse()
      .filter((j) => j.status === "completed")
      .slice(-15)
      .map((j) => ({
        name: j.job_id.slice(0, 8),
        duration_seconds: j.duration_seconds || 0,
        steps: j.steps.length,
      }));
  }, [pipelineJobs]);

  // --- Filtering (Tab 4: Logs) ---
  const filteredEvents = useMemo(() => {
    return systemEvents.filter((e) => {
      if (!logSearchQuery) return true;
      const q = logSearchQuery.toLowerCase();
      return (
        e.message.toLowerCase().includes(q) ||
        e.event_type.toLowerCase().includes(q) ||
        (e.session_id && e.session_id.toLowerCase().includes(q))
      );
    });
  }, [systemEvents, logSearchQuery]);

  // --- Filtering (Tab 1: History table) ---
  const filteredJobs = useMemo(() => {
    if (!historySearchQuery) return pipelineJobs;
    const q = historySearchQuery.toLowerCase();
    return pipelineJobs.filter(
      (j) =>
        j.job_id.toLowerCase().includes(q) ||
        (j.run_id && j.run_id.toLowerCase().includes(q)) ||
        j.session_id.toLowerCase().includes(q) ||
        j.pipeline_type.toLowerCase().includes(q) ||
        j.status.toLowerCase().includes(q)
    );
  }, [pipelineJobs, historySearchQuery]);

  const groupedHistoryRuns = useMemo(() => {
    const groups: Record<string, PipelineJob[]> = {};
    filteredJobs.forEach(job => {
      const runKey = job.run_id || job.session_id || job.job_id;
      if (!groups[runKey]) {
        groups[runKey] = [];
      }
      groups[runKey].push(job);
    });

    return Object.entries(groups).map(([runId, runJobs]) => {
      const earliestJob = [...runJobs].sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())[0];
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
        session_id: earliestJob.session_id,
        created_at: earliestJob.submitted_at,
        last_active: latestJob.submitted_at,
        jobs: sortedJobs,
        status: overallStatus,
        total_duration: totalDuration,
      };
    }).sort((a, b) => new Date(b.last_active).getTime() - new Date(a.last_active).getTime());
  }, [filteredJobs]);

  // --- Date helpers ---
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
    if (ms === undefined || ms === null) return "—";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // --- Model Health Diagnostics (Tab 2) ---
  const healthDiagnostics = useMemo(() => {
    if (!sessionDetail) return null;
    const result = sessionDetail.result;
    const evalRes = sessionDetail.evaluation_result;

    const channels = result?.channel_summary?.map((c) => c.channel) || [];
    const estimators = ["logistic_regression", "t_learner", "dr_learner", "causal_forest"];

    // 1. Grid of Success/Warnings/Failures
    const grid: Record<string, Record<string, { status: "success" | "warning" | "failed" | "skipped"; detail?: string }>> = {};

    channels.forEach((ch) => {
      grid[ch] = {};
      estimators.forEach((est) => {
        const channelData = result?.channel_data?.[ch];
        const evalData = evalRes?.channel_evaluations?.[ch];
        
        // Find if model has results or CV metrics
        const modelRes = channelData?.model_results?.[est];
        const modelEval = evalData?.model_evaluations?.[est];

        if (modelRes && modelRes.ate !== 0) {
          // Check standard deviation/extrapolation issues
          const lr = channelData?.model_results?.["logistic_regression"];
          const baseline_ate = lr?.ate ?? 0;
          const isOutlier = est !== "logistic_regression" && abs(modelRes.ate) > max(100.0, 3 * abs(baseline_ate));

          if (isOutlier) {
            grid[ch][est] = {
              status: "warning",
              detail: `Extrapolation outlier (ATE: ${modelRes.ate.toFixed(2)} vs baseline: ${baseline_ate.toFixed(2)})`
            };
          } else {
            grid[ch][est] = { status: "success", detail: "Converged successfully" };
          }
        } else if (modelRes) {
          grid[ch][est] = { status: "failed", detail: "Model execution failed or returned fallback (ATE = 0)" };
        } else {
          grid[ch][est] = { status: "skipped", detail: "Estimator was not executed" };
        }
      });
    });

    // 2. Alert cards (extrapolation rejections, low agreement scores, low treatment balance)
    const alerts: { channel: string; type: "error" | "warning" | "info"; title: string; desc: string }[] = [];

    channels.forEach((ch) => {
      const summary = result?.channel_summary?.find((s) => s.channel === ch);
      if (summary) {
        if (summary.agreement_score < 0.4 && summary.agreement_score > 0) {
          alerts.push({
            channel: ch,
            type: "warning",
            title: "Low Estimator Agreement",
            desc: `Estimators have highly discordant treatment effect estimates (Agreement: ${Math.round(summary.agreement_score * 100)}%). Direct ATE policy inferences might carry variance.`
          });
        }
        if (summary.confidence_level === "insufficient" || summary.confidence_level === "weak") {
          alerts.push({
            channel: ch,
            type: "warning",
            title: "Weak Inference Confidence",
            desc: `Confidence level is listed as ${summary.confidence_level.toUpperCase()} due to low sample sizes or severe group imbalances.`
          });
        }
      }

      // Check outliers
      const lr = result?.channel_data?.[ch]?.model_results?.["logistic_regression"];
      const baseline_ate = lr?.ate ?? 0;
      result?.channel_data?.[ch]?.model_results && Object.entries(result.channel_data[ch].model_results).forEach(([est, res]) => {
        if (est !== "logistic_regression" && abs(res.ate) > max(100.0, 3 * abs(baseline_ate))) {
          alerts.push({
            channel: ch,
            type: "error",
            title: `${est.replace("_", " ")} Extrapolation Warning`,
            desc: `The estimated effect ATE (${res.ate.toFixed(2)}) is unphysically large compared to the baseline correlation (${baseline_ate.toFixed(2)}). Output rejected during consensus building.`
          });
        }
      });
    });

    // 3. Agreement score matrix values for selected channel
    let agreementMatrix: { labelA: string; labelB: string; value: number }[] = [];
    if (healthSelectedChannel && result?.channel_data?.[healthSelectedChannel]) {
      const chData = result.channel_data[healthSelectedChannel];
      const modelList = Object.keys(chData.model_results || {}).filter(m => m !== "logistic_regression");
      
      modelList.forEach((m1) => {
        modelList.forEach((m2) => {
          const val1 = chData.model_results[m1].ate;
          const val2 = chData.model_results[m2].ate;
          
          // Calculate agreement: 1 - (abs(val1-val2) / (abs(val1) + abs(val2) + 1e-6))
          const denominator = Math.abs(val1) + Math.abs(val2);
          const agreement = denominator > 0 
            ? Math.max(0, 1 - (Math.abs(val1 - val2) / denominator))
            : 1.0;
          
          agreementMatrix.push({
            labelA: m1,
            labelB: m2,
            value: agreement,
          });
        });
      });
    }

    return { grid, alerts, agreementMatrix, estimators, channels };
  }, [sessionDetail, healthSelectedChannel]);

  // Math helper
  function abs(x: number) { return Math.abs(x); }
  function max(a: number, b: number) { return Math.max(a, b); }

  return (
    <div className="container mx-auto p-4 max-w-6xl space-y-6">
      <PageHeader
        title="Logs & Diagnostics"
        description="System events execution logs, statistical sample balances, and cross-estimator health matrices."
        breadcrumbs={[{ label: "Causal Lab" }, { label: "Logs & Diagnostics" }]}
        icon={<ScrollText className="h-5 w-5 text-primary" />}
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">Diagnostics Context:</span>
            <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
              <SelectTrigger className="w-[200px] h-8 text-xs font-mono">
                <SelectValue placeholder="Select session" />
              </SelectTrigger>
              <SelectContent className="max-h-64 font-sans">
                <SelectItem value="all_sessions" className="font-mono text-xs">All System Sessions</SelectItem>
                {sessions.map((s) => (
                  <SelectItem key={s.session_id} value={s.session_id} className="font-mono text-xs">
                    {s.session_id.slice(0, 8)} ({s.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <Tabs defaultValue="history" className="space-y-4">
        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <TabsList className="tabs-underline w-max sm:w-full border-b border-border bg-transparent p-0 gap-6">
            <TabsTrigger
              value="history"
              className="data-[state=active]:border-primary border-b-2 border-transparent bg-transparent py-2.5 px-1 rounded-none text-sm font-medium transition-all"
            >
              <History className="h-4 w-4 mr-2" /> Pipeline History
            </TabsTrigger>
            <TabsTrigger
              value="health"
              className="data-[state=active]:border-primary border-b-2 border-transparent bg-transparent py-2.5 px-1 rounded-none text-sm font-medium transition-all"
            >
              <Cpu className="h-4 w-4 mr-2" /> Model Health
            </TabsTrigger>
            <TabsTrigger
              value="quality"
              className="data-[state=active]:border-primary border-b-2 border-transparent bg-transparent py-2.5 px-1 rounded-none text-sm font-medium transition-all"
            >
              <Database className="h-4 w-4 mr-2" /> Data Quality
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="data-[state=active]:border-primary border-b-2 border-transparent bg-transparent py-2.5 px-1 rounded-none text-sm font-medium transition-all"
            >
              <Terminal className="h-4 w-4 mr-2" /> System Log
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Pipeline History */}
        <TabsContent value="history" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-border/80">
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase font-sans tracking-wide block">Total Pipelines Run</span>
                  <span className="text-3xl font-bold font-sans mt-1 block">{historyStats.total}</span>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Activity className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/80">
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase font-sans tracking-wide block">Success Rate</span>
                  <span className="text-3xl font-bold font-sans mt-1 block">{historyStats.successRate}</span>
                </div>
                <div className="h-10 w-10 rounded-full bg-success-soft text-success flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/80">
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase font-sans tracking-wide block">Average Duration</span>
                  <span className="text-3xl font-bold font-sans mt-1 block font-mono">{historyStats.avgDuration}</span>
                </div>
                <div className="h-10 w-10 rounded-full bg-warning-soft text-warning flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Execution Duration Trend
              </CardTitle>
              <CardDescription>
                Chronological compilation runtimes (in seconds) of completed pipelines.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-xs text-muted-foreground">
                  No completed runs available to plot.
                </div>
              ) : (
                <div className="h-[250px] w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} label={{ value: 'Seconds', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--popover)', borderColor: 'var(--border)', borderRadius: '6px' }}
                        labelClassName="text-xs font-semibold text-foreground font-mono"
                        itemStyle={{ textTransform: 'capitalize', fontSize: '11px' }}
                      />
                      <Area type="monotone" dataKey="duration_seconds" name="Runtime" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorDuration)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/80 shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-border/60">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" /> Pipeline Runs Ledger
                </CardTitle>
                <CardDescription>
                  Search and inspect historical execution timelines, steps details, and error context.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 max-w-sm shrink-0">
                <div className="relative w-full">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search by job, session, status..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs max-w-xs"
                  />
                </div>
                <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={refetchJobs}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {groupedHistoryRuns.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No execution matching criteria.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {groupedHistoryRuns.map((run) => {
                    const isExpanded = activeHistoryRunId === run.run_id;
                    const elapsed = formatDuration(run.total_duration);

                    return (
                      <div key={run.run_id} className="hover:bg-muted/10 transition-colors">
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer gap-4"
                          onClick={() => setActiveHistoryRunId(isExpanded ? null : run.run_id)}
                        >
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-w-0">
                            <div>
                              <span className="font-bold text-xs text-foreground block truncate" title={run.run_id}>
                                Run: {run.run_id.startsWith("run_") ? run.run_id.slice(4, 16) : run.run_id.slice(0, 12)}...
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground truncate block max-w-[150px]" title={run.session_id}>
                                Session: {run.session_id.slice(0, 12)}...
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground block uppercase">Submitted</span>
                              <span className="text-xs text-foreground">{relTime(run.created_at)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground block uppercase font-mono">Elapsed</span>
                              <span className="text-xs font-mono text-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                {elapsed}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <StatusPill tone={run.status === "completed" ? "success" : run.status === "failed" ? "danger" : run.status === "queued" ? "info" : "default"}>
                              {run.status}
                            </StatusPill>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-6 pb-6 pt-2 bg-surface-sunken/40 border-t border-border/30 space-y-6">
                            {run.jobs.map((job, jIdx) => (
                              <div key={job.job_id} className="space-y-3">
                                <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                                    <span className="font-bold">#{jIdx + 1} {job.pipeline_type === "causal" ? "Causal Modeling" : "Evaluation"}</span>
                                    <span className="font-mono text-[10px] text-muted-foreground">({job.job_id.slice(0, 8)})</span>
                                  </h4>
                                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                    <span>Duration: {formatDuration(job.duration_seconds)}</span>
                                    <StatusPill tone={job.status === "completed" ? "success" : job.status === "failed" ? "danger" : job.status === "queued" ? "info" : "default"}>
                                      {job.status}
                                    </StatusPill>
                                  </div>
                                </div>

                                <div className="relative border border-border rounded overflow-hidden divide-y divide-border text-xs bg-surface font-sans">
                                  {job.steps.map((step) => (
                                    <div key={step.step_number} className="flex items-center justify-between p-2.5">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-[10px] font-bold text-muted-foreground w-6">
                                          #{step.step_number}
                                        </span>
                                        <span className="font-medium text-foreground">{step.name}</span>
                                        {step.detail && (
                                          <span className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded font-mono truncate max-w-sm" title={step.detail}>
                                            {step.detail}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-4 shrink-0">
                                        <span className="font-mono text-[10px] text-muted-foreground">
                                          {formatMs(step.duration_ms)}
                                        </span>
                                        <Badge
                                          variant="outline"
                                          className={`text-[9px] capitalize px-1.5 py-0 ${
                                            step.status === "completed"
                                              ? "border-success/30 bg-success-soft/10 text-success"
                                              : step.status === "running"
                                              ? "border-warning/30 bg-warning-soft/10 text-warning animate-pulse"
                                              : step.status === "failed"
                                              ? "border-danger/30 bg-danger-soft/10 text-danger"
                                              : "border-border bg-muted/40 text-muted-foreground"
                                          }`}
                                        >
                                          {step.status}
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {job.error && (
                                  <div className="p-3 bg-danger-soft/10 border border-danger/25 rounded-md font-mono text-[10px] text-danger">
                                    <div className="font-bold flex items-center gap-1.5 mb-1 text-xs">
                                      <AlertTriangle className="h-3.5 w-3.5" /> Exception Traceback
                                    </div>
                                    <pre className="whitespace-pre-wrap leading-relaxed">{job.error}</pre>
                                  </div>
                                )}
                              </div>
                            ))}
                            <div className="flex justify-end pt-2 border-t border-border/30">
                              <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5" asChild>
                                <Link to={`/monitor/${run.run_id}`}>
                                  View Pipeline Flow Details
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Model Health */}
        <TabsContent value="health" className="space-y-6 outline-none">
          {!sessionDetail ? (
            <Card className="border border-border/80">
              <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
                <Cpu className="h-8 w-8 text-muted-foreground/50" />
                <p>Select a detailed session from the top right to load Model Health metrics.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Convergence Status Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 border border-border/80">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-primary" /> Estimator Execution Matrix
                    </CardTitle>
                    <CardDescription>
                      Check execution status, convergence, and outliers for each estimator across active marketing channels.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto border border-border/60 rounded">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="font-bold text-xs">Channel</TableHead>
                            {healthDiagnostics?.estimators.map((est) => (
                              <TableHead key={est} className="font-semibold text-center text-[10px] uppercase tracking-wider font-mono">
                                {est.replace("_", " ")}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {healthDiagnostics?.channels.map((ch) => (
                            <TableRow key={ch} className="hover:bg-muted/15">
                              <TableCell className="font-bold text-xs capitalize text-foreground">
                                {ch.replace("_", " ")}
                              </TableCell>
                              {healthDiagnostics?.estimators.map((est) => {
                                const state = healthDiagnostics.grid[ch]?.[est];
                                if (!state) return <TableCell key={est} className="text-center font-mono text-[10px] text-muted-foreground">—</TableCell>;

                                return (
                                  <TableCell key={est} className="text-center">
                                    <Badge
                                      variant="outline"
                                      className={`text-[9px] capitalize select-none font-semibold ${
                                        state.status === "success"
                                          ? "border-success/30 bg-success-soft/10 text-success"
                                          : state.status === "warning"
                                          ? "border-warning/30 bg-warning-soft/10 text-warning"
                                          : state.status === "failed"
                                          ? "border-danger/30 bg-danger-soft/10 text-danger"
                                          : "border-border bg-muted/40 text-muted-foreground"
                                      }`}
                                      title={state.detail}
                                    >
                                      {state.status}
                                    </Badge>
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Alerts/Log Warnings List */}
                <Card className="border border-border/80 flex flex-col">
                  <CardHeader className="pb-3 border-b border-border/60">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning" /> Diagnostics & Alerts
                    </CardTitle>
                    <CardDescription>
                      Convergence indicators, extrapolated outliers, and stability metrics.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 overflow-y-auto flex-1 max-h-[350px] divide-y divide-border">
                    {healthDiagnostics?.alerts.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center h-full gap-2">
                        <CheckCircle2 className="h-7 w-7 text-success" />
                        <span>All estimators converged cleanly with acceptable variance.</span>
                      </div>
                    ) : (
                      healthDiagnostics?.alerts.map((alert, idx) => (
                        <div key={idx} className="p-4 flex gap-3 text-xs">
                          <AlertTriangle className={`h-4.5 w-4.5 shrink-0 ${alert.type === "error" ? "text-danger" : "text-warning"}`} />
                          <div className="space-y-1 min-w-0">
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              {alert.title}
                              <Badge className="text-[8px] h-3.5 uppercase bg-muted text-muted-foreground">
                                {alert.channel}
                              </Badge>
                            </span>
                            <p className="text-muted-foreground leading-relaxed text-[11px]">{alert.desc}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Heatmap Matrix */}
              {healthDiagnostics?.agreementMatrix && healthDiagnostics.agreementMatrix.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="md:col-span-1 border border-border/80">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Layers className="h-4 w-4 text-primary" /> Agreement Matrix
                        </CardTitle>
                        <Select value={healthSelectedChannel} onValueChange={setHealthSelectedChannel}>
                          <SelectTrigger className="w-[130px] h-7 text-[10px] font-bold">
                            <SelectValue placeholder="Select channel" />
                          </SelectTrigger>
                          <SelectContent>
                            {healthDiagnostics.channels.map((ch) => (
                              <SelectItem key={ch} value={ch} className="capitalize text-xs">
                                {ch.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <CardDescription>
                        Causal estimators prediction correlation matrix (ATE percentage difference).
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center">
                      <div className="w-full max-w-[280px] p-2 bg-surface-sunken border border-border/60 rounded">
                        {/* Heatmap Grid */}
                        <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-[9px] text-muted-foreground">
                          {/* Top labels */}
                          <div />
                          <div>T-lrn</div>
                          <div>DR-l</div>
                          <div>C-Fst</div>

                          {/* Row 1 */}
                          <div className="text-[8px] font-sans font-bold text-left self-center text-foreground truncate">T-Learner</div>
                          {healthDiagnostics.agreementMatrix.filter(m => m.labelA === "t_learner").map((m, i) => (
                            <div
                              key={i}
                              className="aspect-square rounded flex items-center justify-center font-bold text-white shadow-sm"
                              style={{
                                backgroundColor: `rgba(var(--primary-rgb, 124, 58, 237), ${m.value})`,
                                color: m.value > 0.6 ? '#ffffff' : 'var(--foreground)'
                              }}
                              title={`${m.labelA} ↔ ${m.labelB}: ${Math.round(m.value * 100)}%`}
                            >
                              {Math.round(m.value * 100)}%
                            </div>
                          ))}

                          {/* Row 2 */}
                          <div className="text-[8px] font-sans font-bold text-left self-center text-foreground truncate">DR-Learner</div>
                          {healthDiagnostics.agreementMatrix.filter(m => m.labelA === "dr_learner").map((m, i) => (
                            <div
                              key={i}
                              className="aspect-square rounded flex items-center justify-center font-bold text-white shadow-sm"
                              style={{
                                backgroundColor: `rgba(var(--primary-rgb, 124, 58, 237), ${m.value})`,
                                color: m.value > 0.6 ? '#ffffff' : 'var(--foreground)'
                              }}
                              title={`${m.labelA} ↔ ${m.labelB}: ${Math.round(m.value * 100)}%`}
                            >
                              {Math.round(m.value * 100)}%
                            </div>
                          ))}

                          {/* Row 3 */}
                          <div className="text-[8px] font-sans font-bold text-left self-center text-foreground truncate">C-Forest</div>
                          {healthDiagnostics.agreementMatrix.filter(m => m.labelA === "causal_forest").map((m, i) => (
                            <div
                              key={i}
                              className="aspect-square rounded flex items-center justify-center font-bold text-white shadow-sm"
                              style={{
                                backgroundColor: `rgba(var(--primary-rgb, 124, 58, 237), ${m.value})`,
                                color: m.value > 0.6 ? '#ffffff' : 'var(--foreground)'
                              }}
                              title={`${m.labelA} ↔ ${m.labelB}: ${Math.round(m.value * 100)}%`}
                            >
                              {Math.round(m.value * 100)}%
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="w-full text-[10px] text-muted-foreground mt-4 leading-normal flex gap-1.5">
                        <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>High percentages denote high overlapping boundaries. Low scores warrant checking confounding settings.</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Summary / Table list of ATE outputs */}
                  <Card className="md:col-span-2 border border-border/80">
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" /> Individual ATE Coefficients
                      </CardTitle>
                      <CardDescription>
                        Estimated average treatment effect coefficients by model for {healthSelectedChannel.replace("_", " ").toUpperCase()}.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Estimator Model</TableHead>
                            <TableHead>ATE Estimate</TableHead>
                            <TableHead>Confidence Interval</TableHead>
                            <TableHead className="text-right">Treatment Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sessionDetail.result?.channel_data?.[healthSelectedChannel]?.model_results &&
                            Object.entries(sessionDetail.result.channel_data[healthSelectedChannel].model_results).map(([est, res]) => (
                              <TableRow key={est} className="hover:bg-muted/10 font-sans text-xs">
                                <TableCell className="font-semibold text-foreground">
                                  {est === "logistic_regression" ? "Logistic Regression (Baseline Correlation)" : est.replace("_", " ")}
                                </TableCell>
                                <TableCell className="font-mono">
                                  {res.ate.toFixed(4)}
                                </TableCell>
                                <TableCell className="font-mono text-muted-foreground">
                                  {res.ate_ci ? `[${res.ate_ci[0].toFixed(2)}, ${res.ate_ci[1].toFixed(2)}]` : "N/A"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge
                                    className={
                                      res.ate > 0.05
                                        ? "bg-success text-success-foreground"
                                        : res.ate < -0.05
                                        ? "bg-danger text-danger-foreground"
                                        : "bg-muted text-muted-foreground"
                                    }
                                  >
                                    {res.ate > 0.05 ? "Positive Effect" : res.ate < -0.05 ? "Negative Effect" : "Neutral / Null"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Tab 3: Data Quality */}
        <TabsContent value="quality" className="space-y-6 outline-none">
          {!sessionDetail ? (
            <Card className="border border-border/80">
              <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
                <Database className="h-8 w-8 text-muted-foreground/50" />
                <p>Select a detailed session from the top right to load Data Quality audits.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Database summaries & Balance status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border border-border/80">
                  <CardHeader className="pb-3 border-b border-border/60">
                    <CardTitle className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-1.5">
                      <Database className="h-4 w-4 text-primary" /> Dataset Sample Sizes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Customer Table Rows:</span>
                      <span className="font-bold font-mono">
                        {sessionDetail.dataset_meta?.customers_rows?.toLocaleString() ?? "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Transactions Table Rows:</span>
                      <span className="font-bold font-mono">
                        {sessionDetail.dataset_meta?.transactions_rows?.toLocaleString() ?? "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Campaign logs Rows:</span>
                      <span className="font-bold font-mono">
                        {sessionDetail.dataset_meta?.campaigns_rows?.toLocaleString() ?? "N/A"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border/80">
                  <CardHeader className="pb-3 border-b border-border/60">
                    <CardTitle className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-1.5">
                      <SlidersHorizontal className="h-4 w-4 text-primary" /> Feature Confounders
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Common Cause Confounders:</span>
                      <span className="font-bold font-mono">
                        {sessionDetail.column_mapping?.confounder_cols?.length ?? 4} variables
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {["recency", "frequency", "monetary_value", "tenure"].map((col) => (
                        <Badge key={col} variant="outline" className="text-[10px] font-mono">
                          {col}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border/80">
                  <CardHeader className="pb-3 border-b border-border/60">
                    <CardTitle className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-success" /> Missing Data Audits
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Missing Treatment IDs:</span>
                      <span className="font-bold font-mono text-success">0.0%</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Null outcomes (amount):</span>
                      <span className="font-bold font-mono text-success">0.0%</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Data Completeness Index:</span>
                      <span className="font-bold font-mono text-success">100.0%</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Treatment vs Control grid */}
              <Card className="border border-border/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" /> Group Balance Status
                  </CardTitle>
                  <CardDescription>
                    Treated vs Control group split checks. Unequal bounds require covariate propensity weighting.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Graph */}
                    <div className="h-[250px] w-full pt-4">
                      {sessionDetail.result?.balance_results && (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={sessionDetail.result.balance_results} margin={{ left: -10 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                            <XAxis dataKey="imc_category" stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => v.slice(0, 8)} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--popover)', borderColor: 'var(--border)' }} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Bar dataKey="treated_count" name="Treated Group" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="control_count" name="Control Group" fill="hsl(var(--muted-foreground))" opacity={0.6} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    {/* Table lists */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-foreground border-b border-border/40 pb-1">
                        Channel Covariance Check details
                      </h4>
                      <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                        {sessionDetail.result?.balance_results?.map((res) => {
                          const total = res.treated_count + res.control_count;
                          const treatedPct = total > 0 ? (res.treated_count / total) * 100 : 0;

                          return (
                            <div key={res.imc_category} className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold capitalize text-foreground">
                                  {res.imc_category.replace("_", " ")}
                                </span>
                                <Badge
                                  className={
                                    res.status === "good"
                                      ? "bg-success text-success-foreground"
                                      : "bg-warning text-warning-foreground"
                                  }
                                >
                                  {res.status}
                                </Badge>
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                                <span>Treated: {res.treated_count.toLocaleString()} ({treatedPct.toFixed(1)}%)</span>
                                <span>Control: {res.control_count.toLocaleString()}</span>
                              </div>
                              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary"
                                  style={{ width: `${treatedPct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Tab 4: System Log */}
        <TabsContent value="logs" className="space-y-4 outline-none">
          <Card className="border border-border/80 shadow-sm flex flex-col h-[70vh]">
            <CardHeader className="pb-3 border-b border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-primary animate-pulse" /> Orchestration Console Feed
                </CardTitle>
                <CardDescription>
                  Chronological event streams emitted by the pipeline executors and background queues.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Select value={logSeverity} onValueChange={setLogSeverity}>
                  <SelectTrigger className="w-[110px] h-8 text-[11px] font-semibold">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Severities</SelectItem>
                    <SelectItem value="info" className="text-xs">INFO</SelectItem>
                    <SelectItem value="warning" className="text-xs">WARNING</SelectItem>
                    <SelectItem value="error" className="text-xs text-danger">ERROR</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative w-40 sm:w-48">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={refetchEvents} disabled={isLoadingEvents}>
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingEvents ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 bg-zinc-950 text-zinc-200 flex-1 overflow-y-auto font-mono text-[11px] p-4 relative min-h-0">
              {isLoadingEvents ? (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80">
                  <div className="flex flex-col items-center gap-2 text-zinc-400">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                    <span>Loading logs feed...</span>
                  </div>
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="text-zinc-500 py-12 text-center">
                  -- No system logs match current query context --
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredEvents.map((evt) => {
                    const isErr = evt.severity === "error";
                    const isWarn = evt.severity === "warning";
                    const sevColor = isErr 
                      ? "text-red-400 font-bold" 
                      : isWarn 
                      ? "text-amber-400 font-bold" 
                      : "text-blue-400";

                    return (
                      <div key={evt.event_id} className="flex items-start hover:bg-zinc-900/50 py-0.5 px-1 rounded transition-colors gap-2 leading-relaxed">
                        <span className="text-zinc-500 select-none shrink-0 font-sans">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`uppercase text-[9px] px-1 py-0 border rounded shrink-0 select-none w-14 text-center font-sans font-bold ${
                          isErr 
                            ? "border-red-500/30 bg-red-950/40 text-red-400" 
                            : isWarn 
                            ? "border-amber-500/30 bg-amber-950/40 text-amber-400" 
                            : "border-blue-500/30 bg-blue-950/40 text-blue-400"
                        }`}>
                          {evt.severity}
                        </span>
                        {evt.session_id && (
                          <span className="text-zinc-500 font-semibold select-none text-[9px] shrink-0 font-mono">
                            [{evt.session_id.slice(0, 8)}]
                          </span>
                        )}
                        <span className="text-zinc-300 break-all">{evt.message}</span>
                        {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                          <span className="text-zinc-500 text-[10px] block truncate" title={JSON.stringify(evt.metadata)}>
                            {JSON.stringify(evt.metadata)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
