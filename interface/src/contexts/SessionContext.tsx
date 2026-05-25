import React, { createContext, useContext, useState, ReactNode } from "react";

interface SessionState {
  sessionId: string | null;
  campaignTypes: string[];
  columns: string[];
  imcMapping: Record<string, string>;
  selectedDagId: string | null;
}

interface SessionContextType extends SessionState {
  setSessionId: (id: string) => void;
  setCampaignTypes: (types: string[]) => void;
  setColumns: (cols: string[]) => void;
  setImcMapping: (mapping: Record<string, string>) => void;
  setSelectedDagId: (id: string | null) => void;
  reset: () => void;
}

const getStoredSessionId = (): string | null => {
  try {
    return sessionStorage.getItem("sessionId") || null;
  } catch {
    return null;
  }
};

const initial: SessionState = {
  sessionId: getStoredSessionId(),
  campaignTypes: [],
  columns: [],
  imcMapping: {},
  selectedDagId: null,
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(initial);

  const value: SessionContextType = {
    ...state,
    setSessionId: (id) => {
      setState((s) => ({ ...s, sessionId: id }));
      try {
        sessionStorage.setItem("sessionId", id);
      } catch (e) {
        console.warn("Failed to save sessionId in sessionStorage", e);
      }
    },
    setCampaignTypes: (types) => setState((s) => ({ ...s, campaignTypes: types })),
    setColumns: (cols) => setState((s) => ({ ...s, columns: cols })),
    setImcMapping: (mapping) => setState((s) => ({ ...s, imcMapping: mapping })),
    setSelectedDagId: (id) => setState((s) => ({ ...s, selectedDagId: id })),
    reset: () => {
      setState({
        sessionId: null,
        campaignTypes: [],
        columns: [],
        imcMapping: {},
        selectedDagId: null,
      });
      try {
        sessionStorage.removeItem("sessionId");
      } catch (e) {}
    },
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
