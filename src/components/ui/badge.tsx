import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "outline" | "accent";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantStyles: Record<BadgeVariant, string> = {
  default: "border border-primary/45 bg-primary/15 text-sky-100",
  secondary: "border border-border-base bg-bg-panel-subtle text-slate-300",
  outline: "border border-border-base text-slate-400",
  accent: "border border-primary/35 bg-primary/10 text-sky-200",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}
