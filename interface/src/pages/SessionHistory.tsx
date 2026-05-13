import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, SessionSummary } from "@/lib/api";
import { useSession } from "@/contexts/SessionContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ROLE_COLORS } from "@/lib/causal-graph";
import { ArrowLeft, ExternalLink, ChevronRight, TrendingUp, Target, BarChart3, Award, Workflow, History, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/console/PageHeader";
import { StatusPill } from "@/components/console/StatusPill";
import SessionDatasetPreview, { StoredDataset } from "@/components/session/SessionDatasetPreview";
import { useDAGLibrary, type CausalEdgeFull, type SavedDAG } from "@/lib/dag-store";
import DAGCanvas, { edgeKey } from "@/components/dag/DAGCanvas";
import VariableRolesPanel from "@/components/dag/VariableRolesPanel";
import EdgeReasoningSheet from "@/components/dag/EdgeReasoningSheet";
import { Link } from "react-router-dom";



const statusColors: Record<string, string> = {
  completed: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  in_progress: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
};




function SessionDetail({ session, onBack, onViewDashboard, onViewComparison }: {
  session: SessionSummary;
  onBack: () => void;
  onViewDashboard: () => void;
  onViewComparison: () => void;
}) {
  const { dags } = useDAGLibrary();
  
  const { data: detail, isLoading } = useQuery({
    queryKey: ["session-detail", session.session_id],
    queryFn: () => api.getSessionDetail(session.session_id),
  });

  const attachedDag: SavedDAG | null =
    dags.find((d) => d.dag_id === detail?.dag_id) ?? null;
    
  const [selectedEdge, setSelectedEdge] = useState<CausalEdgeFull | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Sessions
        </Button>
        <div className="flex justify-center p-12"><Skeleton className="h-64 w-full" /></div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Sessions
        </Button>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No detailed data available for this session.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={session.session_id}
        breadcrumbs={[{ label: "Session History", onClick: onBack }, { label: session.session_id }]}
        icon={<History className="h-5 w-5" />}
        meta={
          <>
            <span>{session.date}</span>
            <span>·</span>
            <StatusPill tone={session.status === "completed" ? "success" : session.status === "failed" ? "danger" : "info"}>
              {session.status}
            </StatusPill>
          </>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={onBack} className="h-8 gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button size="sm" onClick={onViewDashboard} className="h-8 gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" /> Dashboard
            </Button>
          </>
        }
      />

      <Tabs defaultValue="data-overview" className="space-y-4">
        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <TabsList className="tabs-underline w-max sm:w-full">
            <TabsTrigger value="data-overview">Data Overview</TabsTrigger>
            <TabsTrigger value="imc">IMC Categorization</TabsTrigger>
            <TabsTrigger value="causal-discovery">Causal Discovery</TabsTrigger>
            {detail.result && <TabsTrigger value="results">Results</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="causal-discovery">
          {attachedDag ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Workflow className="h-4 w-4 text-primary" /> {attachedDag.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {attachedDag.creation_mode === "llm_assisted" ? "AI-Generated" : "Manual"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {attachedDag.edges.length} edges · {attachedDag.variables.length} variables
                        </span>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline" className="gap-1.5 self-start">
                      <Link to="/discover">
                        <ExternalLink className="h-3.5 w-3.5" /> View in Studio
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
              </Card>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
                <Card className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base">Causal DAG (read-only)</CardTitle>
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(ROLE_COLORS).map(([role, color]) => (
                          <span key={role} className="flex items-center gap-1.5 text-[11px] text-muted-foreground capitalize">
                            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                            {role.replace("_", " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <DAGCanvas
                      treatment={attachedDag.treatment}
                      outcome={attachedDag.outcome}
                      variables={attachedDag.variables}
                      edges={attachedDag.edges}
                      variable_roles={attachedDag.variable_roles}
                      readOnly
                      selectedEdgeKey={selectedEdge ? edgeKey(selectedEdge) : null}
                      onEdgeClick={setSelectedEdge}
                      height="55vh"
                    />
                  </CardContent>
                </Card>
                <VariableRolesPanel
                  treatment={attachedDag.treatment}
                  outcome={attachedDag.outcome}
                  variable_roles={attachedDag.variable_roles}
                  domain_expertises={attachedDag.domain_expertises}
                />
              </div>
              <EdgeReasoningSheet edge={selectedEdge} onClose={() => setSelectedEdge(null)} readOnly />
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
                <Workflow className="h-8 w-8 text-muted-foreground/50" />
                <p>No causal structure was attached to this session.</p>
                <p className="text-xs italic">
                  Run a new analysis and complete the Causal Discovery step to generate or attach a DAG.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Data Overview (Datasets + Column Mapping combined) */}
        <TabsContent value="data-overview">
          <div className="space-y-4">
            {/* Dataset Preview */}
            <SessionDatasetPreview sessionId={session.session_id} datasetMeta={detail.dataset_meta} />

            {/* Dataset Roles & Column Mapping side by side on larger screens */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Dataset Roles</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    {detail.dataset_roles && Object.keys(detail.dataset_roles).length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>File</TableHead>
                            <TableHead>Assigned Role</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(detail.dataset_roles as any[]).map((dr, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-sm">{dr.fileName || "Unknown"}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs capitalize">{String(dr.role || "")}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-sm text-muted-foreground italic p-4 text-center">No dataset roles assigned yet.</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Column Mapping</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    {detail.column_mapping && Object.keys(detail.column_mapping).length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Required Field</TableHead>
                            <TableHead>Mapped Column</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(detail.column_mapping).map(([field, col]) => (
                            <TableRow key={field}>
                              <TableCell className="text-sm font-medium">{field}</TableCell>
                              <TableCell className="font-mono text-sm">{String(col)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-sm text-muted-foreground italic p-4 text-center">No columns mapped yet.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>



        {/* Tab 2: IMC Categorization */}
        <TabsContent value="imc">
          <Card>
            <CardHeader><CardTitle className="text-base">IMC Exposure Categorization</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Raw campaign types were mapped to standardized IMC exposure categories using AI classification.
              </p>
              {detail.imc_mapping && Object.keys(detail.imc_mapping).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign Type</TableHead>
                      <TableHead>IMC Category</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(detail.imc_mapping).map(([campaignType, imcCategory]) => (
                      <TableRow key={campaignType}>
                        <TableCell className="font-mono text-sm">{campaignType}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              imcCategory === "advertising"
                                ? "bg-primary/10 text-primary border-primary/20"
                                : imcCategory === "promotion"
                                ? "bg-chart-3/10 text-chart-3 border-chart-3/20"
                                : imcCategory === "direct_marketing"
                                ? "bg-chart-2/10 text-chart-2 border-chart-2/20"
                                : "bg-chart-4/10 text-chart-4 border-chart-4/20"
                            }
                          >
                            {imcCategory.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-sm text-muted-foreground italic p-4 border rounded-md text-center">No IMC mapping generated yet.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Causal Discovery tab removed — Causal Structure tab covers this. */}


        {/* Tab 4: Results */}
        {detail.result && (
          <TabsContent value="results">
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Top Channel</CardTitle>
                    <Award className="h-3.5 w-3.5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent><div className="text-lg font-semibold">{detail.result.channel_ranking?.[0]?.channel || "N/A"}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Top Consensus ATE</CardTitle>
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent><div className="text-xl font-bold font-mono">{detail.result.channel_ranking?.[0]?.consensus_ate?.toFixed(3) || "N/A"}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Confidence</CardTitle>
                    <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-semibold capitalize">
                      <Badge variant="outline" className={`capitalize text-base px-0 border-0 ${
                        detail.result.channel_ranking?.[0]?.confidence_level === 'high' ? 'text-green-500' : 
                        detail.result.channel_ranking?.[0]?.confidence_level === 'low' ? 'text-destructive' : ''
                      }`}>
                        {detail.result.channel_ranking?.[0]?.confidence_level || "N/A"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Channel Summary Table */}
              <Card>
                <CardHeader><CardTitle className="text-base">Channel Summary</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Channel</TableHead>
                        <TableHead>Consensus ATE</TableHead>
                        <TableHead>Confidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.result.channel_ranking?.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-sm">{row.channel}</TableCell>
                          <TableCell className="font-mono text-sm">{row.consensus_ate?.toFixed(4)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs capitalize ${
                              row.confidence_level === 'high' ? 'bg-chart-2/10 text-chart-2 border-chart-2/20' : 
                              row.confidence_level === 'low' ? 'bg-destructive/10 text-destructive border-destructive/20' : ''
                            }`}>
                              {row.confidence_level}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button size="sm" onClick={onViewComparison} className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" /> View Full Comparison
                </Button>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default function SessionHistory() {
  const navigate = useNavigate();
  const { sessionId, setSessionId } = useSession();
  const [selectedSession, setSelectedSession] = useState<SessionSummary | null>(null);
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      try {
        return await api.getSessions();
      } catch {
        return [];
      }
    },
  });

  const handleViewDashboard = (session: SessionSummary) => {
    setSessionId(session.session_id);
    navigate("/dashboard");
  };

  const handleViewComparison = (session: SessionSummary) => {
    setSessionId(session.session_id);
    navigate("/dashboard?tab=comparison");
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this session?")) return;
    try {
      await api.deleteSession(id);
      queryClient.setQueryData(["sessions"], (old: SessionSummary[] | undefined) => 
        old ? old.filter((s) => s.session_id !== id) : []
      );
      if (sessionId === id) setSessionId(null);
    } catch (err) {
      console.error(err);
    }
  };

  if (selectedSession) {
    return (
      <SessionDetail
        session={selectedSession}
        onBack={() => setSelectedSession(null)}
        onViewDashboard={() => handleViewDashboard(selectedSession)}
        onViewComparison={() => handleViewComparison(selectedSession)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Session History"
        description="Browse and load previous analysis sessions."
        breadcrumbs={[{ label: "Session History" }]}
        icon={<History className="h-5 w-5" />}
        meta={<><span>{(sessions || []).length} sessions</span></>}
        actions={
          <Button size="sm" onClick={() => navigate("/new-analysis")} className="h-8 gap-1.5">
            New analysis
          </Button>
        }
      />

      <div className="panel overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-sunken hover:bg-surface-sunken">
                  <TableHead className="text-[11px] uppercase tracking-wider">Session ID</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Created</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Customers</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Campaigns</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sessions || []).map((s) => (
                  <TableRow
                    key={s.session_id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setSelectedSession(s)}
                  >
                    <TableCell className="font-mono text-xs">{s.session_id}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs">{s.dataset_meta?.customers || "N/A"}</TableCell>
                    <TableCell className="text-xs">{s.dataset_meta?.campaigns || "N/A"}</TableCell>
                    <TableCell>
                      <StatusPill
                        tone={s.status === "completed" ? "success" : s.status === "failed" ? "danger" : "info"}
                      >
                        {s.status}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-right flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDeleteSession(e, s.session_id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
