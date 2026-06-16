import { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  eyebrow?: string;
  title?: string;
  status?: ReactNode;
  actions?: ReactNode;
  dense?: boolean;
};

export function Panel({
  eyebrow,
  title,
  status,
  actions,
  dense = false,
  className,
  children,
  ...props
}: PanelProps) {
  const hasHeader = eyebrow || title || status || actions;

  return (
    <section
      className={cn("surface-panel overflow-hidden rounded-md", className)}
      {...props}
    >
      {hasHeader && (
        <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border-base/70 bg-slate-950/25 px-4 py-2.5">
          <div className="min-w-0">
            {eyebrow && (
              <p className="terminal-label text-[11px] font-semibold uppercase text-primary">
                {eyebrow}
              </p>
            )}
            {title && <h2 className="truncate text-sm font-semibold text-white">{title}</h2>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {status}
            {actions}
          </div>
        </div>
      )}
      <div className={cn(dense ? "p-3" : "p-4 sm:p-5")}>{children}</div>
    </section>
  );
}
