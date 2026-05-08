import { useQuery } from "@tanstack/react-query";
import { api, SessionResults, TreatmentBalanceResult } from "@/lib/api";
import { useSession } from "@/contexts/SessionContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { TrendingUp, Users, Layers, Target, Crosshair, Check, XCircle, MoonStar, AlertTriangle, Zap, ShieldAlert } from "lucide-react";
import DetailedComparison from "@/components/dashboard/DetailedComparison";
import { PageHeader } from "@/components/console/PageHeader";
import { StatusPill } from "@/components/console/StatusPill";

const MOCK_TREATMENT_BALANCE: TreatmentBalanceResult[] = [
  { imc_category: "Advertising", treated_count: 120, control_count: 30, treated_pct: 0.8, status: "warning", message: "Skewed treatment/control split — confounding risk." },
  { imc_category: "Promotion", treated_count: 200, control_count: 180, treated_pct: 0.53, status: "good", message: "Healthy balance." },
  { imc_category: "Direct Marketing", treated_count: 15, control_count: 5, treated_pct: 0.75, status: "insufficient", message: "Too few control samples for reliable estimation." },
  { imc_category: "Public Relations", treated_count: 90, control_count: 95, treated_pct: 0.49, status: "good", message: "Healthy balance." },
];


const MOCK_CHANNEL_DATA: Record<string, {
  ate: number;
  att: number;
  customer_count: number;
  confidence_level: "good" | "weak" | "insufficient";
  uplift_segments: { persuadables: number; sure_things: number; sleeping_dogs: number; lost_causes: number };
  cate_analysis: Record<string, Record<string, number>>;
}> = {
  Advertising: {
    ate: 0.20, att: 0.18, customer_count: 1650,
    confidence_level: "insufficient",
    uplift_segments: { persuadables: 0.21, sure_things: 0.33, sleeping_dogs: 0.12, lost_causes: 0.34 },
    cate_analysis: {
      age: { "18-25": 0.28, "26-35": 0.22, "36-45": 0.18, "46-55": 0.12, "56+": 0.06 },
      region: { North: 0.22, South: 0.16, East: 0.20, West: 0.15 },
      income: { Low: 0.10, Medium: 0.18, High: 0.26 },
    },
  },
  Promotion: {
    ate: 0.15, att: 0.13, customer_count: 1420,
    confidence_level: "good",
    uplift_segments: { persuadables: 0.17, sure_things: 0.38, sleeping_dogs: 0.10, lost_causes: 0.35 },
    cate_analysis: {
      age: { "18-25": 0.20, "26-35": 0.17, "36-45": 0.14, "46-55": 0.10, "56+": 0.05 },
      region: { North: 0.16, South: 0.12, East: 0.15, West: 0.11 },
      income: { Low: 0.08, Medium: 0.14, High: 0.20 },
    },
  },
  "Direct Marketing": {
    ate: 0.10, att: 0.09, customer_count: 1280,
    confidence_level: "good",
    uplift_segments: { persuadables: 0.13, sure_things: 0.35, sleeping_dogs: 0.14, lost_causes: 0.38 },
    cate_analysis: {
      age: { "18-25": 0.14, "26-35": 0.12, "36-45": 0.09, "46-55": 0.07, "56+": 0.04 },
      region: { North: 0.11, South: 0.08, East: 0.10, West: 0.07 },
      income: { Low: 0.05, Medium: 0.09, High: 0.14 },
    },
  },
  "Public Relations": {
    ate: 0.05, att: 0.04, customer_count: 980,
    confidence_level: "good",
    uplift_segments: { persuadables: 0.06, sure_things: 0.30, sleeping_dogs: 0.18, lost_causes: 0.46 },
    cate_analysis: {
      age: { "18-25": 0.08, "26-35": 0.06, "36-45": 0.04, "46-55": 0.03, "56+": 0.02 },
      region: { North: 0.06, South: 0.04, East: 0.05, West: 0.03 },
      income: { Low: 0.03, Medium: 0.05, High: 0.07 },
    },
  },
};

const CHANNEL_RANKING = [
  { channel: "Advertising", effect: 0.20 },
  { channel: "Promotion", effect: 0.15 },
  { channel: "Direct Marketing", effect: 0.10 },
  { channel: "Public Relations", effect: 0.05 },
];

