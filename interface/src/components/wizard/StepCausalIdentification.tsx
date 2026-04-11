import { useState } from "react";
import { useSession } from "@/contexts/SessionContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DEMO_COLUMNS = ["age", "income", "region", "gender", "imc_category", "purchase", "revenue", "channel_exposure", "customer_segment"];

function MultiSelect({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <Select onValueChange={(v) => { if (!selected.includes(v)) onChange([...selected, v]); }}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder={`Select ${label.toLowerCase()}...`} />
        </SelectTrigger>
        <SelectContent>
          {options.filter((o) => !selected.includes(o)).map((o) => (
            <SelectItem key={o} value={o} className="text-sm">{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selected.map((s) => (
            <Badge key={s} variant="secondary" className="text-xs gap-1">
              {s}
              <button onClick={() => onChange(selected.filter((x) => x !== s))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StepCausalIdentification({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { sessionId, columns } = useSession();
  const { toast } = useToast();
  const availableCols = columns.length > 0 ? columns : DEMO_COLUMNS;

  const [treatment, setTreatment] = useState("");
  const [outcome, setOutcome] = useState("");
  const [confounders, setConfounders] = useState<string[]>([]);
  const [mediators, setMediators] = useState<string[]>([]);
  const [colliders, setColliders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!treatment || !outcome) {
      toast({ title: "Missing fields", description: "Treatment and outcome are required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (sessionId) {
        await api.runCausalDiscovery(sessionId, treatment, outcome, confounders, mediators, colliders);
      }
      toast({ title: "Causal discovery complete" });
      onNext();
    } catch {
      toast({ title: "Causal discovery failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Causal Identification</CardTitle>
          <p className="text-sm text-muted-foreground">Specify the causal structure for your analysis.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Treatment (required)</Label>
              <Select value={treatment} onValueChange={setTreatment}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select treatment..." /></SelectTrigger>
                <SelectContent>
                  {availableCols.map((c) => <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Outcome (required)</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select outcome..." /></SelectTrigger>
                <SelectContent>
                  {availableCols.map((c) => <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <MultiSelect label="Confounders" options={availableCols} selected={confounders} onChange={setConfounders} />
          <MultiSelect label="Mediators" options={availableCols} selected={mediators} onChange={setMediators} />
          <MultiSelect label="Colliders" options={availableCols} selected={colliders} onChange={setColliders} />
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? "Running..." : "Run Causal Discovery"}
        </Button>
      </div>
    </div>
  );
}
