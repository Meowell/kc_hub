import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AsyncState = "idle" | "pending" | "success" | "error" | "conflict";

export function AsyncButton({
  pending,
  pendingLabel = "处理中…",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean; pendingLabel?: string }) {
  return (
    <Button disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />{pendingLabel}</> : children}
    </Button>
  );
}

const stateClasses: Record<Exclude<AsyncState, "idle">, string> = {
  pending: "text-sky-200",
  success: "text-emerald-200",
  error: "text-red-200",
  conflict: "text-amber-200",
};

export function InlineStatus({ state, children, className }: { state: AsyncState; children?: ReactNode; className?: string }) {
  if (state === "idle" && !children) return null;
  return (
    <p
      role={state === "error" || state === "conflict" ? "alert" : "status"}
      aria-live={state === "error" || state === "conflict" ? "assertive" : "polite"}
      className={cn("text-sm", state === "idle" ? "text-slate-400" : stateClasses[state], className)}
    >
      {children}
    </p>
  );
}
