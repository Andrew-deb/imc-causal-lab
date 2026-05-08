import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModelComparisonTable } from "./ModelComparisonTable";
import { ChannelSummaryTable } from "./ChannelSummaryTable";
import { CurveVisualizer } from "./CurveVisualizer";
import type { CurveData } from "@/lib/api";

const CHANNELS = ["Advertising", "Promotion", "Direct Marketing", "Public Relations"];

function makeCurve(peak: number): CurveData {
  const fractions = Array.from({ length: 11 }, (_, i) => i / 10);
  // Concave curve rising to `peak` at fraction=1
  const values = fractions.map((f) => Number((peak * Math.pow(f, 0.7)).toFixed(4)));
  return { fractions, values };
}

const MOCK_UPLIFT_CURVES: Record<string, CurveData> = {
  Advertising: makeCurve(0.22),
  Promotion: makeCurve(0.17),
  "Direct Marketing": makeCurve(0.12),
  "Public Relations": makeCurve(0.06),
};

const MOCK_QINI_CURVES: Record<string, CurveData> = {
  Advertising: makeCurve(0.18),
  Promotion: makeCurve(0.14),
  "Direct Marketing": makeCurve(0.10),
  "Public Relations": makeCurve(0.05),
};


const MOCK_ASSOC_VS_CAUSAL: Record<string, {
  estimated_effect: { associative: string; causal: string };
  confounding_correction: { associative: string; causal: string };
  individual_targeting: { associative: string; causal: string };
  interpretation: { associative: string; causal: string };
}> = {
  Advertising: {
    estimated_effect: { associative: "Coefficient = 0.35", causal: "ATE = 0.20" },
    confounding_correction: { associative: "❌ None", causal: "✅ Propensity + DR/DML" },
    individual_targeting: { associative: "❌ None", causal: "✅ ITE per customer" },
    interpretation: { associative: '"Correlation exists"', causal: '"Causal effect = 0.20"' },
  },
  Promotion: {
    estimated_effect: { associative: "Coefficient = 0.28", causal: "ATE = 0.15" },
    confounding_correction: { associative: "❌ None", causal: "✅ Propensity + DR/DML" },
    individual_targeting: { associative: "❌ None", causal: "✅ ITE per customer" },
    interpretation: { associative: '"Correlation exists"', causal: '"Causal effect = 0.15"' },
  },
  "Direct Marketing": {
    estimated_effect: { associative: "Coefficient = 0.22", causal: "ATE = 0.10" },
    confounding_correction: { associative: "❌ None", causal: "✅ Propensity + DR/DML" },
    individual_targeting: { associative: "❌ None", causal: "✅ ITE per customer" },
    interpretation: { associative: '"Correlation exists"', causal: '"Causal effect = 0.10"' },
  },
  "Public Relations": {
    estimated_effect: { associative: "Coefficient = 0.18", causal: "ATE = 0.05" },
    confounding_correction: { associative: "❌ None", causal: "✅ Propensity + DR/DML" },
    individual_targeting: { associative: "❌ None", causal: "✅ ITE per customer" },
    interpretation: { associative: '"Correlation exists"', causal: '"Causal effect = 0.05"' },
  },
};

function renderStyledValue(value: string) {
  if (value.startsWith("❌")) {
    return <span className="text-destructive font-mono text-sm">{value}</span>;
  }
  if (value.startsWith("✅")) {
    return <span className="text-chart-2 font-mono text-sm">{value}</span>;
  }
  return <span className="font-mono text-sm">{value}</span>;
}

function AssociativeVsCausalTable() {
  const [selectedChannel, setSelectedChannel] = useState(CHANNELS[0]);
  const data = MOCK_ASSOC_VS_CAUSAL[selectedChannel];

  const rows = [
    { metric: "Estimated Effect", ...data.estimated_effect },
    { metric: "Confounding Correction", ...data.confounding_correction },
    { metric: "Individual Targeting", ...data.individual_targeting },
    { metric: "Interpretation", ...data.interpretation },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Associative vs Causal Comparison</CardTitle>
          <CardDescription className="text-sm mt-1">
            Compare traditional correlation-based analysis against causal inference results
          </CardDescription>
        </div>
        <Select value={selectedChannel} onValueChange={setSelectedChannel}>
          <SelectTrigger className="w-44 h-8 text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map((c) => (
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
}

export default function DetailedComparison() {
  const [curveChannel, setCurveChannel] = useState(CHANNELS[0]);

  return (
    <div className="space-y-6">
      <ModelComparisonTable />
      <AssociativeVsCausalTable />
      <ChannelSummaryTable />

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base">Uplift & Qini Curves</CardTitle>
            <CardDescription className="text-sm mt-1">
              Cumulative gain curves vs. random assignment baseline.
            </CardDescription>
          </div>
          <Select value={curveChannel} onValueChange={setCurveChannel}>
            <SelectTrigger className="w-44 h-8 text-xs shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((c) => (
                <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CurveVisualizer
              title={`Uplift Curve — ${curveChannel}`}
              curve={MOCK_UPLIFT_CURVES[curveChannel]}
              modelName="Causal Forest"
              yLabel="Cumulative uplift"
            />
            <CurveVisualizer
              title={`Qini Curve — ${curveChannel}`}
              curve={MOCK_QINI_CURVES[curveChannel]}
              modelName="Causal Forest"
              yLabel="Qini gain"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
