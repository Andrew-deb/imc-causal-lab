import { ReactNode } from "react";
import { Breadcrumbs, Crumb } from "./Breadcrumbs";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  meta?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  meta,
  actions,
  icon,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("pb-4 mb-4 border-b border-border", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {icon && <span className="text-muted-foreground">{icon}</span>}
            <h1 className="text-xl font-semibold tracking-tight text-foreground truncate">
              {title}
            </h1>
          </div>
          {description && (
            <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
              {description}
            </p>
          )}
          {meta && <div className="flex items-center flex-wrap gap-2 mt-2 text-xs text-muted-foreground">{meta}</div>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
