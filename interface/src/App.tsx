import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth-wrapper";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider, useSession } from "@/contexts/SessionContext";
import { PipelineProvider } from "@/contexts/PipelineContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Layout } from "@/components/Layout";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import NewAnalysis from "@/pages/NewAnalysis";
import SessionHistory from "@/pages/SessionHistory";
import ExplainabilityViewer from "@/pages/ExplainabilityViewer";
import PipelineMonitor from "@/pages/PipelineMonitor";
import PipelineRunDetail from "@/pages/PipelineRunDetail";
import LogsDiagnostics from "@/pages/LogsDiagnostics";
import About from "@/pages/About";
import Docs from "@/pages/Docs";
import NotFound from "@/pages/NotFound";
import LandingPage from "@/pages/LandingPage";
import SignInPage from "@/pages/SignInPage";
import SignUpPage from "@/pages/SignUpPage";
import { api } from "@/lib/api";

const queryClient = new QueryClient();

// Protected Route Component
const ProtectedRoute = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const [searchParams] = useSearchParams();
  const { sessionId } = useSession();
  
  const urlDemo = searchParams.get("demo");
  const urlSessionId = searchParams.get("session_id");
  
  if (urlDemo === "true" || urlSessionId === "demo_session") {
    try {
      sessionStorage.setItem("guest_demo", "true");
    } catch (e) {}
  }

  const isDemo = urlDemo === "true" || 
                 urlSessionId === "demo_session" || 
                 sessionId === "demo_session" ||
                 (typeof window !== "undefined" && window.sessionStorage?.getItem("guest_demo") === "true");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0b10]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Guest Demo Mode bypasses the sign-in check
  if (isDemo) {
    return <Outlet />;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <Outlet />;
};

const AppContent = () => {
  const { getToken } = useAuth();

  useEffect(() => {
    api.setGetToken(getToken);
  }, [getToken]);

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/docs" element={<Docs />} />
          
          {/* Clerk Auth wrapper pages */}
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />

          {/* Protected Console Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/home" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/new-analysis" element={<NewAnalysis />} />
            <Route path="/sessions" element={<SessionHistory />} />
            <Route path="/discover" element={<ExplainabilityViewer />} />
            <Route path="/explainability" element={<ExplainabilityViewer />} />
            <Route path="/monitor" element={<PipelineMonitor />} />
            <Route path="/monitor/:runId" element={<PipelineRunDetail />} />
            <Route path="/logs" element={<LogsDiagnostics />} />
            <Route path="/about" element={<About />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ThemeProvider>
        <SessionProvider>
          <PipelineProvider>
            <AppContent />
          </PipelineProvider>
        </SessionProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
