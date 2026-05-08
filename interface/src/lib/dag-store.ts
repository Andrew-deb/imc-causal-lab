// Local DAG Library store — mocks the backend with localStorage persistence.
// Mirrors the SavedDAG schema. When a real API exists, swap these calls for fetch().

import { useEffect, useState, useCallback } from "react";

export interface CausalEdgeFull {
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

export interface SavedDAG {
  dag_id: string;
  name: string;
  description: string;
  treatment: string;
  outcome: string;
  variables: string[];
  edges: CausalEdgeFull[];
  adjacency_list: Record<string, string[]>;
  variable_roles: VariableRoles;
  creation_mode: "llm_assisted" | "manual";
  model_used: string;
  domain_expertises: string[];
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY = "causal_dag_library_v1";

const SEED_DAGS: SavedDAG[] = [
  {
    dag_id: "dag_marketing_funnel_v1",
    name: "Marketing Funnel v1",
    description: "Baseline IMC → engagement → purchase model with demographic confounders.",
    treatment: "IMC_Exposure",
    outcome: "purchase",
    variables: ["IMC_Exposure", "purchase", "age", "income", "engagement"],
    edges: [
      { source: "age", target: "IMC_Exposure", confidence: 0.82, relationship_type: "confounder", reasoning: "Age influences which marketing channel a customer is exposed to and independently affects purchase likelihood.", origin: "llm" },
      { source: "age", target: "purchase", confidence: 0.78, relationship_type: "confounder", reasoning: "Age is a strong baseline predictor of purchase behaviour.", origin: "llm" },
      { source: "income", target: "IMC_Exposure", confidence: 0.71, relationship_type: "confounder", reasoning: "Income affects channel exposure — higher-income customers see premium ad placements.", origin: "llm" },
      { source: "income", target: "purchase", confidence: 0.85, relationship_type: "confounder", reasoning: "Income is one of the strongest predictors of purchase amount.", origin: "llm" },
      { source: "IMC_Exposure", target: "engagement", confidence: 0.74, relationship_type: "mediator", reasoning: "The marketing channel drives engagement (clicks, opens), which influences purchase.", origin: "llm" },
      { source: "engagement", target: "purchase", confidence: 0.81, relationship_type: "mediator", reasoning: "Higher engagement reliably translates into higher conversion.", origin: "llm" },
      { source: "IMC_Exposure", target: "purchase", confidence: 0.68, relationship_type: "direct", reasoning: "Direct causal effect of channel assignment on purchase, holding confounders fixed.", origin: "llm" },
    ],
    adjacency_list: {},
    variable_roles: {
      confounders: ["age", "income"],
      mediators: ["engagement"],
      colliders: [],
      instrumental_variables: [],
    },
    creation_mode: "llm_assisted",
    model_used: "gpt-4o",
    domain_expertises: ["Marketing analytics", "Consumer behaviour"],
    created_at: "2026-04-12T10:24:00Z",
    updated_at: "2026-04-12T10:24:00Z",
  },
  {
    dag_id: "dag_loyalty_v2",
    name: "Loyalty Program (Manual)",
    description: "Hand-crafted DAG focusing on tenure as an instrumental variable.",
    treatment: "IMC_Exposure",
    outcome: "repeat_purchase",
    variables: ["IMC_Exposure", "repeat_purchase", "tenure", "satisfaction"],
    edges: [
      { source: "tenure", target: "IMC_Exposure", confidence: 1.0, relationship_type: "confounder", reasoning: "Manually specified by domain expert.", origin: "manual" },
      { source: "IMC_Exposure", target: "satisfaction", confidence: 1.0, relationship_type: "mediator", reasoning: "Manually specified by domain expert.", origin: "manual" },
      { source: "satisfaction", target: "repeat_purchase", confidence: 1.0, relationship_type: "mediator", reasoning: "Manually specified by domain expert.", origin: "manual" },
      { source: "IMC_Exposure", target: "repeat_purchase", confidence: 1.0, relationship_type: "direct", reasoning: "Manually specified by domain expert.", origin: "manual" },
    ],
    adjacency_list: {},
    variable_roles: {
      confounders: ["tenure"],
      mediators: ["satisfaction"],
      colliders: [],
      instrumental_variables: [],
    },
    creation_mode: "manual",
    model_used: "manual",
    domain_expertises: ["CRM"],
    created_at: "2026-03-20T14:10:00Z",
    updated_at: "2026-03-20T14:10:00Z",
  },
];

function load(): SavedDAG[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DAGS));
      return SEED_DAGS;
    }
    return JSON.parse(raw) as SavedDAG[];
  } catch {
    return SEED_DAGS;
  }
}

