import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";
import { usePipeline } from "@/contexts/PipelineContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function StepModelExecution({ onComplete, onBack }: { onComplete: () => void; onBack: () => void }) {
  const { sessionId } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { startStreaming } = usePipeline();
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");

  const handleRun = async () => {
    if (!sessionId) {
      toast({ title: "No active session", description: "Create or select a session first.", variant: "destructive" });
      return;
    }

    setStatus("running");
    try {
      // 1. Trigger async analysis
      const res = await api.runAsyncAnalysis(sessionId);
      
      // 2. Start streaming the modeling job
      startStreaming(res.modeling_job_id);
      
      toast({ title: "Analysis started", description: "Navigating to pipeline monitor..." });
      
      // 3. Navigate immediately to the Monitor page
      navigate("/monitor");
    } catch (err) {
      setStatus("idle");
      toast({
        title: "Failed to start analysis",
        description: err instanceof Error ? err.message : "An unexpected error occurred.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            {status === "idle" && (
              <>
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Ready to Generate</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click below to run causal estimators on your data.
                  </p>
                </div>
                <Button size="lg" onClick={handleRun}>
                  Generate Causal Estimates
                </Button>
              </>
            )}

            {status === "running" && (
              <>
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
                <div className="text-center">
                  <h3 className="text-lg font-semibold">
                    Starting Pipeline...
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your analysis is being submitted to the execution queue. Redirecting you to the Pipeline Monitor...
                  </p>
                </div>
              </>
            )}

            {status === "done" && (
              <>
                <CheckCircle2 className="h-12 w-12 text-success animate-bounce" />
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Analysis Complete</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Redirecting to dashboard...
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {status === "idle" && (
        <div className="flex justify-start">
          <Button variant="outline" onClick={onBack}>Back</Button>
        </div>
      )}
    </div>
  );
}
