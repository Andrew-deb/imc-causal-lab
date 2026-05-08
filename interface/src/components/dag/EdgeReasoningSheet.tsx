import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Trash2, Hand } from "lucide-react";
import { ROLE_COLORS } from "@/lib/causal-graph";
import type { CausalEdgeFull } from "@/lib/dag-store";

const RELATIONSHIP_COLOR: Record<CausalEdgeFull["relationship_type"], string> = {
  direct: "hsl(var(--primary))",
  confounder: ROLE_COLORS.confounder,
  mediator: ROLE_COLORS.mediator,
};

interface Props {
  edge: CausalEdgeFull | null;
  onClose: () => void;
  onDelete?: (edge: CausalEdgeFull) => void;
  readOnly?: boolean;
}

export default function EdgeReasoningSheet({ edge, onClose, onDelete, readOnly }: Props) {
  return (
    <Sheet open={!!edge} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {edge && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {edge.origin === "llm" ? (
                  <Sparkles className="h-4 w-4 text-primary" />
                ) : (
                  <Hand className="h-4 w-4 text-primary" />
                )}
                {edge.source} → {edge.target}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2 pt-1">
                <Badge
                  className="capitalize"
                  style={{
                    backgroundColor: `${RELATIONSHIP_COLOR[edge.relationship_type]}1A`,
                    color: RELATIONSHIP_COLOR[edge.relationship_type],
                    border: `1px solid ${RELATIONSHIP_COLOR[edge.relationship_type]}40`,
                  }}
                >
                  {edge.relationship_type}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {edge.origin === "llm" ? "AI-Generated" : "Manual"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Confidence:{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {(edge.confidence * 100).toFixed(0)}%
                  </span>
                </span>
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Reasoning
              </p>
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {edge.reasoning}
              </p>
            </div>
            {!readOnly && onDelete && (
              <div className="mt-6">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => { onDelete(edge); onClose(); }}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Edge
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
