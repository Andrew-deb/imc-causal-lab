import React, { createContext, useContext, useState, ReactNode } from "react";

interface SessionState {
  sessionId: string | null;
  campaignTypes: string[];
  columns: string[];
  imcMapping: Record<string, string>;
}

interface SessionContextType extends SessionState {
  setSessionId: (id: string) => void;
  setCampaignTypes: (types: string[]) => void;
  setColumns: (cols: string[]) => void;
  setImcMapping: (mapping: Record<string, string>) => void;
  reset: () => void;
}

const initial: SessionState = {
  sessionId: null,
  campaignTypes: [],
  columns: [],
  imcMapping: {},
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(initial);

  const value: SessionContextType = {
    ...state,
    setSessionId: (id) => setState((s) => ({ ...s, sessionId: id })),
    setCampaignTypes: (types) => setState((s) => ({ ...s, campaignTypes: types })),
    setColumns: (cols) => setState((s) => ({ ...s, columns: cols })),
    setImcMapping: (mapping) => setState((s) => ({ ...s, imcMapping: mapping })),
    reset: () => setState(initial),
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
