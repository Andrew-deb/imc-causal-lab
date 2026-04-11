import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSession } from "@/contexts/SessionContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Moon, Sun } from "lucide-react";

export function TopBar() {
  const { sessionId } = useSession();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-3 sm:px-4 shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <SidebarTrigger />
        <h1 className="text-sm sm:text-lg font-semibold text-foreground truncate">Causal Analytics Platform</h1>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {sessionId && (
          <Badge variant="secondary" className="font-mono text-xs hidden sm:inline-flex">
            Session: {sessionId.slice(0, 16)}…
          </Badge>
        )}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
          <Moon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
        </div>
        <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
          <AvatarFallback className="bg-muted text-muted-foreground text-xs">U</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
