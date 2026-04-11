import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CrossModelComparison } from "@/lib/api";

const MOCK_MODEL_COMPARISON: Record<string, CrossModelComparison> = {
  Advertising: {
    metrics: [
      { metric: "ATE", t_learner: 0.22, dr_learner: 0.19, causal_forest: 0.20, consensus: 0.20 },
      { metric: "ATT", t_learner: 0.19, dr_learner: 0.17, causal_forest: 0.18, consensus: 0.18 },
      { metric: "ATE 95% CI", t_learner: "N/A", dr_learner: "[0.14, 0.24]", causal_forest: "[0.15, 0.25]", consensus: "—" },
      { metric: "Qini Score", t_learner: 0.12, dr_learner: 0.15, causal_forest: 0.18, consensus: "—" },
      { metric: "CATE Std Dev", t_learner: 0.08, dr_learner: 0.10, causal_forest: 0.14, consensus: "—" },
    ],
  },
  Promotion: {
    metrics: [
      { metric: "ATE", t_learner: 0.16, dr_learner: 0.14, causal_forest: 0.15, consensus: 0.15 },
      { metric: "ATT", t_learner: 0.14, dr_learner: 0.13, causal_forest: 0.13, consensus: 0.13 },
      { metric: "ATE 95% CI", t_learner: "N/A", dr_learner: "[0.09, 0.19]", causal_forest: "[0.10, 0.20]", consensus: "—" },
      { metric: "Qini Score", t_learner: 0.09, dr_learner: 0.11, causal_forest: 0.13, consensus: "—" },
      { metric: "CATE Std Dev", t_learner: 0.06, dr_learner: 0.08, causal_forest: 0.11, consensus: "—" },
    ],
  },
  "Direct Marketing": {
    metrics: [
      { metric: "ATE", t_learner: 0.11, dr_learner: 0.09, causal_forest: 0.10, consensus: 0.10 },
      { metric: "ATT", t_learner: 0.09, dr_learner: 0.08, causal_forest: 0.09, consensus: 0.09 },
      { metric: "ATE 95% CI", t_learner: "N/A", dr_learner: "[0.05, 0.13]", causal_forest: "[0.06, 0.14]", consensus: "—" },
      { metric: "Qini Score", t_learner: 0.07, dr_learner: 0.09, causal_forest: 0.10, consensus: "—" },
      { metric: "CATE Std Dev", t_learner: 0.05, dr_learner: 0.06, causal_forest: 0.09, consensus: "—" },
    ],
  },
  "Public Relations": {
    metrics: [
      { metric: "ATE", t_learner: 0.06, dr_learner: 0.04, causal_forest: 0.05, consensus: 0.05 },
      { metric: "ATT", t_learner: 0.05, dr_learner: 0.04, causal_forest: 0.04, consensus: 0.04 },
      { metric: "ATE 95% CI", t_learner: "N/A", dr_learner: "[0.01, 0.07]", causal_forest: "[0.02, 0.08]", consensus: "—" },
      { metric: "Qini Score", t_learner: 0.04, dr_learner: 0.05, causal_forest: 0.06, consensus: "—" },
      { metric: "CATE Std Dev", t_learner: 0.03, dr_learner: 0.04, causal_forest: 0.06, consensus: "—" },
    ],
  },
};

function formatVal(v: number | string): string {
  if (typeof v === "number") return v.toFixed(2);
  return String(v);
}

export function ModelComparisonTable({ data, channel }: { data?: Record<string, CrossModelComparison>; channel?: string }) {
  const compData = data ?? MOCK_MODEL_COMPARISON;
  const channels = Object.keys(compData);
  const [selectedChannel, setSelectedChannel] = useState(channel ?? channels[0]);
  const metrics = compData[selectedChannel]?.metrics ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Causal Model Comparison</CardTitle>
        <Select value={selectedChannel} onValueChange={setSelectedChannel}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {channels.map((c) => (
              <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead>T-Learner</TableHead>
              <TableHead>DR-Learner</TableHead>
              <TableHead>Causal Forest</TableHead>
              <TableHead className="font-bold">Consensus</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((m) => (
              <TableRow key={m.metric}>
                <TableCell className="font-medium text-sm">{m.metric}</TableCell>
                <TableCell className="font-mono text-sm">{formatVal(m.t_learner)}</TableCell>
                <TableCell className="font-mono text-sm">{formatVal(m.dr_learner)}</TableCell>
                <TableCell className="font-mono text-sm">{formatVal(m.causal_forest)}</TableCell>
                <TableCell className="font-mono text-sm font-bold">{formatVal(m.consensus)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
