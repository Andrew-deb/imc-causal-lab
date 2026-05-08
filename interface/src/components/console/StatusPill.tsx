import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type Tone = "default" | "success" | "warning" | "danger" | "info";

const toneStyles: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function StatusPill({
  tone = "default",
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium leading-none",
        toneStyles[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}