function persist(dags: SavedDAG[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(dags)); } catch { /* ignore */ }
}

function buildAdjacency(edges: CausalEdgeFull[]): Record<string, string[]> {
  const adj: Record<string, string[]> = {};
  edges.forEach((e) => {
    if (!adj[e.source]) adj[e.source] = [];
    adj[e.source].push(e.target);
  });
  return adj;
}

export const dagStore = {
  list(): SavedDAG[] {
    return load().sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  },
  get(id: string): SavedDAG | null {
    return load().find((d) => d.dag_id === id) ?? null;
  },
  save(dag: Omit<SavedDAG, "dag_id" | "created_at" | "updated_at" | "adjacency_list"> & { dag_id?: string }): SavedDAG {
    const now = new Date().toISOString();
    const existing = load();
    if (dag.dag_id) {
      const idx = existing.findIndex((d) => d.dag_id === dag.dag_id);
      if (idx >= 0) {
        const updated: SavedDAG = {
          ...existing[idx],
          ...dag,
          dag_id: dag.dag_id,
          adjacency_list: buildAdjacency(dag.edges),
          updated_at: now,
        };
        existing[idx] = updated;
        persist(existing);
        return updated;
      }
    }
    const created: SavedDAG = {
      ...dag,
      dag_id: `dag_${Date.now().toString(36)}`,
      adjacency_list: buildAdjacency(dag.edges),
      created_at: now,
      updated_at: now,
    };
    existing.unshift(created);
    persist(existing);
    return created;
  },
  delete(id: string) {
    persist(load().filter((d) => d.dag_id !== id));
  },
  rename(id: string, name: string) {
    const all = load();
    const idx = all.findIndex((d) => d.dag_id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], name, updated_at: new Date().toISOString() };
      persist(all);
    }
  },
};

// Hook — re-reads on mutation events.
const EVT = "dag-store-changed";
function emit() { window.dispatchEvent(new Event(EVT)); }

export function useDAGLibrary() {
  const [dags, setDags] = useState<SavedDAG[]>(() => dagStore.list());
  useEffect(() => {
    const refresh = () => setDags(dagStore.list());
    window.addEventListener(EVT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const save = useCallback((dag: Parameters<typeof dagStore.save>[0]) => {
    const r = dagStore.save(dag); emit(); return r;
  }, []);
  const remove = useCallback((id: string) => { dagStore.delete(id); emit(); }, []);
  const rename = useCallback((id: string, name: string) => { dagStore.rename(id, name); emit(); }, []);
  return { dags, save, remove, rename };
}

// Mock LLM discovery — used by the AI builder when no backend is available.
export async function mockDiscoverDAG(input: {
  variables: string[]; treatment: string; outcome: string; name: string;
}): Promise<Pick<SavedDAG, "edges" | "variable_roles" | "domain_expertises" | "model_used">> {
  await new Promise((r) => setTimeout(r, 1400));
  const others = input.variables.filter((v) => v !== input.treatment && v !== input.outcome);
  // First two → confounders, next → mediator, rest stay free.
  const confounders = others.slice(0, 2);
  const mediators = others.slice(2, 3);
  const edges: CausalEdgeFull[] = [];
  confounders.forEach((c) => {
    edges.push({ source: c, target: input.treatment, confidence: 0.78, relationship_type: "confounder", reasoning: `${c} likely influences both ${input.treatment} assignment and ${input.outcome}, creating a backdoor path.`, origin: "llm" });
    edges.push({ source: c, target: input.outcome, confidence: 0.74, relationship_type: "confounder", reasoning: `${c} is a baseline predictor of ${input.outcome}.`, origin: "llm" });
  });
  mediators.forEach((m) => {
    edges.push({ source: input.treatment, target: m, confidence: 0.72, relationship_type: "mediator", reasoning: `${input.treatment} drives ${m}, which sits causally before ${input.outcome}.`, origin: "llm" });
    edges.push({ source: m, target: input.outcome, confidence: 0.76, relationship_type: "mediator", reasoning: `${m} translates into ${input.outcome}.`, origin: "llm" });
  });
  edges.push({ source: input.treatment, target: input.outcome, confidence: 0.65, relationship_type: "direct", reasoning: `Direct causal effect of ${input.treatment} on ${input.outcome}, holding confounders fixed.`, origin: "llm" });
  return {
    edges,
    variable_roles: { confounders, mediators, colliders: [], instrumental_variables: [] },
    domain_expertises: ["Marketing analytics", "Consumer behaviour"],
    model_used: "mock-llm",
  };
}
