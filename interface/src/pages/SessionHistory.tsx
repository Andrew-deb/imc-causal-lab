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

// Mock data for sessions
const MOCK_SESSIONS: SessionSummary[] = [
  { session_id: "session_20260313_ab12", date: "2026-03-13", treatment: "imc_category", outcome: "purchase", status: "completed" },
  { session_id: "session_20260310_cd34", date: "2026-03-10", treatment: "imc_category", outcome: "conversion", status: "completed" },
  { session_id: "session_20260308_ef56", date: "2026-03-08", treatment: "channel_type", outcome: "revenue", status: "failed" },
];

// Mock session detail data
const MOCK_SESSION_DETAILS: Record<string, {
  datasetRoles: { fileName: string; role: string }[];
  columnMapping: Record<string, string>;
  uploadedFiles: StoredDataset[];
  imcMapping: Record<string, string>;
  dagEdges: { source: string; target: string }[];
  reasoning: string;
  variables: { treatment: string; outcome: string; confounders: string[]; mediators: string[]; colliders: string[] };
  modelResults?: {
    consensus_ate: number;
    consensus_att: number;
    agreement_score: number;
    best_model: string;
    channel_summary: { channel: string; consensus_ate: number; best_model: string; agreement_score: number; persuadables_pct: number }[];
  };
}> = {
  session_20260313_ab12: {
    datasetRoles: [
      { fileName: "customers.csv", role: "Customer Data" },
      { fileName: "transactions.csv", role: "Transaction Data" },
      { fileName: "campaigns.csv", role: "Campaign Data" },
    ],
    columnMapping: {
      "Campaign Type / Channel": "campaigns.csv :: campaign_type",
      "Campaign Start Date": "campaigns.csv :: start_date",
      "Campaign End Date": "campaigns.csv :: end_date",
      "Transaction Date": "transactions.csv :: date",
      "Transaction Amount": "transactions.csv :: amount",
    },
    uploadedFiles: [
      {
        name: "customers.csv",
        headers: ["customer_id", "age", "income", "region", "signup_date"],
        rows: [
          ["C001", "34", "72000", "Northeast", "2024-01-15"],
          ["C002", "28", "55000", "West", "2024-02-20"],
          ["C003", "45", "91000", "South", "2023-11-08"],
          ["C004", "52", "110000", "Midwest", "2024-03-01"],
          ["C005", "31", "64000", "Northeast", "2024-01-22"],
        ],
        totalRows: 12450,
        fileSize: "1.2 MB",
      },
      {
        name: "transactions.csv",
        headers: ["transaction_id", "customer_id", "campaign_id", "purchase", "amount", "date"],
        rows: [
          ["T0001", "C001", "CMP01", "1", "149.99", "2025-06-10"],
          ["T0002", "C002", "CMP03", "0", "0", "2025-06-11"],
          ["T0003", "C003", "CMP01", "1", "89.50", "2025-06-12"],
          ["T0004", "C001", "CMP02", "1", "210.00", "2025-06-15"],
          ["T0005", "C004", "CMP03", "0", "0", "2025-06-16"],
        ],
        totalRows: 34200,
        fileSize: "3.8 MB",
      },
      {
        name: "campaigns.csv",
        headers: ["campaign_id", "campaign_type", "channel", "start_date", "budget"],
        rows: [
          ["CMP01", "ads", "social", "2025-05-01", "50000"],
          ["CMP02", "email", "email", "2025-05-15", "12000"],
          ["CMP03", "coupon", "in_store", "2025-06-01", "8000"],
          ["CMP04", "sponsorship", "events", "2025-04-20", "75000"],
        ],
        totalRows: 28,
        fileSize: "4 KB",
      },
    ],
    imcMapping: { ads: "advertising", email: "direct_marketing", sms: "direct_marketing", coupon: "promotion", sponsorship: "public_relations" },
    dagEdges: [
      { source: "age", target: "imc_category" },
      { source: "income", target: "imc_category" },
      { source: "imc_category", target: "purchase" },
      { source: "age", target: "purchase" },
      { source: "income", target: "purchase" },
    ],
    reasoning: "Age and income are identified as confounders that influence both the treatment assignment (IMC category) and the outcome (purchase behavior). The backdoor criterion is satisfied by conditioning on age and income, allowing unbiased estimation of the causal effect of IMC exposure on purchasing.",
    variables: { treatment: "imc_category", outcome: "purchase", confounders: ["age", "income"], mediators: [], colliders: [] },
    modelResults: {
      consensus_ate: 0.20,
      consensus_att: 0.18,
      agreement_score: 93,
      best_model: "Causal Forest",
      channel_summary: [
        { channel: "Advertising", consensus_ate: 0.20, best_model: "Causal Forest", agreement_score: 93, persuadables_pct: 21 },
        { channel: "Promotion", consensus_ate: 0.15, best_model: "Causal Forest", agreement_score: 88, persuadables_pct: 17 },
        { channel: "Direct Marketing", consensus_ate: 0.10, best_model: "DR-Learner", agreement_score: 91, persuadables_pct: 13 },
        { channel: "Public Relations", consensus_ate: 0.05, best_model: "DR-Learner", agreement_score: 78, persuadables_pct: 6 },
      ],
    },
  },
  session_20260310_cd34: {
    datasetRoles: [
      { fileName: "users.csv", role: "Customer Data" },
      { fileName: "events.csv", role: "Transaction Data" },
    ],
    columnMapping: {
      "Campaign Type / Channel": "events.csv :: campaign_id",
      "Transaction Date": "events.csv :: timestamp",
      "Transaction Amount": "—",
    },
    uploadedFiles: [
      {
        name: "users.csv",
        headers: ["user_id", "region", "device", "account_age_days"],
        rows: [
          ["U001", "US-East", "mobile", "245"],
          ["U002", "EU-West", "desktop", "512"],
          ["U003", "US-West", "mobile", "89"],
          ["U004", "APAC", "tablet", "330"],
        ],
        totalRows: 8700,
        fileSize: "890 KB",
      },
      {
        name: "events.csv",
        headers: ["event_id", "user_id", "campaign_id", "conversion", "timestamp"],
        rows: [
          ["E001", "U001", "C10", "1", "2025-07-01T10:30:00"],
          ["E002", "U002", "C11", "0", "2025-07-01T11:15:00"],
          ["E003", "U003", "C10", "1", "2025-07-02T09:00:00"],
        ],
        totalRows: 21500,
        fileSize: "2.4 MB",
      },
    ],
    imcMapping: { banner_ad: "advertising", email_blast: "direct_marketing", flash_sale: "promotion" },
    dagEdges: [
      { source: "region", target: "imc_category" },
      { source: "imc_category", target: "conversion" },
      { source: "region", target: "conversion" },
    ],
    reasoning: "Region acts as a confounder between IMC category assignment and conversion. Controlling for region satisfies the backdoor criterion.",
    variables: { treatment: "imc_category", outcome: "conversion", confounders: ["region"], mediators: [], colliders: [] },
    modelResults: {
      consensus_ate: 0.14,
      consensus_att: 0.12,
      agreement_score: 85,
      best_model: "DR-Learner",
      channel_summary: [
        { channel: "Advertising", consensus_ate: 0.16, best_model: "DR-Learner", agreement_score: 86, persuadables_pct: 18 },
        { channel: "Direct Marketing", consensus_ate: 0.11, best_model: "DR-Learner", agreement_score: 82, persuadables_pct: 12 },
        { channel: "Promotion", consensus_ate: 0.09, best_model: "Causal Forest", agreement_score: 79, persuadables_pct: 9 },
      ],
    },
  },
  session_20260308_ef56: {
    datasetRoles: [
      { fileName: "customers.csv", role: "Customer Data" },
      { fileName: "sales.csv", role: "Transaction Data" },
    ],
    columnMapping: {
      "Campaign Type / Channel": "customers.csv :: channel_type",
      "Transaction Date": "sales.csv :: date",
      "Transaction Amount": "sales.csv :: amount",
    },
    uploadedFiles: [
      {
        name: "customers.csv",
        headers: ["customer_id", "channel_type", "revenue", "signup_year"],
        rows: [
          ["C100", "tv_ad", "320.50", "2023"],
          ["C101", "direct_mail", "0", "2024"],
          ["C102", "tv_ad", "189.00", "2023"],
        ],
        totalRows: 5200,
        fileSize: "480 KB",
      },
      {
        name: "sales.csv",
        headers: ["sale_id", "customer_id", "amount", "date"],
        rows: [
          ["S001", "C100", "320.50", "2025-08-10"],
          ["S002", "C102", "189.00", "2025-08-12"],
        ],
        totalRows: 3100,
        fileSize: "310 KB",
      },
    ],
    imcMapping: { tv_ad: "advertising", direct_mail: "direct_marketing" },
    dagEdges: [
      { source: "channel_type", target: "revenue" },
    ],
    reasoning: "Analysis failed: insufficient confounder data to satisfy the backdoor criterion.",
    variables: { treatment: "channel_type", outcome: "revenue", confounders: [], mediators: [], colliders: [] },
  },
};

