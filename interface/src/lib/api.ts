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

export interface SessionResults {
  ATE: number;
  ATT: number;
  customer_count: number;
  campaign_type_count: number;
  channel_ranking: { channel: string; effect: number }[];
  uplift_segments: {
    persuadables: number;
    sure_things: number;
    sleeping_dogs: number;
    lost_causes: number;
  };
  cate_analysis: Record<string, Record<string, number>>;
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

// ─── Session Types (for Session History — no backend yet, mock-compatible) ──

export interface SessionSummary {
  session_id: string;
  date: string;
  treatment: string;
  outcome: string;
  status: "completed" | "in_progress" | "failed";
}

export interface CrossModelComparison {
  metrics: {
    metric: string;
    t_learner: number | string;
    dr_learner: number | string;
    causal_forest: number | string;
    consensus: number | string;
  }[];
}

export interface AssociativeComparison {
  channel: string;
  associative_effect: number;
  causal_ate: number;
  overestimation: string;
  confounding_correction: string;
}

export interface TreatmentBalanceResult {
  imc_category: string;
  treated_count: number;
  control_count: number;
  treated_pct: number;
  status: "good" | "warning" | "insufficient" | "not_in_dataset";
  message: string;
}

export interface ChannelSummary {
  channel: string;
  consensus_ate: number;
  best_model: string;
  agreement_score: number;
  persuadables_pct: number;
  confidence_level: "good" | "weak" | "insufficient";
}

export interface DetailedComparison {
  cross_model: Record<string, CrossModelComparison>;
  associative_vs_causal: AssociativeComparison[];
  channel_summary: ChannelSummary[];
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

  // ── Dashboard ──
  getSessionResults: (sessionId: string) =>
    request<SessionResults>(`/dashboard/results/${sessionId}`),

  getSessionStatus: (sessionId: string) =>
    request<{ session_id: string; status: string; has_results: boolean }>(
      `/dashboard/status/${sessionId}`
    ),

  // ── Sessions ──
  getSessions: () => request<SessionSummary[]>("/sessions"),

  getSessionDetail: (sessionId: string) =>
    request<{
      session_id: string;
      status: string;
      created_at: string;
      updated_at: string;
      dataset_meta: Record<string, unknown> | null;
      imc_mapping: Record<string, string> | null;
      column_mapping: Record<string, string> | null;
      dag_id: string | null;
      has_results: boolean;
      result?: Record<string, unknown> | null;
    }>(`/sessions/${sessionId}`),

  // ── Detailed Comparison (no backend yet) ──
  getDetailedComparison: (sessionId: string) =>
    request<DetailedComparison>(`/sessions/${sessionId}/detailed-comparison`),

  getTreatmentBalance: (sessionId: string) =>
    request<TreatmentBalanceResult[]>(`/sessions/${sessionId}/treatment-balance`),
};
