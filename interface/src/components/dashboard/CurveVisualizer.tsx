import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { CurveData } from "@/lib/api";

interface CurveVisualizerProps {
  title: string;
  curve: CurveData;
  modelName?: string;
  yLabel?: string;
}

export function CurveVisualizer({
  title,
  curve,
  modelName = "Model",
  yLabel = "Cumulative Uplift",
}: CurveVisualizerProps) {
  const fractions = curve?.fractions ?? [];
  const values = curve?.values ?? [];
  const maxVal = values.length ? values[values.length - 1] : 0;

  const data = fractions.map((f, i) => ({
    fraction: f,
    model: values[i] ?? 0,
    random: f * maxVal,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="fraction"
              type="number"
              domain={[0, 1]}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              label={{ value: "Population fraction", position: "insideBottom", offset: -2, fontSize: 11 }}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => v.toFixed(3)}
              label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: number) => v.toFixed(3)}
              labelFormatter={(v: number) => `Fraction: ${(v * 100).toFixed(0)}%`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="model"
              name={modelName}
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="random"
              name="Random Assignment"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default CurveVisualizer;