const statusColors: Record<string, string> = {
  completed: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  in_progress: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
};


// Mock attachment of library DAGs to sessions.
const SESSION_DAG_ATTACHMENT: Record<string, string> = {
  session_20260313_ab12: "dag_marketing_funnel_v1",
  session_20260310_cd34: "dag_loyalty_v2",
};

function SessionDetail({ session, onBack, onViewDashboard, onViewComparison }: {
  session: SessionSummary;
  onBack: () => void;
  onViewDashboard: () => void;
  onViewComparison: () => void;
}) {
  const detail = MOCK_SESSION_DETAILS[session.session_id];
  const { dags } = useDAGLibrary();
  const attachedDag: SavedDAG | null =
    dags.find((d) => d.dag_id === SESSION_DAG_ATTACHMENT[session.session_id]) ?? null;
  const [selectedEdge, setSelectedEdge] = useState<CausalEdgeFull | null>(null);

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
            <TabsTrigger value="causal-id">Causal Identification</TabsTrigger>
            {attachedDag && (
              <TabsTrigger value="causal-structure">Causal Structure</TabsTrigger>
            )}
            {detail.modelResults && <TabsTrigger value="results">Results</TabsTrigger>}
          </TabsList>
        </div>

        {attachedDag && (
          <TabsContent value="causal-structure">
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
          </TabsContent>
        )}

        {/* Tab: Data Overview (Datasets + Column Mapping combined) */}
        <TabsContent value="data-overview">
          <div className="space-y-4">
            {/* Dataset Preview */}
            <SessionDatasetPreview datasets={detail.uploadedFiles} />

            {/* Dataset Roles & Column Mapping side by side on larger screens */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Dataset Roles</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File</TableHead>
                          <TableHead>Assigned Role</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.datasetRoles.map((dr, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-sm">{dr.fileName}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{dr.role}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Column Mapping</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Required Field</TableHead>
                          <TableHead>Mapped Column</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(detail.columnMapping).map(([field, col]) => (
                          <TableRow key={field}>
                            <TableCell className="text-sm font-medium">{field}</TableCell>
                            <TableCell className="font-mono text-sm">{col}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Causal Identification */}
        <TabsContent value="causal-id">
          <Card>
            <CardHeader><CardTitle className="text-base">Causal Identification Variables</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The causal structure defined for this analysis session.
              </p>
              {(() => {
                const tinted = (c: string) => ({
                  backgroundColor: c.replace("hsl(", "hsla(").replace(")", ", 0.18)"),
                  color: c,
                  border: `1px solid ${c.replace("hsl(", "hsla(").replace(")", ", 0.45)")}`,
                });
                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Treatment</span>
                        <div><Badge style={tinted(ROLE_COLORS.treatment)} className="font-semibold">{detail.variables.treatment}</Badge></div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Outcome</span>
                        <div><Badge style={tinted(ROLE_COLORS.outcome)} className="font-semibold">{detail.variables.outcome}</Badge></div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confounders</span>
                        <div className="flex flex-wrap gap-1.5">
                          {detail.variables.confounders.length > 0
                            ? detail.variables.confounders.map((c) => (
                                <Badge key={c} style={tinted(ROLE_COLORS.confounder)} className="text-xs font-semibold">{c}</Badge>
                              ))
                            : <span className="text-xs text-muted-foreground italic">None specified</span>}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mediators</span>
                        <div className="flex flex-wrap gap-1.5">
                          {detail.variables.mediators.length > 0
                            ? detail.variables.mediators.map((m) => (
                                <Badge key={m} style={tinted(ROLE_COLORS.mediator)} className="text-xs font-semibold">{m}</Badge>
                              ))
                            : <span className="text-xs text-muted-foreground italic">None specified</span>}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Colliders</span>
                        <div className="flex flex-wrap gap-1.5">
                          {detail.variables.colliders.length > 0
                            ? detail.variables.colliders.map((c) => (
                                <Badge key={c} style={tinted(ROLE_COLORS.collider)} className="text-xs font-semibold">{c}</Badge>
                              ))
                            : <span className="text-xs text-muted-foreground italic">None specified</span>}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: IMC Categorization */}
        <TabsContent value="imc">
          <Card>
            <CardHeader><CardTitle className="text-base">IMC Exposure Categorization</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Raw campaign types were mapped to standardized IMC exposure categories using AI classification.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign Type</TableHead>
                    <TableHead>IMC Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(detail.imcMapping).map(([campaignType, imcCategory]) => (
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Causal Discovery tab removed — Causal Structure tab covers this. */}

        {/* Tab 4: Results */}
        {detail.modelResults && (
          <TabsContent value="results">
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Consensus ATE</CardTitle>
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent><div className="text-xl font-bold font-mono">{(detail.modelResults.consensus_ate * 100).toFixed(1)}%</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Consensus ATT</CardTitle>
                    <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent><div className="text-xl font-bold font-mono">{(detail.modelResults.consensus_att * 100).toFixed(1)}%</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Agreement Score</CardTitle>
                    <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold font-mono">
                      <Badge variant="outline" className={`text-base px-0 border-0 ${
                        detail.modelResults.agreement_score > 85 ? "text-chart-2" :
                        detail.modelResults.agreement_score >= 70 ? "text-chart-3" : "text-destructive"
                      }`}>
                        {detail.modelResults.agreement_score}%
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Best Model</CardTitle>
                    <Award className="h-3.5 w-3.5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent><div className="text-lg font-semibold">{detail.modelResults.best_model}</div></CardContent>
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
                        <TableHead>Best Model (Qini)</TableHead>
                        <TableHead>Agreement Score</TableHead>
                        <TableHead>Persuadables %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.modelResults.channel_summary.map((row) => (
                        <TableRow key={row.channel}>
                          <TableCell className="font-medium text-sm">{row.channel}</TableCell>
                          <TableCell className="font-mono text-sm">{row.consensus_ate.toFixed(2)}</TableCell>
                          <TableCell className="text-sm">{row.best_model}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${
                              row.agreement_score > 85 ? "bg-chart-2/10 text-chart-2 border-chart-2/20" :
                              row.agreement_score >= 70 ? "bg-chart-3/10 text-chart-3 border-chart-3/20" :
                              "bg-destructive/10 text-destructive border-destructive/20"
                            }`}>
                              {row.agreement_score}%
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{row.persuadables_pct}%</TableCell>
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

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      try {
        return await api.getSessions();
      } catch {
        return MOCK_SESSIONS;
      }
    },
    initialData: MOCK_SESSIONS,
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
        meta={<><span>{(sessions ?? MOCK_SESSIONS).length} sessions</span></>}
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
                  <TableHead className="text-[11px] uppercase tracking-wider">Date</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Treatment</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Outcome</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sessions ?? MOCK_SESSIONS).map((s) => (
                  <TableRow
                    key={s.session_id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setSelectedSession(s)}
                  >
                    <TableCell className="font-mono text-xs">{s.session_id}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.date}</TableCell>
                    <TableCell className="text-xs">{s.treatment}</TableCell>
                    <TableCell className="text-xs">{s.outcome}</TableCell>
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
