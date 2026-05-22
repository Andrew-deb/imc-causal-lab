import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "@/contexts/SessionContext";
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
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ThemeProvider>
        <SessionProvider>
          <PipelineProvider>
            <BrowserRouter>
              <Layout>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/new-analysis" element={<NewAnalysis />} />
                  <Route path="/sessions" element={<SessionHistory />} />
                  <Route path="/discover" element={<ExplainabilityViewer />} />
                  <Route path="/explainability" element={<ExplainabilityViewer />} />
                  <Route path="/monitor" element={<PipelineMonitor />} />
                  <Route path="/monitor/:runId" element={<PipelineRunDetail />} />
                  <Route path="/logs" element={<LogsDiagnostics />} />
                  <Route path="/about" element={<About />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Layout>
            </BrowserRouter>
          </PipelineProvider>
        </SessionProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