const MOCK_DATA: SessionResults = {
  ATE: 0.20,
  ATT: 0.18,
  customer_count: 2000,
  campaign_type_count: 10,
  channel_ranking: CHANNEL_RANKING,
  uplift_segments: MOCK_CHANNEL_DATA["Advertising"].uplift_segments,
  cate_analysis: MOCK_CHANNEL_DATA["Advertising"].cate_analysis,
};

const UPLIFT_SEGMENTS = [
  { key: "persuadables", label: "Persuadables", bg: "hsl(90, 30%, 78%)", icon: Crosshair, desc: "Customers who will convert only if targeted.", dark: false, animClass: "uplift-icon-target" },
  { key: "sure_things", label: "Sure Things", bg: "hsl(200, 30%, 80%)", icon: Check, desc: "Customers who will convert whether targeted or not.", dark: false, animClass: "uplift-icon-check" },
  { key: "lost_causes", label: "Lost Causes", bg: "hsl(210, 12%, 90%)", icon: XCircle, desc: "Customers who won't convert whether targeted or not.", dark: false, animClass: "uplift-icon-x" },
  { key: "sleeping_dogs", label: "Sleeping Dogs", bg: "hsl(215, 25%, 45%)", icon: MoonStar, desc: "Customers who will convert only if not targeted.", dark: true, animClass: "uplift-icon-moon" },
];

const CHANNELS = Object.keys(MOCK_CHANNEL_DATA);

function ConfidenceBadge({ level }: { level: "good" | "weak" | "insufficient" }) {
  if (level === "good") return null;
  if (level === "insufficient") {
    return (
      <div className="mt-2 flex items-center gap-1 text-[11px] text-destructive">
        <AlertTriangle className="h-3 w-3" />
        <span>Low confidence — insufficient T/C variation</span>
      </div>
    );
  }
  return (
    <div className="mt-2 flex items-center gap-1 text-[11px] text-yellow-600 dark:text-yellow-400">
      <Zap className="h-3 w-3" />
      <span>Moderate confidence — limited T/C variation</span>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, format, confidenceLevel }: {
  title: string; value: number; icon: React.ElementType; format?: "percent" | "number";
  confidenceLevel?: "good" | "weak" | "insufficient";
}) {
  const display = format === "percent" ? `${(value * 100).toFixed(1)}%` : value.toLocaleString();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-mono">{display}</div>
        {confidenceLevel && <ConfidenceBadge level={confidenceLevel} />}
      </CardContent>
    </Card>
  );
}

function ChannelLabel({ channel }: { channel: string }) {
  const conf = MOCK_CHANNEL_DATA[channel]?.confidence_level;
  return (
    <span>
      {channel}
      {conf === "insufficient" && " ⚠"}
      {conf === "weak" && " ⚡"}
    </span>
  );
}

