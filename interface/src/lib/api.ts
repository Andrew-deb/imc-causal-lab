/**
 * API Client — wired to the FastAPI backend.
 *
 * Backend prefix:  /api/v1
 * Route prefixes:  /datasets, /imc, /causal-discovery, /modeling, /dashboard
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

// ─── Generic request helper ─────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${res.statusText} — ${body}`);
  }
  // 204 No Content (e.g. DELETE)
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

// ─── Shared Types ───────────────────────────────────────────────────

export interface CausalEdge {
  source: string;
  target: string;
  confidence: number;
  relationship_type: "direct" | "confounder" | "mediator";
  reasoning: string;
  origin: "llm" | "manual";
}

export interface VariableRoles {
  confounders: string[];
  mediators: string[];
  colliders: string[];
  instrumental_variables: string[];
}

// ─── Dataset Types ──────────────────────────────────────────────────

export interface UploadResponse {
  session_id: string;
  customers_columns: string[];
  transactions_columns: string[];
  campaigns_columns: string[];
  customers_rows: number;
  transactions_rows: number;
  campaigns_rows: number;
  campaign_types: string[];
}

// ─── IMC Mapping Types ──────────────────────────────────────────────

export interface ImcMappingResponse {
  session_id: string;
  mapping: Record<string, string>;
  unmapped: string[];
}

// ─── Causal Discovery Types ─────────────────────────────────────────

export interface DAGDiscoveryRequest {
  session_id?: string | null;
  variables?: string[] | null;
  treatment_col?: string | null;
  outcome_col?: string | null;
}

export interface DAGDiscoveryResponse {
  session_id: string;
  treatment: string;
  outcome: string;
  domain_expertises: string[];
  edges: CausalEdge[];
  adjacency_list: Record<string, string[]>;
  variable_roles: VariableRoles;
  variables_analyzed: string[];
  model_used: string;
  num_llm_calls: number;
}

// ─── DAG Library Types ──────────────────────────────────────────────

export interface SavedDAG {
  dag_id: string;
  name: string;
  description: string;
  treatment: string;
  outcome: string;
  variables: string[];
  edges: CausalEdge[];
  adjacency_list: Record<string, string[]>;
  variable_roles: VariableRoles;
  creation_mode: "llm_assisted" | "manual";
  model_used: string;
  domain_expertises: string[];
  created_at: string;
  updated_at: string;
}

export interface DAGListItem {
  dag_id: string;
  name: string;
  treatment: string;
  outcome: string;
  edge_count: number;
  variable_count: number;
  creation_mode: string;
  created_at: string;
}

export interface PipelineStep {
  step_number: number;
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  started_at?: string | null;
  duration_ms?: number | null;
  detail?: string | null;
  error?: string | null;
}

export interface PipelineJob {
  job_id: string;
  session_id: string;
  run_id?: string | null;
  pipeline_type: "causal" | "evaluation";
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "interrupted";
  submitted_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  duration_seconds?: number | null;
  config?: Record<string, any> | null;
  steps: PipelineStep[];
  error?: string | null;
  result_snapshot?: Record<string, any> | null;
}

export interface QueueStatus {
  running_count: number;
  queued_count: number;
  max_concurrent: number;
  max_queued: number;
}

export interface SystemEvent {
  event_id: string;
  event_type: string;
  severity: "info" | "warning" | "error";
  session_id?: string | null;
  message: string;
  metadata?: Record<string, any> | null;
  timestamp: string;
}

export interface DAGCreateRequest {
  name: string;
  description?: string;
  treatment: string;
  outcome: string;
  edges: CausalEdge[];
  variable_roles: VariableRoles;
}

export interface DAGVerifyAndSaveRequest {
  name: string;
  description?: string;
  treatment: string;
  outcome: string;
  edges: CausalEdge[];
  variable_roles: VariableRoles;
  domain_expertises?: string[];
  model_used?: string;
  session_id?: string | null;
}

export interface DAGUpdateRequest {
  name?: string;
  description?: string;
  edges?: CausalEdge[];
  variable_roles?: VariableRoles;
}

// ─── Dashboard / Results Types ──────────────────────────────────────

export interface UpliftSegments {
  persuadables: number;
  sure_things: number;
  sleeping_dogs: number;
  lost_causes: number;
}

export interface ModelResult {
  model_name: string;
  ate: number;
  att: number;
  ate_ci?: number[];
  ite_array?: number[];
  cate_by_segment?: Record<string, Record<string, number>>;
  uplift_segments?: UpliftSegments;
  feature_importances?: Record<string, number>;
}

export interface ChannelResult {
  channel_name: string;
  model_results: Record<string, ModelResult>;
  consensus_ate: number;
  consensus_att: number;
  agreement_score: number;
  best_model: string;
  confidence_level: "good" | "weak" | "insufficient";
  mean_outcome_control: number;
  best_model_uplift_auc?: number;
  best_model_qini_auc?: number;
}

export interface CrossModelComparison {
  metrics: Record<string, any>[];
}

export interface AssociativeComparison {
  estimated_effect: Record<string, string>;
  confounding_correction: Record<string, string>;
  individual_targeting: Record<string, string>;
  interpretation: Record<string, string>;
}

export interface ChannelSummary {
  channel: string;
  consensus_ate: number;
  best_model: string;
  agreement_score: number;
  persuadables_pct: number;
  confidence_level: string;
}

export interface TreatmentBalanceResult {
  imc_category: string;
  treated_count: number;
  control_count: number;
  treated_pct: number;
  status: "good" | "warning" | "insufficient" | "not_in_dataset";
  message: string;
}

export interface SessionResults {
  session_id: string;
  channel_ranking: {
    rank: number;
    channel: string;
    consensus_ate: number;
    confidence_level: string;
  }[];
  campaign_type_count: number;
  channel_data: Record<string, ChannelResult>;
  balance_results: TreatmentBalanceResult[];
  cross_model_comparison: Record<string, CrossModelComparison>;
  channel_summary: ChannelSummary[];
}

export interface CurveData {
  fractions: number[];
  values: number[];
}

export interface EvaluationMetrics {
  uplift_auc?: number;
  qini_auc?: number;
  precision_at_k?: number;
  recall_at_k?: number;
  base_classifier_auc?: number;
  uplift_curve?: CurveData;
  qini_curve?: CurveData;
}

export interface ModelEvaluationResult {
  model_name: string;
  metrics: EvaluationMetrics;
}

export interface ChannelEvaluationResult {
  channel_name: string;
  model_evaluations: Record<string, ModelEvaluationResult>;
}

export interface ChannelDescriptiveStats {
  channel_name: string;
  n_treated: number;
  n_control: number;
  stats: {
    variable: string;
    treated_mean: number;
    control_mean: number;
    std_diff: number;
  }[];
}

export interface EvaluationResponse {
  session_id: string;
  channel_evaluations: Record<string, ChannelEvaluationResult>;
  descriptive_statistics: Record<string, ChannelDescriptiveStats>;
  model_performance_summary: Record<string, any>[];
  best_model_per_channel: Record<string, string>;
  associative_vs_causal: Record<string, AssociativeComparison>;
}

// ─── Session Types ──

export interface SessionSummary {
  session_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  dataset_meta?: Record<string, any>;
  has_results: boolean;
  has_evaluation: boolean;
}

export interface SessionDetailResponse extends SessionSummary {
  imc_mapping?: Record<string, string>;
  column_mapping?: Record<string, string>;
  dag_id?: string;
  dataset_roles?: Record<string, any>;
  result?: SessionResults;
  evaluation_result?: EvaluationResponse;
}

export interface DataPreviewResponse {
  session_id: string;
  datasets: Record<string, {
    headers: string[];
    rows: any[][];
    total_rows: number;
  }>;
}

// ─── API Functions ──────────────────────────────────────────────────

export const api = {
  // ── Dataset ──
  uploadDataset: (formData: FormData) =>
    fetch(`${API_BASE}/datasets/upload`, { method: "POST", body: formData }).then(
      async (r) => {
        if (!r.ok) throw new Error("Upload failed");
        return r.json() as Promise<UploadResponse>;
      }
    ),

  getColumns: (sessionId: string) =>
    request<{ session_id: string; customers_columns: string[]; transactions_columns: string[]; campaigns_columns: string[] }>(
      `/datasets/columns/${sessionId}`
    ),

  // ── IMC Mapping ──
  // POST /imc/map-campaigns generates the mapping AND saves it to the session.
  // The frontend schema difference: backend expects `campaign_values`, not `campaign_types`.
  generateImcMapping: (sessionId: string, campaignTypes: string[]) =>
    request<ImcMappingResponse>("/imc/map-campaigns", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, campaign_values: campaignTypes }),
    }),

  // Explicitly confirm and save the IMC mapping to the backend session.
  // This ensures that resumed sessions or edited mappings are synced.
  confirmImcMapping: async (sessionId: string, mapping: Record<string, string>) =>
    request<{ status: string; session_id: string }>("/imc/confirm-mapping", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, mapping }),
    }),

  deleteSession: (sessionId: string) =>
    request<{ status: string; message: string }>(`/sessions/${sessionId}`, {
      method: "DELETE",
    }),

  getSessionDetail: (sessionId: string) =>
    request<SessionDetailResponse>(`/sessions/${sessionId}`),

  attachDagToSession: (sessionId: string, dagId: string) =>
    request<{ status: string; session_id: string; dag_id: string }>(`/sessions/${sessionId}/attach-dag`, {
      method: "PATCH",
      body: JSON.stringify({ dag_id: dagId }),
    }),

  getDataPreview: (sessionId: string, rows: number = 5) =>
    request<DataPreviewResponse>(`/sessions/${sessionId}/data-preview?rows=${rows}`),

  // ── Causal Discovery (LLM) ──
  discoverDag: (payload: DAGDiscoveryRequest) =>
    request<DAGDiscoveryResponse>("/causal-discovery/discover", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // ── DAG Library CRUD ──
  listDags: () => request<DAGListItem[]>("/causal-discovery/dags"),

  getDag: (dagId: string) => request<SavedDAG>(`/causal-discovery/dags/${dagId}`),

  createDag: (payload: DAGCreateRequest) =>
    request<SavedDAG>("/causal-discovery/dags", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  verifyAndSaveDag: (payload: DAGVerifyAndSaveRequest) =>
    request<SavedDAG>("/causal-discovery/dags/verify-and-save", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateDag: (dagId: string, payload: DAGUpdateRequest) =>
    request<SavedDAG>(`/causal-discovery/dags/${dagId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteDag: (dagId: string) =>
    request<void>(`/causal-discovery/dags/${dagId}`, { method: "DELETE" }),

  // ── Modeling ──
  runCausalModels: (sessionId: string) =>
    request<{ status: string }>("/modeling/run-pipeline", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    }),

  runAsyncAnalysis: (sessionId: string) =>
    request<{
      status: string;
      session_id: string;
      modeling_job_id: string;
      evaluation_job_id: string;
    }>("/modeling/run-async", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    }),

  runEvaluation: (sessionId: string) =>
    request<EvaluationResponse>("/modeling/evaluate", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    }),

  // ── Dashboard ──
  getSessionResults: (sessionId: string) =>
    request<SessionResults>(`/dashboard/results/${sessionId}`),

  getEvaluationResults: (sessionId: string) =>
    request<EvaluationResponse>(`/dashboard/evaluation/${sessionId}`),

  getSessionStatus: (sessionId: string) =>
    request<{ session_id: string; status: string; has_results: boolean }>(
      `/dashboard/status/${sessionId}`
    ),

  // ── Sessions ──
  getSessions: () => request<SessionSummary[]>("/sessions"),


  // ── Detailed Comparison (no backend yet) ──
  getDetailedComparison: (sessionId: string) =>
    request<DetailedComparison>(`/sessions/${sessionId}/detailed-comparison`),

  getTreatmentBalance: (sessionId: string) =>
    request<TreatmentBalanceResult[]>(`/sessions/${sessionId}/treatment-balance`),

  // ── Pipeline Monitoring & Queue ──
  getPipelineJobs: (sessionId?: string) =>
    request<PipelineJob[]>(`/pipeline/jobs${sessionId ? `?session_id=${sessionId}` : ""}`),

  getJobDetails: (jobId: string) =>
    request<PipelineJob>(`/pipeline/jobs/${jobId}`),

  cancelPipelineJob: (jobId: string) =>
    request<{ status: string; message: string }>(`/pipeline/jobs/${jobId}`, {
      method: "DELETE",
    }),

  getQueueStatus: () =>
    request<QueueStatus>("/pipeline/queue/status"),

  getSystemEvents: (sessionId?: string, severity?: string) => {
    const params = new URLSearchParams();
    if (sessionId) params.append("session_id", sessionId);
    if (severity) params.append("severity", severity);
    const query = params.toString() ? `?${params.toString()}` : "";
    return request<SystemEvent[]>(`/pipeline/logs/events${query}`);
  },
};
