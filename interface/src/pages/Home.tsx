import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/PageHeader";
import { StatusPill } from "@/components/console/StatusPill";
import { Badge } from "@/components/ui/badge";
import { useDAGLibrary } from "@/lib/dag-store";
import { useSession } from "@/contexts/SessionContext";
import { api, SystemEvent } from "@/lib/api";
import { usePipeline } from "@/contexts/PipelineContext";
import {
  Home as HomeIcon, PlusCircle, History, Workflow, ArrowRight,
  LayoutDashboard, Sparkles, Clock, Loader2, PlayCircle, Trash2,
  Activity, ScrollText, Gauge, AlertTriangle, CheckCircle2, XCircle, Info
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

interface RecentSession {
  session_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  dataset_meta: Record<string, unknown> | null;
  has_results: boolean;
}

/** Truncate UUIDs to a readable short ID: session_afd2c34b */
function shortId(id: string) {
  const uuid = id.replace(/^session_/, "");
  return `session_${uuid.slice(0, 8)}`;
}

function statusTone(status: string): "success" | "danger" | "info" | "warning" {
  if (status === "complete" || status === "completed") return "success";
  if (status === "error" || status === "failed") return "danger";
  if (status === "running") return "warning";
  return "info";
}

export default function Home() {
  const navigate = useNavigate();
  const { dags } = useDAGLibrary();
  const { sessionId, setSessionId } = useSession();
  const latestDag = dags[0];

  const { activeJob, queueStatus, jobs, cancelJob } = usePipeline();
  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [recentEvents, setRecentEvents] = useState<SystemEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    api.getSessions()
      .then((list) => setSessions(list.slice(0, 5))) // show last 5
      .catch(() => setSessions([]))
      .finally(() => setLoadingSessions(false));
  }, []);

  useEffect(() => {
    let active = true;
    const fetchEvents = async () => {
      try {
        const events = await api.getSystemEvents();
        if (active) {
          setRecentEvents(events.slice(0, 3));
        }
      } catch (err) {
        console.error("Failed to load home page logs:", err);
      } finally {
        if (active) setLoadingEvents(false);
      }
    };
    fetchEvents();
    // Poll logs every 10 seconds to keep homepage live
    const interval = setInterval(fetchEvents, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const rel = (d: string) => {
    try { return formatDistanceToNow(parseISO(d), { addSuffix: true }); } catch { return ""; }
  };

  const metrics = useMemo(() => {
    const validJobs = jobs.filter(j => j.status !== 'queued' && j.status !== 'running');
    const total = validJobs.length;
    const completed = validJobs.filter(j => j.status === 'completed').length;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 100;
    
    const completedJobs = jobs.filter(j => j.status === 'completed' && j.duration_seconds);
    const avgDuration = completedJobs.length > 0
      ? Math.round(completedJobs.reduce((sum, j) => sum + (j.duration_seconds || 0), 0) / completedJobs.length)
      : 0;

    return { total: jobs.length, successRate, avgDuration };
  }, [jobs]);

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this session?")) return;
    try {
      await api.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.session_id !== id));
      if (sessionId === id) setSessionId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSessionClick = (s: RecentSession) => {
    setSessionId(s.session_id);
    if (s.status === "complete" || s.status === "completed") {
      navigate("/dashboard");
    } else {
      // Resume in-progress session
      navigate("/new-analysis", { state: { resumeSessionId: s.session_id, resumeStatus: s.status } });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Welcome to Causal Console"
        description="Your overview of recent activity, saved structures, and quick actions."
        breadcrumbs={[{ label: "Home" }]}
        icon={<HomeIcon className="h-5 w-5" />}
        actions={
          <Button size="sm" className="h-8 gap-1.5" onClick={() => navigate("/new-analysis")}>
            <PlusCircle className="h-3.5 w-3.5" /> New Analysis
          </Button>
        }
      />

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickAction icon={<PlusCircle className="h-4 w-4" />} label="New Causal Analysis" sub="Start the wizard" to="/new-analysis" />
        <QuickAction icon={<Workflow className="h-4 w-4" />} label="Discover Studio" sub="Build & manage DAGs" to="/discover" />
        <QuickAction icon={<History className="h-4 w-4" />} label="Session History" sub="Browse past runs" to="/sessions" />
        <QuickAction icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" sub="View results" to="/dashboard" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent sessions — real data */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" /> Recent activity
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link to="/sessions">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loadingSessions ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading sessions…
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No sessions yet. Start a new analysis to see activity here.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {sessions.map((s) => (
                  <li
                    key={s.session_id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 cursor-pointer"
                    onClick={() => handleSessionClick(s)}
                  >
                    <History className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs truncate">{shortId(s.session_id)}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {rel(s.created_at)}
                        {s.dataset_meta && typeof s.dataset_meta === "object" && (
                          <> · {(s.dataset_meta as Record<string, number>).campaigns_rows ?? "?"} campaigns</>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Show "Continue" for incomplete sessions */}
                      {s.status !== "complete" && s.status !== "completed" && s.status !== "error" && s.status !== "failed" && (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary">
                          <PlayCircle className="h-3 w-3" /> Continue
                        </Button>
                      )}
                      <StatusPill tone={statusTone(s.status)}>
                        {s.status}
                      </StatusPill>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDeleteSession(e, s.session_id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Latest DAG / Active session */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Latest DAG
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latestDag ? (
                <div className="space-y-2">
                  <div className="font-medium text-sm truncate">{latestDag.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{latestDag.description}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {latestDag.edges.length} edges · {latestDag.variables.length} variables · Updated {rel(latestDag.updated_at)}
                  </div>
                  <Button asChild size="sm" variant="outline" className="h-7 text-xs w-full mt-2">
                    <Link to="/discover">Open Studio <ArrowRight className="ml-1 h-3 w-3" /></Link>
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No DAGs yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Active session</CardTitle>
            </CardHeader>
            <CardContent>
              {sessionId ? (
                <div className="space-y-2">
                  <div className="font-mono text-xs break-all">{shortId(sessionId)}</div>
                  <Button asChild size="sm" variant="outline" className="h-7 text-xs w-full">
                    <Link to="/dashboard">View dashboard</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2">No session selected. Pick one or start a new analysis.</p>
                  <Button asChild size="sm" className="h-7 text-xs w-full">
                    <Link to="/new-analysis">Start new analysis</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Observability & Diagnostics Section */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold tracking-tight mt-6 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary animate-pulse" /> Observability & Diagnostics Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1: Pipeline Status & Active Progress */}
          <Card className="flex flex-col justify-between">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Active Pipeline Status
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between min-h-[180px]">
              {activeJob ? (
                <div className="space-y-3 w-full">
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="uppercase text-primary font-mono">
                        {activeJob.pipeline_type === "causal" ? "Causal Modeling" : "Evaluation"}
                      </span>
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {shortId(activeJob.job_id)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Running step {activeJob.steps.filter(s => s.status === 'completed').length + 1} of {activeJob.steps.length}
                    </p>
                  </div>

                  {/* Active step stepper */}
                  <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-1">
                    {activeJob.steps.slice(0, 3).map((step) => (
                      <div key={step.step_number} className="flex items-center justify-between text-[11px] gap-2">
                        <span className="flex items-center gap-1.5 truncate">
                          {step.status === 'completed' && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />}
                          {step.status === 'running' && <Loader2 className="h-3 w-3 text-blue-500 animate-spin shrink-0" />}
                          {step.status === 'failed' && <XCircle className="h-3 w-3 text-rose-500 shrink-0" />}
                          {step.status === 'pending' && <Clock className="h-3 w-3 text-muted-foreground shrink-0" />}
                          <span className={step.status === 'running' ? 'font-semibold text-foreground animate-pulse' : 'text-muted-foreground'}>
                            {step.name}
                          </span>
                        </span>
                        {step.duration_ms && (
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                            {(step.duration_ms / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                    ))}
                    {activeJob.steps.length > 3 && (
                      <div className="text-[10px] text-muted-foreground pl-4">
                        + {activeJob.steps.length - 3} more steps
                      </div>
                    )}
                  </div>

                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full h-7 text-xs gap-1 mt-1"
                    onClick={() => cancelJob(activeJob.job_id)}
                  >
                    Cancel Analysis
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 flex-1 flex flex-col justify-between w-full">
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-1" />
                    <h4 className="text-xs font-semibold text-foreground">Pipeline Queue Idle</h4>
                    <p className="text-[11px] text-muted-foreground max-w-[200px]">
                      No active causal analysis running.
                    </p>
                  </div>
                  <div className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-md font-mono space-y-0.5">
                    <div>Running slots: 0 / 1</div>
                    <div>Queued tasks: {queueStatus?.queued_count ?? 0} / 3</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 2: System Health Metrics */}
          <Card className="flex flex-col justify-between">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" /> Observability Health
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between min-h-[180px]">
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="bg-muted/40 p-2.5 rounded-lg text-center">
                  <div className="text-xl font-bold tracking-tight text-foreground">
                    {metrics.successRate}%
                  </div>
                  <div className="text-[9px] text-muted-foreground font-medium uppercase mt-0.5">
                    Success Rate
                  </div>
                </div>
                <div className="bg-muted/40 p-2.5 rounded-lg text-center">
                  <div className="text-xl font-bold tracking-tight text-foreground">
                    {metrics.total}
                  </div>
                  <div className="text-[9px] text-muted-foreground font-medium uppercase mt-0.5">
                    Total Runs
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 my-3 text-[11px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>Avg Execution Time:</span>
                  <span className="font-mono text-foreground font-semibold">{metrics.avgDuration}s</span>
                </div>
                <div className="flex justify-between">
                  <span>Concurrent Limit:</span>
                  <span className="font-mono text-foreground">{queueStatus?.max_concurrent ?? 1} job</span>
                </div>
                <div className="flex justify-between">
                  <span>Max Queue Depth:</span>
                  <span className="font-mono text-foreground">{queueStatus?.max_queued ?? 3} items</span>
                </div>
              </div>

              <Button asChild size="sm" variant="outline" className="h-8 text-xs w-full mt-1">
                <Link to="/monitor" className="flex items-center justify-center gap-1.5">
                  Pipeline Monitor <ArrowRight className="h-3 w-3 animate-pulse" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Card 3: Live System Log Ticker */}
          <Card className="flex flex-col justify-between">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-primary" /> Recent Diagnostics
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between min-h-[180px]">
              {loadingEvents ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2 text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading logs…
                </div>
              ) : recentEvents.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground text-center">
                  No system logs recorded yet.
                </div>
              ) : (
                <div className="space-y-2 flex-1 my-1">
                  {recentEvents.map((evt) => (
                    <div key={evt.event_id} className="text-[11px] flex gap-2 items-start border-b border-border/40 pb-1.5 last:border-b-0 last:pb-0">
                      <span className="shrink-0 mt-0.5">
                        {evt.severity === "error" && (
                          <Badge variant="destructive" className="px-1 py-0 text-[8px] font-semibold uppercase leading-none rounded-sm">
                            Err
                          </Badge>
                        )}
                        {evt.severity === "warning" && (
                          <Badge className="bg-amber-500 hover:bg-amber-600 text-white px-1 py-0 text-[8px] font-semibold uppercase leading-none rounded-sm">
                            Warn
                          </Badge>
                        )}
                        {evt.severity === "info" && (
                          <Badge className="bg-blue-500 hover:bg-blue-600 text-white px-1 py-0 text-[8px] font-semibold uppercase leading-none rounded-sm">
                            Info
                          </Badge>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground line-clamp-1 break-all leading-tight">
                          {evt.message}
                        </p>
                        <span className="text-[9px] text-muted-foreground">
                          {rel(evt.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button asChild size="sm" variant="outline" className="h-8 text-xs w-full mt-2">
                <Link to="/logs" className="flex items-center justify-center gap-1.5">
                  Logs & Diagnostics <ArrowRight className="h-3 w-3 animate-pulse" />
                </Link>
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}

function QuickAction({ icon, label, sub, to }: { icon: React.ReactNode; label: string; sub: string; to: string }) {
  return (
    <Link
      to={to}
      className="panel p-3 hover:border-primary/40 hover:bg-accent/40 transition-colors flex items-start gap-3 group"
    >
      <span className="h-8 w-8 rounded-md bg-primary-soft text-primary flex items-center justify-center shrink-0">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground truncate">{label}</div>
        <div className="text-[11px] text-muted-foreground truncate">{sub}</div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}
