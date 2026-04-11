import { useEffect, useState } from "react";
import { useSession } from "@/contexts/SessionContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const IMC_CATEGORIES = ["promotion", "advertising", "public_relations", "direct_marketing"];

export default function StepImcMapping({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { sessionId, campaignTypes, imcMapping, setImcMapping } = useSession();
  const { toast } = useToast();
  const [mapping, setMapping] = useState<Record<string, string>>(imcMapping);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (Object.keys(mapping).length > 0 || !sessionId || campaignTypes.length === 0) return;
    setGenerating(true);
    api
      .generateImcMapping(sessionId, campaignTypes)
      .then((res) => setMapping(res.mapping))
      .catch(() => {
        // Use default mapping as fallback
        const fallback: Record<string, string> = {};
        campaignTypes.forEach((t) => (fallback[t] = "advertising"));
        setMapping(fallback);
      })
      .finally(() => setGenerating(false));
  }, [sessionId, campaignTypes]);

  const handleConfirm = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      await api.confirmImcMapping(sessionId, mapping);
      setImcMapping(mapping);
      toast({ title: "Mapping confirmed" });
      onNext();
    } catch {
      toast({ title: "Failed to confirm mapping", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (generating) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Generating IMC Mapping...</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">IMC Exposure Categorization</CardTitle>
          <p className="text-sm text-muted-foreground">Review and edit the AI-generated mapping below.</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign Type</TableHead>
                <TableHead>IMC Category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(mapping).map(([type, category]) => (
                <TableRow key={type}>
                  <TableCell className="font-mono text-sm">{type}</TableCell>
                  <TableCell>
                    <Select
                      value={category}
                      onValueChange={(val) => setMapping((m) => ({ ...m, [type]: val }))}
                    >
                      <SelectTrigger className="h-8 text-sm w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IMC_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c} className="text-sm capitalize">
                            {c.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={handleConfirm} disabled={loading}>
          {loading ? "Confirming..." : "Confirm Mapping"}
        </Button>
      </div>
    </div>
  );
}
