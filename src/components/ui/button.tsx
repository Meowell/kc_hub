import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors sm:min-h-10",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
        "disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" &&
          "border border-primary/60 bg-primary/18 text-sky-100 hover:bg-primary/26 hover:border-primary",
        variant === "secondary" &&
          "border border-border-base bg-bg-panel-subtle text-slate-200 hover:border-slate-500 hover:bg-slate-800",
        variant === "outline" &&
          "border border-border-base bg-transparent text-slate-300 hover:border-primary/60 hover:text-sky-100",
        variant === "danger" &&
          "border border-danger/60 bg-danger/15 text-red-100 hover:bg-danger/24 hover:border-danger",
        variant === "ghost" &&
          "border border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/70",
        className,
      )}
      {...props}
    />
  );
}
