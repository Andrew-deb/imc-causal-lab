import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/PageHeader";
import { StatusPill } from "@/components/console/StatusPill";
import { useDAGLibrary } from "@/lib/dag-store";
import { useSession } from "@/contexts/SessionContext";
import {
  Home as HomeIcon, PlusCircle, History, Workflow, ArrowRight,
  LayoutDashboard, Sparkles, Clock,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";

const RECENT_SESSIONS = [
  { id: "session_20260313_ab12", date: "2026-03-13", status: "completed", treatment: "imc_category", outcome: "purchase" },
  { id: "session_20260310_cd34", date: "2026-03-10", status: "completed", treatment: "imc_category", outcome: "conversion" },
  { id: "session_20260308_ef56", date: "2026-03-08", status: "failed", treatment: "channel_type", outcome: "revenue" },
];

export default function Home() {
  const navigate = useNavigate();
  const { dags } = useDAGLibrary();
  const { sessionId } = useSession();
  const latestDag = dags[0];

  const fmt = (d: string) => { try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; } };
  const rel = (d: string) => { try { return formatDistanceToNow(parseISO(d), { addSuffix: true }); } catch { return ""; } };

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
        {/* Recent sessions */}
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
            <ul className="divide-y divide-border">
              {RECENT_SESSIONS.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 cursor-pointer"
                  onClick={() => navigate("/sessions")}
                >
                  <History className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs truncate">{s.id}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {s.date} · {s.treatment} → {s.outcome}
                    </div>
                  </div>
                  <StatusPill tone={s.status === "completed" ? "success" : s.status === "failed" ? "danger" : "info"}>
                    {s.status}
                  </StatusPill>
                </li>
              ))}
            </ul>
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
                  <div className="font-mono text-xs break-all">{sessionId}</div>
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
