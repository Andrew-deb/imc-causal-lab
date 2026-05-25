import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Search, BookOpen } from "lucide-react";
import { CommandPalette } from "@/components/CommandPalette";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth, UserButton } from "@/lib/auth-wrapper";

export function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { isSignedIn } = useAuth();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <header className="h-11 border-b border-border bg-surface flex items-center justify-between px-2 sm:px-3 shrink-0 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <SidebarTrigger className="md:hidden h-7 w-7" aria-label="Toggle sidebar" />
        <div className="hidden sm:flex items-center gap-1.5 text-[13px] text-muted-foreground min-w-0">
          <span className="font-semibold text-foreground truncate">Causal Console</span>
          <span className="text-border">/</span>
          <span className="truncate">Analytics</span>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen}>
        <button
          type="button"
          aria-label="Search"
          className="flex items-center gap-2 h-7 rounded-md border border-border bg-surface-sunken text-muted-foreground text-xs hover:bg-muted transition-colors px-2 md:px-2.5 md:w-72"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden md:inline flex-1 text-left">Search sessions, DAGs, channels…</span>
          <kbd className="hidden md:inline font-mono text-[10px] px-1 py-0.5 rounded border border-border bg-surface text-muted-foreground">⌘K</kbd>
        </button>
      </CommandPalette>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="hidden sm:inline-flex h-7 gap-1.5 text-xs text-muted-foreground" asChild>
          <a href="/docs" target="_blank" rel="noopener noreferrer">
            <BookOpen className="h-3.5 w-3.5" /> Docs
          </a>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-7 w-7"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </Button>
        {isSignedIn ? (
          <div className="ml-1 flex items-center justify-center h-7 w-7">
            <UserButton afterSignOutUrl="/" />
          </div>
        ) : (
          <Avatar className="h-7 w-7 ml-1">
            <AvatarFallback className="bg-muted text-muted-foreground text-[11px]">U</AvatarFallback>
          </Avatar>
        )}
      </div>
    </header>
  );
}
