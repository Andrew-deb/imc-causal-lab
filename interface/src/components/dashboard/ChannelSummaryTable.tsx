import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ChannelSummary } from "@/lib/api";

const MOCK_CHANNEL_SUMMARY: ChannelSummary[] = [
  { channel: "Advertising", consensus_ate: 0.20, best_model: "Causal Forest", agreement_score: 93, persuadables_pct: 21, confidence_level: "insufficient" },
  { channel: "Promotion", consensus_ate: 0.15, best_model: "Causal Forest", agreement_score: 88, persuadables_pct: 17, confidence_level: "good" },
  { channel: "Direct Marketing", consensus_ate: 0.10, best_model: "DR-Learner", agreement_score: 91, persuadables_pct: 13, confidence_level: "good" },
  { channel: "Public Relations", consensus_ate: 0.05, best_model: "DR-Learner", agreement_score: 78, persuadables_pct: 6, confidence_level: "good" },
];

function agreementColor(score: number): string {
  if (score > 85) return "bg-chart-2/10 text-chart-2 border-chart-2/20";
  if (score >= 70) return "bg-chart-3/10 text-chart-3 border-chart-3/20";
  return "bg-destructive/10 text-destructive border-destructive/20";
}

export function ChannelSummaryTable({ data }: { data?: ChannelSummary[] }) {
  const rows = data ?? MOCK_CHANNEL_SUMMARY;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Channel Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead>Consensus ATE</TableHead>
              <TableHead>Best Model (Qini)</TableHead>
              <TableHead>Agreement Score</TableHead>
              <TableHead>Persuadables %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.channel}>
                <TableCell className="font-medium text-sm">{row.channel}</TableCell>
                <TableCell className="font-mono text-sm">{row.consensus_ate.toFixed(2)}</TableCell>
                <TableCell className="text-sm">{row.best_model}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`${agreementColor(row.agreement_score)} text-xs`}>
                    {row.agreement_score}%
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">{row.persuadables_pct}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
