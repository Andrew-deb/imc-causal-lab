// ──────────────────────────────────────────────────────────────────────────────
// auth-wrapper.tsx  –  Crash-proof Clerk integration.
//
// ARCHITECTURE:
//   - @clerk/clerk-react is loaded via dynamic import() — no top-level import
//   - A "ClerkAuthBridge" component sits INSIDE ClerkProvider and unconditionally
//     calls Clerk's useAuth(), forwarding the result into our own AuthStateContext
//   - All consumer code uses our useAuth() which is just useContext() — no
//     conditional hooks, no Rules of Hooks violations
//   - If Clerk fails at any level, the app renders in Guest Demo Mode
// ──────────────────────────────────────────────────────────────────────────────
import React, { createContext, useContext, useState, useEffect, useRef } from "react";

// ── Key validation ──────────────────────────────────────────────────────────
const rawKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "").trim();

function isValidClerkKey(key: string): boolean {
  if (!key) return false;
  if (!(key.startsWith("pk_test_") || key.startsWith("pk_live_"))) return false;
  const parts = key.split("_");
  if (parts.length !== 3) return false;
  try {
    const decoded = atob(parts[2]);
    return decoded.endsWith("$");
  } catch {
    return false;
  }
}

const clerkKeyIsValid = isValidClerkKey(rawKey);
export const hasClerk = clerkKeyIsValid;

if (!rawKey) {
  console.info("[auth-wrapper] No VITE_CLERK_PUBLISHABLE_KEY. Guest Demo Mode.");
} else if (!clerkKeyIsValid) {
  console.warn("[auth-wrapper] Invalid VITE_CLERK_PUBLISHABLE_KEY. Guest Demo Mode.");
} else {
  console.info("[auth-wrapper] Valid Clerk key detected.");
}

// ── Clerk module cache ──────────────────────────────────────────────────────
let clerkModule: any = null;

// ── Auth state context (the SINGLE source of truth for all consumers) ───────
interface AuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  getToken: () => Promise<string | null>;
}

const GUEST_AUTH: AuthState = {
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  getToken: async () => null,
};

const AuthStateContext = createContext<AuthState>(GUEST_AUTH);

// ── Public hook: consumers call this. It's just useContext — always safe. ────
export const useAuth = (): AuthState => {
  return useContext(AuthStateContext);
};

// ── Clerk-active flag context (for components that render Clerk UI) ──────────
const ClerkActiveContext = createContext<boolean>(false);

export function useClerkActive(): boolean {
  return useContext(ClerkActiveContext);
}

// ── Components ──────────────────────────────────────────────────────────────
export const UserButton = (props: any) => {
  const active = useContext(ClerkActiveContext);
  if (active && clerkModule) {
    const Btn = clerkModule.UserButton;
    return <Btn {...props} />;
  }
  return null;
};

export const SignIn = (props: any) => {
  const active = useContext(ClerkActiveContext);
  if (active && clerkModule) {
    const SI = clerkModule.SignIn;
    return <SI {...props} />;
  }
  return (
    <div className="p-8 text-center max-w-sm mx-auto bg-slate-900 border border-slate-800 rounded-xl space-y-4">
      <h3 className="text-lg font-bold text-white">Authentication Disabled</h3>
      <p className="text-xs text-slate-400 leading-relaxed">
        Sign-in is unavailable. Configure a valid Clerk publishable key in your .env file.
      </p>
      <div className="text-[11px] font-mono bg-slate-950 p-2 rounded text-slate-500 border border-slate-800">
        VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
      </div>
    </div>
  );
};

