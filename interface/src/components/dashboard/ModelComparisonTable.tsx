import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ModelEvaluationResult } from "@/lib/api";

const MOCK_RESULTS: ModelEvaluationResult[] = [
  {
    model_name: "T-Learner",
    metrics: {
      uplift_auc: 0.62,
      qini_auc: 0.58,
      precision_at_k: 0.41,
      recall_at_k: 0.27,
      base_classifier_auc: 0.74,
    },
  },
  {
    model_name: "DR-Learner",
    metrics: {
      uplift_auc: 0.68,
      qini_auc: 0.64,
      precision_at_k: 0.46,
      recall_at_k: 0.31,
      base_classifier_auc: 0.78,
    },
  },
  {
    model_name: "Causal Forest",
    metrics: {
      uplift_auc: 0.71,
      qini_auc: 0.67,
      precision_at_k: 0.49,
      recall_at_k: 0.34,
      base_classifier_auc: 0.79,
    },
  },
];

function fmt(v?: number): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return v.toFixed(3);
}

export function ModelComparisonTable({ results }: { results?: ModelEvaluationResult[] }) {
  const data = results ?? MOCK_RESULTS;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Model Evaluation</CardTitle>
        <CardDescription className="text-sm">
          Academic metrics for uplift modeling — higher is better.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Uplift AUC</TableHead>
                <TableHead>Qini AUC</TableHead>
                <TableHead>Precision@10%</TableHead>
                <TableHead>Recall@10%</TableHead>
                <TableHead>Base Classifier AUC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.model_name}>
                  <TableCell className="font-medium text-sm">{r.model_name}</TableCell>
                  <TableCell className="font-mono text-sm">{fmt(r.metrics.uplift_auc)}</TableCell>
                  <TableCell className="font-mono text-sm">{fmt(r.metrics.qini_auc)}</TableCell>
                  <TableCell className="font-mono text-sm">{fmt(r.metrics.precision_at_k)}</TableCell>
                  <TableCell className="font-mono text-sm">{fmt(r.metrics.recall_at_k)}</TableCell>
                  <TableCell className="font-mono text-sm">{fmt(r.metrics.base_classifier_auc)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
