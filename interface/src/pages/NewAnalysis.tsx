import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import StepDataCollection from "@/components/wizard/StepDataCollection";
import StepImcMapping from "@/components/wizard/StepImcMapping";
import StepCausalIdentification from "@/components/wizard/StepCausalIdentification";
import StepDiscoverySummary from "@/components/wizard/StepDiscoverySummary";
import StepModelExecution from "@/components/wizard/StepModelExecution";

const STEPS = [
  "Data Collection",
  "IMC Categorization",
  "Causal Identification",
  "Discovery Summary",
  "Generate Results",
];

export default function NewAnalysis() {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const goNext = () => setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 0));
  const onComplete = () => navigate("/");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">New Causal Analysis</h1>
        <p className="text-muted-foreground text-sm mt-1">Follow the steps to run a causal analysis on your marketing data.</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-0 overflow-x-auto pb-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors",
                  i < currentStep
                    ? "bg-primary border-primary text-primary-foreground"
                    : i === currentStep
                    ? "border-primary text-primary bg-background"
                    : "border-border text-muted-foreground bg-background"
                )}
              >
                {i < currentStep ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[9px] sm:text-[10px] mt-1 w-14 sm:w-20 text-center leading-tight",
                  i <= currentStep ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-6 sm:w-12 mx-0.5 sm:mx-1 mt-[-14px]",
                  i < currentStep ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="max-w-3xl mx-auto">
        {currentStep === 0 && <StepDataCollection onNext={goNext} />}
        {currentStep === 1 && <StepImcMapping onNext={goNext} onBack={goBack} />}
        {currentStep === 2 && <StepCausalIdentification onNext={goNext} onBack={goBack} />}
        {currentStep === 3 && <StepDiscoverySummary onNext={goNext} onBack={goBack} />}
        {currentStep === 4 && <StepModelExecution onComplete={onComplete} onBack={goBack} />}
      </div>
    </div>
  );
}
