import { useState } from "react";
import { useSession } from "@/contexts/SessionContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function StepModelExecution({ onComplete, onBack }: { onComplete: () => void; onBack: () => void }) {
  const { sessionId } = useSession();
  const { toast } = useToast();
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");

  const handleRun = async () => {
    setStatus("running");
    try {
      if (sessionId) {
        await api.runCausalModels(sessionId);
      } else {
        // Simulate delay for demo
        await new Promise((r) => setTimeout(r, 3000));
      }
      setStatus("done");
      toast({ title: "Causal estimates generated", description: "Redirecting to dashboard..." });
      setTimeout(onComplete, 1500);
    } catch {
      setStatus("idle");
      toast({ title: "Model execution failed", variant: "destructive" });
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
                  <h3 className="text-lg font-semibold">Running Causal Estimators...</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Computing ATE, ATT, CATE, and uplift segments. This may take a moment.
                  </p>
                </div>
                <div className="w-full max-w-sm space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
              </>
            )}

            {status === "done" && (
              <>
                <CheckCircle2 className="h-12 w-12 text-chart-2" />
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
