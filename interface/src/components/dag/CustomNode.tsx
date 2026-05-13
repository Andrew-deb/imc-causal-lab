import { Handle, Position, NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";

export default function CustomNode({ data, isConnectable, selected }: NodeProps) {
  // data.style contains the existing background, border, padding, etc.
  // We extract borderRadius to reuse it in our SVG overlay
  const borderRadius = typeof data.style?.borderRadius === "number" ? data.style.borderRadius : 10;
  
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ opacity: 0 }} />
      <div 
        style={data.style} 
        className={cn(
          "relative flex items-center justify-center transition-shadow",
          selected && "shadow-md"
        )}
      >
        {/* Animated Dashed SVG overlay to match edge selection */}
        {selected && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ borderRadius, zIndex: 10 }}>
            <rect 
              width="100%" 
              height="100%" 
              rx={borderRadius} 
              fill="none" 
              stroke="hsl(var(--primary))" 
              strokeWidth="4" 
              strokeDasharray="6,6" 
              className="animate-[dashdraw_0.5s_linear_infinite]"
            />
          </svg>
        )}
        
        {/* We need a local keyframes for dashdraw just in case */}
        {selected && (
          <style>{`
            @keyframes dashdraw {
              from { stroke-dashoffset: 12; }
              to { stroke-dashoffset: 0; }
            }
          `}</style>
        )}

        <span>{data.label}</span>
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} style={{ opacity: 0 }} />
    </>
  );
}
