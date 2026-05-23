import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { Fragment } from "react";

export interface Crumb {
  label: string;
  to?: string;
  link?: string;
  onClick?: () => void;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center text-xs text-muted-foreground gap-1 mb-1.5" aria-label="Breadcrumb">
      <Link to="/" className="flex items-center hover:text-foreground transition-colors">
        <Home className="h-3 w-3" />
      </Link>
      {items.map((c, i) => {
        const isLast = i === items.length - 1;
        const targetPath = c.to || c.link;
        return (
          <Fragment key={i}>
            <ChevronRight className="h-3 w-3 text-border" />
            {!isLast && c.onClick ? (
              <button
                type="button"
                onClick={c.onClick}
                className="hover:text-foreground transition-colors truncate max-w-[200px]"
              >
                {c.label}
              </button>
            ) : !isLast && targetPath ? (
              <Link to={targetPath} className="hover:text-foreground transition-colors truncate max-w-[200px]">
                {c.label}
              </Link>
            ) : (
              <span className="text-foreground truncate max-w-[280px]">{c.label}</span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
