import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";
import { ModelComparisonTable } from "./ModelComparisonTable";
import { ChannelSummaryTable } from "./ChannelSummaryTable";

const CHANNELS = ["Advertising", "Promotion", "Direct Marketing", "Public Relations"];

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
  return (
    <div className="space-y-6">
      <ModelComparisonTable />
      <AssociativeVsCausalTable />
      <ChannelSummaryTable />

      {/* Qini Curve Placeholders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Qini Curves</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CHANNELS.map((ch) => (
              <Card key={ch} className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                  <BarChart3 className="h-10 w-10" />
                  <span className="text-sm font-medium">Qini Curve — {ch}</span>
                  <span className="text-xs">Plot will load from blob storage</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
