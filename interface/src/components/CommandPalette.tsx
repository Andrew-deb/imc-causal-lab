import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  Home, LayoutDashboard, History, Workflow, PlusCircle, Info,
  Sun, Moon, FolderKanban, ArrowRight,
} from "lucide-react";

const MOCK_SESSION_IDS = [
  "session_20260313_ab12",
  "session_20260310_cd34",
  "session_20260308_ef56",
];

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

  const run = (fn: () => void) => {
    onOpenChange(false);
    setTimeout(fn, 0);
  };

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
          <CommandInput placeholder="Search sessions, DAGs, pages, actions…" />
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
                    onSelect={() => run(() => { setSelectedDagId(d.dag_id); navigate("/discover"); })}
                  >
                    <Workflow className="mr-2 h-4 w-4" />
                    <span className="truncate">{d.name}</span>
                    <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandGroup heading="Sessions">
              {MOCK_SESSION_IDS.map((id) => (
                <CommandItem
                  key={id}
                  value={`session ${id}`}
                  onSelect={() => run(() => { setSessionId(id); navigate("/sessions"); })}
                >
                  <FolderKanban className="mr-2 h-4 w-4" />
                  <span className="font-mono text-xs">{id}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
