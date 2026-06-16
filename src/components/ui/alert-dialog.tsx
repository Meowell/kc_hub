"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type AlertDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode };
export function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/70" onClick={() => onOpenChange(false)} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="surface-panel relative z-[60] w-full max-w-md rounded-md p-6 shadow-2xl shadow-black/40" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </>
  );
}

export function AlertDialogHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4", className)} {...props}>{children}</div>;
}
export function AlertDialogTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("terminal-label text-base font-semibold uppercase text-white", className)} {...props}>{children}</h2>;
}
export function AlertDialogDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-2 text-sm leading-6 text-slate-400", className)} {...props}>{children}</p>;
}
export function AlertDialogFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-6 flex items-center justify-end gap-3", className)} {...props}>{children}</div>;
}
export function AlertDialogAction({ className, variant, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "danger" }) {
  return <Button variant={variant === "danger" ? "danger" : "primary"} className={className} {...props}>{children}</Button>;
}
export function AlertDialogCancel({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button variant="secondary" className={className} {...props}>{children ?? "取消"}</Button>;
}