export const SignUp = (props: any) => {
  const active = useContext(ClerkActiveContext);
  if (active && clerkModule) {
    const SU = clerkModule.SignUp;
    return <SU {...props} />;
  }
  return (
    <div className="p-8 text-center max-w-sm mx-auto bg-slate-900 border border-slate-800 rounded-xl space-y-4">
      <h3 className="text-lg font-bold text-white">Registration Disabled</h3>
      <p className="text-xs text-slate-400 leading-relaxed">
        Sign-up is unavailable. Configure a valid Clerk publishable key in your .env file.
      </p>
      <div className="text-[11px] font-mono bg-slate-950 p-2 rounded text-slate-500 border border-slate-800">
        VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
      </div>
    </div>
  );
};

// ── ClerkAuthBridge ─────────────────────────────────────────────────────────
// This component sits INSIDE ClerkProvider and UNCONDITIONALLY calls Clerk's
// useAuth(). It then forwards the result into our AuthStateContext so that
// downstream consumers never need to call Clerk hooks directly.
// Because this component is only mounted when Clerk is active, the hook
// call count is always stable — no Rules of Hooks violation.
function ClerkAuthBridge({ children }: { children: React.ReactNode }) {
  const clerkAuth = clerkModule.useAuth();
  const authState: AuthState = {
    isLoaded: clerkAuth.isLoaded ?? true,
    isSignedIn: clerkAuth.isSignedIn ?? false,
    userId: clerkAuth.userId ?? null,
    getToken: clerkAuth.getToken ?? (async () => null),
  };
  return (
    <AuthStateContext.Provider value={authState}>
      {children}
    </AuthStateContext.Provider>
  );
}

// ── Error Boundary ──────────────────────────────────────────────────────────
class ClerkErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, info: any) {
    console.error("[auth-wrapper] ClerkProvider crashed:", error, info);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      // Render children — they'll get GUEST_AUTH from the default AuthStateContext
      return <>{this.props.children}</>;
    }
    return this.props.children;
  }
}

// ── Provider Wrapper (top-level) ────────────────────────────────────────────
export const ClerkProviderWrapper = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "failed">(
    clerkKeyIsValid ? "loading" : "idle"
  );
  const [clerkActive, setClerkActive] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Dynamic import of @clerk/clerk-react
  useEffect(() => {
    if (!clerkKeyIsValid) return;

    import("@clerk/clerk-react")
      .then((mod) => {
        if (!mountedRef.current) return;
        clerkModule = mod;
        setStatus("ready");
        setClerkActive(true);
        console.info("[auth-wrapper] @clerk/clerk-react loaded successfully.");
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        console.error("[auth-wrapper] Failed to load @clerk/clerk-react:", err);
        setStatus("failed");
      });
  }, []);

  const handleBoundaryError = () => {
    setClerkActive(false);
  };

  // No valid key or import failed → guest mode
  if (status === "idle" || status === "failed") {
    return (
      <ClerkActiveContext.Provider value={false}>
        <AuthStateContext.Provider value={GUEST_AUTH}>
          {children}
        </AuthStateContext.Provider>
      </ClerkActiveContext.Provider>
    );
  }

  // Still loading the Clerk module
  if (status === "loading") {
    return (
      <ClerkActiveContext.Provider value={false}>
        <AuthStateContext.Provider value={{ ...GUEST_AUTH, isLoaded: false }}>
          {children}
        </AuthStateContext.Provider>
      </ClerkActiveContext.Provider>
    );
  }

  // Clerk module loaded — mount ClerkProvider + ClerkAuthBridge
  const ClerkProvider = clerkModule.ClerkProvider;
  return (
    <ClerkActiveContext.Provider value={clerkActive}>
      <ClerkErrorBoundary onError={handleBoundaryError}>
        {clerkActive ? (
          <ClerkProvider publishableKey={rawKey} afterSignOutUrl="/">
            <ClerkAuthBridge>
              {children}
            </ClerkAuthBridge>
          </ClerkProvider>
        ) : (
          <AuthStateContext.Provider value={GUEST_AUTH}>
            {children}
          </AuthStateContext.Provider>
        )}
      </ClerkErrorBoundary>
    </ClerkActiveContext.Provider>
  );
};