function OverviewView({ selectedChannel, onChannelChange, cateVar, setCateVar }: {
  selectedChannel: string;
  onChannelChange: (ch: string) => void;
  cateVar: string;
  setCateVar: (v: string) => void;
}) {
  const channelData = MOCK_CHANNEL_DATA[selectedChannel];
  const cateData = channelData.cate_analysis[cateVar]
    ? Object.entries(channelData.cate_analysis[cateVar]).map(([name, value]) => ({ name, value }))
    : [];

  const getBarOpacity = (channel: string) => {
    const conf = MOCK_CHANNEL_DATA[channel]?.confidence_level;
    if (conf === "insufficient") return 0.4;
    if (conf === "weak") return 0.7;
    return 1;
  };

  const renderCustomYAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const conf = MOCK_CHANNEL_DATA[payload.value]?.confidence_level;
    const icon = conf === "insufficient" ? " ⚠" : conf === "weak" ? " ⚡" : "";
    return (
      <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fill="currentColor">
        {payload.value}{icon}
      </text>
    );
  };

  const customTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const entry = payload[0].payload;
    const conf = MOCK_CHANNEL_DATA[entry.channel]?.confidence_level;
    return (
      <div className="rounded-lg border bg-card p-2 text-xs shadow-md" style={{ borderColor: "hsl(var(--border))" }}>
        <p className="font-medium">{entry.channel}: {(entry.effect * 100).toFixed(1)}%</p>
        {conf === "insufficient" && (
          <p className="text-destructive mt-1">⚠ Insufficient treatment/control variation — results may be unreliable</p>
        )}
        {conf === "weak" && (
          <p className="text-yellow-600 dark:text-yellow-400 mt-1">⚡ Limited variation — interpret with caution</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title={`${selectedChannel} — ATE`} value={channelData.ate} icon={TrendingUp} format="percent" confidenceLevel={channelData.confidence_level} />
        <MetricCard title={`${selectedChannel} — ATT`} value={channelData.att} icon={Target} format="percent" confidenceLevel={channelData.confidence_level} />
        <MetricCard title={`${selectedChannel} — Customers`} value={channelData.customer_count} icon={Users} format="number" />
        <MetricCard title="Campaign Types" value={10} icon={Layers} format="number" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">IMC Channel Ranking</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={CHANNEL_RANKING}
                layout="vertical"
                margin={{ left: 20 }}
                onClick={(state) => {
                  if (state?.activeLabel) {
                    onChannelChange(String(state.activeLabel));
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <YAxis dataKey="channel" type="category" tick={renderCustomYAxisTick} width={140} />
                <Tooltip content={customTooltip} />
                <Bar dataKey="effect" radius={[0, 4, 4, 0]}>
                  {CHANNEL_RANKING.map((entry) => (
                    <Cell
                      key={entry.channel}
                      fill={entry.channel === selectedChannel
                        ? "hsl(var(--primary))"
                        : "hsl(var(--primary) / 0.3)"}
                      fillOpacity={getBarOpacity(entry.channel)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">CATE Distribution</CardTitle>
            <Select value={cateVar} onValueChange={setCateVar}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(channelData.cate_analysis).map((v) => (
                  <SelectItem key={v} value={v} className="text-xs capitalize">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={cateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "Effect"]}
                />
                <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Uplift Segmentation Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{selectedChannel} — Uplift Segmentation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex">
            <div className="flex flex-col justify-center mr-2 shrink-0">
              <span className="text-xs font-semibold text-muted-foreground [writing-mode:vertical-lr] rotate-180 tracking-widest uppercase">
                Treatment
              </span>
            </div>

            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex justify-center mb-2">
                <span className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">
                  No Treatment
                </span>
              </div>

              <div className="grid grid-cols-2 gap-0 mb-1 ml-0">
                <span className="text-[10px] text-muted-foreground text-center">No Conversion</span>
                <span className="text-[10px] text-muted-foreground text-center">Conversion</span>
              </div>

              <div className="flex items-stretch">
                <span className="text-[10px] text-muted-foreground [writing-mode:vertical-lr] rotate-180 flex items-center justify-center pr-1">Conversion</span>
                <div className="grid grid-cols-2 gap-[2px] flex-1">
                  {UPLIFT_SEGMENTS.slice(0, 2).map((seg, index) => {
                    const SegIcon = seg.icon;
                    const val = channelData.uplift_segments[seg.key as keyof typeof channelData.uplift_segments];
                    const textColor = seg.dark ? "hsl(210, 20%, 95%)" : "hsl(220, 25%, 10%)";
                    const subColor = seg.dark ? "hsl(210, 15%, 75%)" : "hsl(220, 15%, 40%)";
                    const iconColor = seg.dark ? "hsl(210, 20%, 85%)" : "hsl(220, 20%, 20%)";
                    return (
                      <div
                        key={seg.key}
                        className="first:rounded-tl-xl last:rounded-tr-xl p-5 flex flex-col items-center text-center gap-2 transition-all duration-300 hover:brightness-95 hover:shadow-md cursor-default group"
                        style={{ backgroundColor: seg.bg, animationDelay: `${index * 100}ms` }}
                      >
                        <div className={seg.animClass}>
                          <SegIcon className="h-10 w-10" style={{ color: iconColor }} />
                        </div>
                        <span className="font-bold text-sm" style={{ color: textColor }}>{seg.label}</span>
                        <span className="text-[11px] leading-relaxed max-w-[180px]" style={{ color: subColor }}>{seg.desc}</span>
                        <span className="font-mono font-bold text-lg mt-1" style={{ color: textColor }}>{(val * 100).toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-stretch">
                <span className="text-[10px] text-muted-foreground [writing-mode:vertical-lr] rotate-180 flex items-center justify-center pr-1">No Conversion</span>
                <div className="grid grid-cols-2 gap-[2px] flex-1">
                  {UPLIFT_SEGMENTS.slice(2, 4).map((seg, index) => {
                    const SegIcon = seg.icon;
                    const val = channelData.uplift_segments[seg.key as keyof typeof channelData.uplift_segments];
                    const textColor = seg.dark ? "hsl(210, 20%, 95%)" : "hsl(220, 25%, 10%)";
                    const subColor = seg.dark ? "hsl(210, 15%, 75%)" : "hsl(220, 15%, 40%)";
                    const iconColor = seg.dark ? "hsl(210, 20%, 85%)" : "hsl(220, 20%, 20%)";
                    return (
                      <div
                        key={seg.key}
                        className="first:rounded-bl-xl last:rounded-br-xl p-5 flex flex-col items-center text-center gap-2 transition-all duration-300 hover:brightness-95 hover:shadow-md cursor-default group"
                        style={{ backgroundColor: seg.bg, animationDelay: `${(index + 2) * 100}ms` }}
                      >
                        <div className={seg.animClass}>
                          <SegIcon className="h-10 w-10" style={{ color: iconColor }} />
                        </div>
                        <span className="font-bold text-sm" style={{ color: textColor }}>{seg.label}</span>
                        <span className="text-[11px] leading-relaxed max-w-[180px]" style={{ color: subColor }}>{seg.desc}</span>
                        <span className="font-mono font-bold text-lg mt-1" style={{ color: textColor }}>{(val * 100).toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { sessionId } = useSession();
  const [cateVar, setCateVar] = useState("age");
  const [selectedChannel, setSelectedChannel] = useState(CHANNEL_RANKING[0].channel);

  const { isLoading } = useQuery({
    queryKey: ["session-results", sessionId],
    queryFn: () => (sessionId ? api.getSessionResults(sessionId) : Promise.resolve(MOCK_DATA)),
    placeholderData: MOCK_DATA,
  });

  const { data: balance } = useQuery({
    queryKey: ["treatment-balance", sessionId],
    queryFn: () =>
      sessionId
        ? api.getTreatmentBalance(sessionId).catch(() => MOCK_TREATMENT_BALANCE)
        : Promise.resolve(MOCK_TREATMENT_BALANCE),
    placeholderData: MOCK_TREATMENT_BALANCE,
  });

  const flagged = (balance ?? []).filter(
    (b) =>
      (b.status === "warning" || b.status === "insufficient") &&
      b.imc_category === selectedChannel
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80 rounded-md" />
          <Skeleton className="h-80 rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description={sessionId ? `Viewing results for session ${sessionId}` : "Showing sample data — run an analysis to see real results."}
        breadcrumbs={[{ label: "Dashboard" }]}
        icon={<TrendingUp className="h-5 w-5" />}
        meta={
          <>
            <StatusPill tone={flagged.length ? "warning" : "success"}>
              {flagged.length ? `${flagged.length} balance warnings` : "All channels healthy"}
            </StatusPill>
            <span>·</span>
            <span>Channel: <span className="text-foreground font-medium">{selectedChannel}</span></span>
          </>
        }
        actions={
          <Select value={selectedChannel} onValueChange={setSelectedChannel}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((ch) => (
                <SelectItem key={ch} value={ch} className="text-sm">
                  <ChannelLabel channel={ch} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {flagged.length > 0 && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Treatment balance warning</AlertTitle>
          <AlertDescription>
            <p className="mb-2 text-sm">
              {flagged.length} channel{flagged.length > 1 ? "s have" : " has"} skewed
              treatment/control distributions — confounding risk may affect causal estimates.
            </p>
            <ul className="space-y-1 text-xs">
              {flagged.map((b) => (
                <li key={b.imc_category} className="flex flex-wrap gap-x-2">
                  <span className="font-semibold">{b.imc_category}</span>
                  <span className="opacity-80">
                    treated {b.treated_count} / control {b.control_count} (
                    {(b.treated_pct * 100).toFixed(0)}%) — {b.status}
                  </span>
                  <span className="opacity-80">· {b.message}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue={new URLSearchParams(window.location.search).get("tab") || "overview"}>
        <TabsList className="tabs-underline">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="comparison">Model Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <OverviewView
            selectedChannel={selectedChannel}
            onChannelChange={setSelectedChannel}
            cateVar={cateVar}
            setCateVar={setCateVar}
          />
        </TabsContent>

        <TabsContent value="comparison" className="mt-5">
          <DetailedComparison />
        </TabsContent>
      </Tabs>
    </div>
  );
}
