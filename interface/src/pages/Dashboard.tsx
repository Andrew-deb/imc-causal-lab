import { useQuery } from "@tanstack/react-query";
import { api, SessionResults, TreatmentBalanceResult, UpliftSegments } from "@/lib/api";
import { useSession } from "@/contexts/SessionContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { TrendingUp, Users, Layers, Target, Crosshair, Check, XCircle, MoonStar, AlertTriangle, Zap, ShieldAlert } from "lucide-react";
import ModelEvaluation from "@/components/dashboard/ModelEvaluation";
import { PageHeader } from "@/components/console/PageHeader";
import { StatusPill } from "@/components/console/StatusPill";

const UPLIFT_SEGMENTS = [
  { key: "persuadables", label: "Persuadables", bg: "hsl(90, 30%, 78%)", icon: Crosshair, desc: "Customers who will convert only if targeted.", dark: false, animClass: "uplift-icon-target" },
  { key: "sure_things", label: "Sure Things", bg: "hsl(200, 30%, 80%)", icon: Check, desc: "Customers who will convert whether targeted or not.", dark: false, animClass: "uplift-icon-check" },
  { key: "lost_causes", label: "Lost Causes", bg: "hsl(210, 12%, 90%)", icon: XCircle, desc: "Customers who won't convert whether targeted or not.", dark: false, animClass: "uplift-icon-x" },
  { key: "sleeping_dogs", label: "Sleeping Dogs", bg: "hsl(215, 25%, 45%)", icon: MoonStar, desc: "Customers who will convert only if not targeted.", dark: true, animClass: "uplift-icon-moon" },
];


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

function ChannelLabel({ channel, data }: { channel: string, data: SessionResults }) {
  const conf = data.channel_data[channel]?.confidence_level;
  return (
    <span>
      {channel}
      {conf === "insufficient" && " ⚠"}
      {conf === "weak" && " ⚡"}
    </span>
  );
}

function OverviewView({ selectedChannel, onChannelChange, cateVar, setCateVar, data }: {
  selectedChannel: string;
  onChannelChange: (ch: string) => void;
  cateVar: string;
  setCateVar: (v: string) => void;
  data: SessionResults;
}) {
  const channelData = data.channel_data[selectedChannel];
  const cateData = channelData?.model_results[channelData.best_model]?.cate_by_segment?.[cateVar]
    ? Object.entries(channelData.model_results[channelData.best_model].cate_by_segment[cateVar]).map(([name, value]) => ({ name, value }))
    : [];

  const getBarOpacity = (channel: string) => {
    const conf = data.channel_data[channel]?.confidence_level;
    if (conf === "insufficient") return 0.4;
    if (conf === "weak") return 0.7;
    return 1;
  };

  const renderCustomYAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const conf = data.channel_data[payload.value]?.confidence_level;
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
    const conf = data.channel_data[entry.channel]?.confidence_level;
    return (
      <div className="rounded-lg border bg-card p-2 text-xs shadow-md" style={{ borderColor: "hsl(var(--border))" }}>
        <p className="font-medium">{entry.channel}: {(entry.consensus_ate * 100).toFixed(1)}%</p>
        {conf === "insufficient" && (
          <p className="text-destructive mt-1">⚠ Insufficient treatment/control variation — results may be unreliable</p>
        )}
        {conf === "weak" && (
          <p className="text-yellow-600 dark:text-yellow-400 mt-1">⚡ Limited variation — interpret with caution</p>
        )}
      </div>
    );
  };

  if (!channelData) return null;

  return (
    <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title={`${selectedChannel} — ATE`} value={channelData.consensus_ate} icon={TrendingUp} format="percent" confidenceLevel={channelData.confidence_level} />
        <MetricCard title={`${selectedChannel} — ATT`} value={channelData.consensus_att} icon={Target} format="percent" confidenceLevel={channelData.confidence_level} />
        <MetricCard title={`${selectedChannel} — Customers`} value={data.balance_results.find(b => b.imc_category === selectedChannel)?.treated_count! + data.balance_results.find(b => b.imc_category === selectedChannel)?.control_count! || 0} icon={Users} format="number" />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Best Model</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">🏆 {channelData.best_model}</div>
            <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
              Highest Uplift AUC
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">IMC Channel Ranking</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={data.channel_ranking}
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
                <Bar dataKey="consensus_ate" radius={[0, 4, 4, 0]}>
                  {data.channel_ranking.map((entry) => (
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
                {Object.keys(channelData.model_results[channelData.best_model]?.cate_by_segment || {}).map((v) => (
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
                    const val = channelData.model_results[channelData.best_model]?.uplift_segments?.[seg.key as keyof UpliftSegments] || 0;
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
                    const val = channelData.model_results[channelData.best_model]?.uplift_segments?.[seg.key as keyof UpliftSegments] || 0;
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
  const [selectedChannel, setSelectedChannel] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["session-results", sessionId],
    queryFn: () => (sessionId ? api.getSessionResults(sessionId) : Promise.reject("No session ID")),
    enabled: !!sessionId,
  });

  const { data: balance } = useQuery({
    queryKey: ["treatment-balance", sessionId],
    queryFn: () => sessionId ? api.getTreatmentBalance(sessionId) : Promise.reject("No session ID"),
    enabled: !!sessionId,
  });

  const { data: evaluationData, isLoading: isLoadingEval } = useQuery({
    queryKey: ["evaluation-results", sessionId],
    queryFn: () => (sessionId ? api.getEvaluationResults(sessionId) : Promise.reject("No session ID")),
    enabled: !!sessionId,
  });

  const channels = data ? Object.keys(data.channel_data) : [];
  
  // Auto-select first channel
  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) {
      setSelectedChannel(channels[0]);
    }
  }, [channels, selectedChannel]);

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
              {channels.map((ch) => (
                <SelectItem key={ch} value={ch} className="text-sm">
                  <ChannelLabel channel={ch} data={data!} />
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
          <TabsTrigger value="evaluation">Model Evaluation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          {data && <OverviewView
            selectedChannel={selectedChannel}
            onChannelChange={setSelectedChannel}
            cateVar={cateVar}
            setCateVar={setCateVar}
            data={data}
          />}
        </TabsContent>

        <TabsContent value="evaluation" className="mt-5">
          {data && evaluationData && (
            <ModelEvaluation 
              selectedChannel={selectedChannel} 
              onChannelChange={setSelectedChannel}
              data={data}
              evaluationData={evaluationData}
            />
          )}
          {isLoadingEval && (
             <div className="flex justify-center py-10">
               <Skeleton className="h-80 w-full" />
             </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
