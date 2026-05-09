/**
 * DAG Library Store — wired to the real backend API.
 *
 * Provides the `useDAGLibrary` hook and the `discoverDag` function.
 * All CRUD operations go through fetch → backend → MongoDB.
 * The hook interface is identical to the old localStorage version,
 * so consuming components don't need to change their signatures.
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import type {
  SavedDAG as APISavedDAG,
  CausalEdge,
  VariableRoles,
  DAGDiscoveryResponse,
} from "./api";

// Re-export types that match the backend schema exactly.
export type CausalEdgeFull = CausalEdge;
export type { VariableRoles };

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

/**
 * Normalise the backend response into the SavedDAG shape.
 * Handles ISO datetime serialisation differences.
 */
function normalise(raw: APISavedDAG): SavedDAG {
  return {
    ...raw,
    created_at: typeof raw.created_at === "string" ? raw.created_at : new Date().toISOString(),
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : new Date().toISOString(),
  };
}

// ── Internal event bus (for refreshing after mutations) ─────────────
const EVT = "dag-store-changed";
function emit() {
  window.dispatchEvent(new Event(EVT));
}

/**
 * React hook — fetches DAGs from the backend and re-fetches on mutation.
 * Keeps the same return signature as the old localStorage-based hook.
 */
export function useDAGLibrary() {
  const [dags, setDags] = useState<SavedDAG[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDags = useCallback(async () => {
    try {
      // listDags returns DAGListItem[] (lightweight).
      // For the studio we need full SavedDAG objects, so we fetch each one.
      // But for performance, first try the list endpoint and if the shapes
      // match (they include edges), use those directly.
      const items = await api.listDags();

      // DAGListItem is lightweight (no edges). Fetch full DAG for each.
      const full = await Promise.all(items.map((item) => api.getDag(item.dag_id)));
      setDags(full.map(normalise));
    } catch (err) {
      console.error("[dag-store] Failed to fetch DAGs:", err);
      setDags([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDags();
    // Re-fetch when any mutation fires the event.
    window.addEventListener(EVT, fetchDags);
    return () => window.removeEventListener(EVT, fetchDags);
  }, [fetchDags]);

  /**
   * Save a DAG — creates via `verify-and-save` (LLM-assisted) or
   * `POST /dags` (manual), then refreshes the list.
   */
  const save = useCallback(
    async (
      dag: Omit<SavedDAG, "dag_id" | "created_at" | "updated_at" | "adjacency_list"> & {
        dag_id?: string;
      }
    ): Promise<SavedDAG> => {
      let saved: APISavedDAG;

      if (dag.dag_id) {
        // Update existing
        saved = await api.updateDag(dag.dag_id, {
          name: dag.name,
          description: dag.description,
          edges: dag.edges,
          variable_roles: dag.variable_roles,
        });
      } else if (dag.creation_mode === "llm_assisted") {
        // LLM-assisted → verify-and-save
        saved = await api.verifyAndSaveDag({
          name: dag.name,
          description: dag.description,
          treatment: dag.treatment,
          outcome: dag.outcome,
          edges: dag.edges,
          variable_roles: dag.variable_roles,
          domain_expertises: dag.domain_expertises,
          model_used: dag.model_used,
        });
      } else {
        // Manual creation
        saved = await api.createDag({
          name: dag.name,
          description: dag.description,
          treatment: dag.treatment,
          outcome: dag.outcome,
          edges: dag.edges,
          variable_roles: dag.variable_roles,
        });
      }

      emit();
      return normalise(saved);
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    try {
      await api.deleteDag(id);
    } catch (err) {
      console.error("[dag-store] Delete failed:", err);
      throw err;
    }
    emit();
  }, []);

  const rename = useCallback(async (id: string, name: string) => {
    try {
      await api.updateDag(id, { name });
    } catch (err) {
      console.error("[dag-store] Rename failed:", err);
      throw err;
    }
    emit();
  }, []);

  return { dags, loading, save, remove, rename };
}

/**
 * Calls the real LLM discovery endpoint.
 * Returns the shape the AIBuilder expects.
 */
export async function discoverDAG(input: {
  variables: string[];
  treatment: string;
  outcome: string;
  sessionId?: string | null;
}): Promise<
  Pick<SavedDAG, "edges" | "variable_roles" | "domain_expertises" | "model_used">
> {
  const res: DAGDiscoveryResponse = await api.discoverDag({
    session_id: input.sessionId ?? null,
    variables: input.variables,
    treatment_col: input.treatment,
    outcome_col: input.outcome,
  });

  return {
    edges: res.edges,
    variable_roles: res.variable_roles,
    domain_expertises: res.domain_expertises,
    model_used: res.model_used,
  };
}
