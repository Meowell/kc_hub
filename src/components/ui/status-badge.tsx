import { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type StatusBadgeVariant = "default" | "success" | "warning" | "danger" | "muted";

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: StatusBadgeVariant;
};

const variantStyles: Record<StatusBadgeVariant, string> = {
  default: "border-primary/45 bg-primary/12 text-sky-200",
  success: "border-success/45 bg-success/12 text-emerald-200",
  warning: "border-warning/45 bg-warning/12 text-amber-200",
  danger: "border-danger/45 bg-danger/12 text-red-200",
  muted: "border-border-base bg-slate-800/80 text-slate-300",
};

export function StatusBadge({ variant = "default", className, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "terminal-label inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-semibold uppercase",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}
