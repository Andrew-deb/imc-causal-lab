import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/PageHeader";
import { StatusPill } from "@/components/console/StatusPill";
import { useDAGLibrary } from "@/lib/dag-store";
import { useSession } from "@/contexts/SessionContext";
import { api } from "@/lib/api";
import {
  Home as HomeIcon, PlusCircle, History, Workflow, ArrowRight,
  LayoutDashboard, Sparkles, Clock, Loader2, PlayCircle, Trash2,
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

  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    api.getSessions()
      .then((list) => setSessions(list.slice(0, 5))) // show last 5
      .catch(() => setSessions([]))
      .finally(() => setLoadingSessions(false));
  }, []);

  const rel = (d: string) => {
    try { return formatDistanceToNow(parseISO(d), { addSuffix: true }); } catch { return ""; }
  };

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
