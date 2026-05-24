import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";
import { cn } from "@/lib/utils";
import { Check, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/console/PageHeader";
import StepDataCollection from "@/components/wizard/StepDataCollection";
import StepImcMapping from "@/components/wizard/StepImcMapping";
import StepCausalIdentification from "@/components/wizard/StepCausalIdentification";
import StepDiscoverySummary from "@/components/wizard/StepDiscoverySummary";

const STEPS = [
  "Data Collection",
  "IMC Categorization",
  "Causal Discovery",
  "Discovery Summary",
];

export default function NewAnalysis() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Calculate initial step based on the resumeStatus passed from Home.tsx
  const getInitialStep = () => {
    const status = location.state?.resumeStatus;
    if (status === "uploaded") return 1; // Go to IMC mapping
    if (status === "mapped") return 2; // Go to Causal Identification
    if (status === "discovery_started") return 2; // In the middle of discovery
    if (status === "discovery_completed") return 3; // Go to Discovery Summary
    if (status === "pipeline_running") return 3; // Go to Discovery Summary
    return 0; // Default to step 0
  };

  const [currentStep, setCurrentStep] = useState(getInitialStep);

  const goNext = () => setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 0));
  const onComplete = () => navigate("/dashboard");

  return (
    <div className="space-y-5">
      <PageHeader
        title="New Causal Analysis"
        description="Follow the steps to run a causal analysis on your marketing data."
        breadcrumbs={[{ label: "New Analysis" }]}
        icon={<PlusCircle className="h-5 w-5" />}
        meta={<span>Step <span className="text-foreground font-medium">{currentStep + 1}</span> of {STEPS.length} · {STEPS[currentStep]}</span>}
      />

      {/* Step Indicator — dense console pill row aligned with max-w-3xl content */}
      <div className="max-w-3xl mx-auto w-full">
        <div className="panel p-3">
          <div className="flex items-center justify-between w-full overflow-x-auto gap-2">
            {STEPS.map((label, i) => {
              const isDone = i < currentStep;
              const isActive = i === currentStep;
              return (
                <div key={label} className="flex items-center flex-1 last:flex-none">
                  <button
                    type="button"
                    onClick={() => isDone && setCurrentStep(i)}
                    className={cn(
                      "flex items-center gap-2 h-7 rounded px-2.5 text-[12px] transition-colors flex-shrink-0",
                      isActive
                        ? "bg-primary text-primary-foreground font-medium"
                        : isDone
                        ? "text-foreground hover:bg-muted cursor-pointer"
                        : "text-muted-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-semibold border shrink-0",
                        isActive
                          ? "border-primary-foreground/40 bg-primary-foreground/10"
                          : isDone
                          ? "border-success bg-success text-success-foreground"
                          : "border-border bg-surface"
                      )}
                    >
                      {isDone ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className="whitespace-nowrap">{label}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={cn("h-px flex-1 min-w-[12px] mx-2", isDone ? "bg-success" : "bg-border")} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-3xl mx-auto w-full">
        {currentStep === 0 && <StepDataCollection onNext={goNext} />}
        {currentStep === 1 && <StepImcMapping onNext={goNext} onBack={goBack} />}
        {currentStep === 2 && <StepCausalIdentification onNext={goNext} onBack={goBack} />}
        {currentStep === 3 && <StepDiscoverySummary onBack={goBack} />}
      </div>
    </div>
  );
}
