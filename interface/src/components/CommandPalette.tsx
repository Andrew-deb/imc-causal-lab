import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDAGLibrary } from "@/lib/dag-store";
import { useSession } from "@/contexts/SessionContext";
import { useTheme } from "@/contexts/ThemeContext";
import { api, SessionSummary, PipelineJob } from "@/lib/api";
import {
  Home, LayoutDashboard, History, Workflow, PlusCircle, Info,
  Sun, Moon, FolderKanban, ArrowRight, BookOpen, Activity,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  children: ReactNode;
}

export function CommandPalette({ open, onOpenChange, children }: Props) {
  const navigate = useNavigate();
  const { dags } = useDAGLibrary();
  const { setSelectedDagId, setSessionId } = useSession();
  const { theme, toggleTheme } = useTheme();

  // Fetch real sessions
  const { data: sessions = [] } = useQuery<SessionSummary[]>({
    queryKey: ["sessions"],
    queryFn: async () => {
      try {
        return await api.getSessions();
      } catch (err) {
        console.error("CommandPalette failed to fetch sessions:", err);
        return [];
      }
    },
    enabled: open, // Only fetch when palette opens
  });

  // Fetch real pipeline runs
  const { data: pipelineJobs = [] } = useQuery<PipelineJob[]>({
    queryKey: ["pipeline-jobs"],
    queryFn: async () => {
      try {
        return await api.getPipelineJobs();
      } catch (err) {
        console.error("CommandPalette failed to fetch pipeline jobs:", err);
        return [];
      }
    },
    enabled: open, // Only fetch when palette opens
  });

  const run = (fn: () => void) => {
    onOpenChange(false);
    setTimeout(fn, 0);
  };

  // Group jobs by run_id or session_id to show unique runs
  const getUniqueRuns = (jobsList: PipelineJob[]) => {
    const uniqueMap = new Map<string, PipelineJob>();
    jobsList.forEach((job) => {
      const runKey = job.run_id || job.session_id || job.job_id;
      if (!uniqueMap.has(runKey)) {
        uniqueMap.set(runKey, job);
      }
    });
    return Array.from(uniqueMap.values());
  };

  const uniqueRuns = getUniqueRuns(pipelineJobs);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="p-0 w-[min(92vw,420px)] overflow-hidden"
        onOpenAutoFocus={(e) => {
          // allow CommandInput to take focus naturally
        }}
      >
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
          <CommandInput placeholder="Search sessions, DAGs, pages, runs…" />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>No results found.</CommandEmpty>

            <CommandGroup heading="Navigate">
              <CommandItem onSelect={() => run(() => navigate("/"))}>
                <Home className="mr-2 h-4 w-4" /> Home
              </CommandItem>
              <CommandItem onSelect={() => run(() => navigate("/dashboard"))}>
                <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
              </CommandItem>
              <CommandItem onSelect={() => run(() => navigate("/sessions"))}>
                <History className="mr-2 h-4 w-4" /> Session History
              </CommandItem>
              <CommandItem onSelect={() => run(() => navigate("/discover"))}>
                <Workflow className="mr-2 h-4 w-4" /> Discover Studio
              </CommandItem>
              <CommandItem onSelect={() => run(() => window.open("/docs", "_blank"))}>
                <BookOpen className="mr-2 h-4 w-4" /> Documentation
              </CommandItem>
              <CommandItem onSelect={() => run(() => navigate("/about"))}>
                <Info className="mr-2 h-4 w-4" /> About Platform
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading="Actions">
              <CommandItem onSelect={() => run(() => navigate("/new-analysis"))}>
                <PlusCircle className="mr-2 h-4 w-4" /> New Causal Analysis
              </CommandItem>
              <CommandItem onSelect={() => run(toggleTheme)}>
                {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                Toggle theme ({theme === "dark" ? "light" : "dark"})
              </CommandItem>
            </CommandGroup>

            {dags.length > 0 && (
              <CommandGroup heading="DAGs">
                {dags.map((d) => (
                  <CommandItem
                    key={d.dag_id}
                    value={`dag ${d.name} ${d.dag_id}`}
                    onSelect={() => run(() => { setSelectedDagId(d.dag_id); navigate(`/discover?dag_id=${d.dag_id}`); })}
                  >
                    <Workflow className="mr-2 h-4 w-4 text-primary" />
                    <span className="truncate">{d.name}</span>
                    <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {sessions.length > 0 && (
              <CommandGroup heading="Sessions">
                {sessions.slice(0, 5).map((s) => (
                  <CommandItem
                    key={s.session_id}
                    value={`session ${s.session_id}`}
                    onSelect={() => run(() => { setSessionId(s.session_id); navigate(`/dashboard?session_id=${s.session_id}`); })}
                  >
                    <FolderKanban className="mr-2 h-4 w-4 text-success" />
                    <span className="font-mono text-xs truncate max-w-[200px]">{s.session_id}</span>
                    {s.has_results && (
                      <span className="ml-2 text-[9px] bg-success/10 text-success border border-success/20 px-1 rounded-sm scale-90">
                        results
                      </span>
                    )}
                    <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {uniqueRuns.length > 0 && (
              <CommandGroup heading="Pipeline Runs">
                {uniqueRuns.slice(0, 5).map((job) => {
                  const runKey = job.run_id || job.session_id || job.job_id;
                  return (
                    <CommandItem
                      key={job.job_id}
                      value={`run job pipeline monitor ${job.job_id} ${runKey}`}
                      onSelect={() => run(() => navigate(`/monitor/${runKey}`))}
                    >
                      <Activity className="mr-2 h-4 w-4 text-warning" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-mono text-[10px] truncate max-w-[200px]">{runKey}</span>
                        <span className="text-[9px] text-muted-foreground capitalize">
                          {job.pipeline_type} • {job.status}
                        </span>
                      </div>
                      <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground shrink-0" />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
