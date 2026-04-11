const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// Types
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

export interface UploadResponse {
  session_id: string;
  campaign_types: string[];
  columns: string[];
}

export interface ImcMapping {
  mapping: Record<string, string>;
}

export interface CausalDiscoveryResult {
  dag_edges: { source: string; target: string }[];
  reasoning: string;
  selected_variables: {
    treatment: string;
    outcome: string;
    confounders: string[];
    mediators: string[];
    colliders: string[];
  };
}

export interface SessionSummary {
  session_id: string;
  date: string;
  treatment: string;
  outcome: string;
  status: "completed" | "in_progress" | "failed";
}

export interface ExplainabilityData {
  variable_roles: Record<string, string>;
  imc_mapping: Record<string, string>;
  dag_edges: { source: string; target: string }[];
  reasoning: string;
  metrics: Record<string, number>;
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
  status: "good" | "weak" | "insufficient";
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

// API functions
export const api = {
  getSessionResults: (sessionId: string) =>
    request<SessionResults>(`/session/${sessionId}/results`),

  uploadDataset: (formData: FormData) =>
    fetch(`${API_BASE}/upload-dataset`, { method: "POST", body: formData }).then(
      (r) => {
        if (!r.ok) throw new Error("Upload failed");
        return r.json() as Promise<UploadResponse>;
      }
    ),

  generateImcMapping: (sessionId: string, campaignTypes: string[]) =>
    request<ImcMapping>("/generate-imc-mapping", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, campaign_types: campaignTypes }),
    }),

  confirmImcMapping: (sessionId: string, mapping: Record<string, string>) =>
    request<{ status: string }>("/confirm-imc-mapping", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, mapping }),
    }),

  runCausalDiscovery: (
    sessionId: string,
    treatment: string,
    outcome: string,
    confounders: string[],
    mediators?: string[],
    colliders?: string[]
  ) =>
    request<CausalDiscoveryResult>("/run-causal-discovery", {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        treatment,
        outcome,
        confounders,
        mediators,
        colliders,
      }),
    }),

  getCausalDiscovery: (sessionId: string) =>
    request<CausalDiscoveryResult>(`/session/${sessionId}/causal-discovery`),

  runCausalModels: (sessionId: string) =>
    request<{ status: string }>("/run-causal-models", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    }),

  getSessions: () => request<SessionSummary[]>("/sessions"),

  getSession: (sessionId: string) =>
    request<SessionResults>(`/session/${sessionId}`),

  getExplainability: (sessionId: string) =>
    request<ExplainabilityData>(`/session/${sessionId}/explainability`),

  getDetailedComparison: (sessionId: string) =>
    request<DetailedComparison>(`/session/${sessionId}/detailed-comparison`),

  getTreatmentBalance: (sessionId: string) =>
    request<TreatmentBalanceResult[]>(`/session/${sessionId}/treatment-balance`),
};
