import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

interface KpiTileProps {
  label: string;
  value: ReactNode;
  delta?: { value: string; direction?: "up" | "down" | "flat"; positive?: boolean };
  hint?: string;
  icon?: ReactNode;
  className?: string;
}

export function KpiTile({ label, value, delta, hint, icon, className }: KpiTileProps) {
  return (
    <div className={cn("panel p-3 flex flex-col gap-1 min-w-0", className)}>
      <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <span className="truncate">{label}</span>
        {icon && <span className="text-muted-foreground/70">{icon}</span>}
      </div>
      <div className="text-2xl font-semibold tabular-nums text-foreground leading-tight">
        {value}
      </div>
      <div className="flex items-center gap-1.5 text-[11px] mt-0.5 min-h-[14px]">
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              delta.positive === false ? "text-danger" : "text-success"
            )}
          >
            {delta.direction === "down" ? (
              <ArrowDown className="h-3 w-3" />
            ) : delta.direction === "up" ? (
              <ArrowUp className="h-3 w-3" />
            ) : null}
            {delta.value}
          </span>
        )}
        {hint && <span className="text-muted-foreground truncate">{hint}</span>}
      </div>
    </div>
  );
}
