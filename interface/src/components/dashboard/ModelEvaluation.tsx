import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CurveVisualizer } from "./CurveVisualizer";
import type { SessionResults, EvaluationResponse, ModelEvaluationResult } from "@/lib/api";
import { Trophy } from "lucide-react";

interface ModelEvaluationProps {
  selectedChannel: string;
  onChannelChange: (ch: string) => void;
  data: SessionResults;
  evaluationData: EvaluationResponse;
}

function renderStyledValue(value: string) {
  if (value.startsWith("❌")) {
    return <span className="text-destructive font-mono text-sm">{value}</span>;
  }
  if (value.startsWith("✅")) {
    return <span className="text-chart-2 font-mono text-sm">{value}</span>;
  }
  return <span className="font-mono text-sm">{value}</span>;
}

export default function ModelEvaluation({ selectedChannel, data, evaluationData }: ModelEvaluationProps) {
  const descStats = evaluationData.descriptive_statistics[selectedChannel];
  const evalResult = evaluationData.channel_evaluations[selectedChannel];
  const bestModel = evaluationData.best_model_per_channel[selectedChannel];
  const assocData = data.associative_vs_causal[selectedChannel];

  // 1. Descriptive Statistics
  const renderDescStats = () => {
    if (!descStats) return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Descriptive Statistics</CardTitle>
          <CardDescription className="text-sm">
            Comparison of treated vs control groups for {selectedChannel} ({descStats.n_treated} treated, {descStats.n_control} control).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variable</TableHead>
                <TableHead>Treated Mean</TableHead>
                <TableHead>Control Mean</TableHead>
                <TableHead>Std. Diff (Cohen's d)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {descStats.stats.map((row) => (
                <TableRow key={row.variable}>
                  <TableCell className="font-medium text-sm">{row.variable}</TableCell>
                  <TableCell>{row.treated_mean.toFixed(2)}</TableCell>
                  <TableCell>{row.control_mean.toFixed(2)}</TableCell>
                  <TableCell>
                    <span className={Math.abs(row.std_diff) > 0.1 ? "text-destructive" : ""}>
                      {row.std_diff.toFixed(3)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  // 2. Model Evaluation Metrics
  const renderMetricsTable = () => {
    if (!evalResult) return null;
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Model Evaluation Metrics</CardTitle>
          <CardDescription className="text-sm">
            Cross-validation metrics comparing model performance for estimating CATE.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Uplift AUC</TableHead>
                <TableHead>Qini AUC</TableHead>
                <TableHead>Precision @10%</TableHead>
                <TableHead>Recall @10%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.values(evalResult.model_evaluations).map((model: ModelEvaluationResult) => {
                const isBest = model.model_name === bestModel;
                return (
                  <TableRow key={model.model_name} className={isBest ? "bg-muted/50" : ""}>
                    <TableCell className="font-medium flex items-center gap-2">
                      {isBest && <Trophy className="h-4 w-4 text-yellow-500" />}
                      {model.model_name}
                    </TableCell>
                    <TableCell>{model.metrics.uplift_auc?.toFixed(4) ?? "N/A"}</TableCell>
                    <TableCell>{model.metrics.qini_auc?.toFixed(4) ?? "N/A"}</TableCell>
                    <TableCell>{model.metrics.precision_at_k?.toFixed(4) ?? "N/A"}</TableCell>
                    <TableCell>{model.metrics.recall_at_k?.toFixed(4) ?? "N/A"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  // 3. Causal vs Associative
  const renderAssocCausal = () => {
    if (!assocData) return null;
    const rows = [
      { metric: "Estimated Effect", associative: assocData.estimated_effect.associative, causal: assocData.estimated_effect.causal },
      { metric: "Confounding Correction", associative: assocData.confounding_correction.associative, causal: assocData.confounding_correction.causal },
      { metric: "Individual Targeting", associative: assocData.individual_targeting.associative, causal: assocData.individual_targeting.causal },
      { metric: "Interpretation", associative: assocData.interpretation.associative, causal: assocData.interpretation.causal },
    ];
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Associative vs Causal Comparison</CardTitle>
          <CardDescription className="text-sm">
            Comparison of traditional correlation-based analysis against causal inference.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead>Logistic Reg (Associative)</TableHead>
                <TableHead>Causal Consensus</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.metric}>
                  <TableCell className="font-medium text-sm">{row.metric}</TableCell>
                  <TableCell>{renderStyledValue(row.associative)}</TableCell>
                  <TableCell>{renderStyledValue(row.causal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  // 4. Curves
  const renderCurves = () => {
    if (!evalResult || !bestModel) return null;
    const bestModelEvals = evalResult.model_evaluations[bestModel];
    if (!bestModelEvals) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uplift & Qini Curves ({bestModel})</CardTitle>
          <CardDescription className="text-sm">
            Cumulative gain curves vs. random assignment baseline for the best performing model.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {bestModelEvals.metrics.uplift_curve && (
              <CurveVisualizer
                title={`Uplift Curve`}
                curve={bestModelEvals.metrics.uplift_curve}
                modelName={bestModel}
                yLabel="Cumulative uplift"
              />
            )}
            {bestModelEvals.metrics.qini_curve && (
              <CurveVisualizer
                title={`Qini Curve`}
                curve={bestModelEvals.metrics.qini_curve}
                modelName={bestModel}
                yLabel="Qini gain"
              />
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {renderDescStats()}
      {renderMetricsTable()}
      {renderAssocCausal()}
      {renderCurves()}
    </div>
  );
}
