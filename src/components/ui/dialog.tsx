"use client";

import { X } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type DialogContextValue = {
  setOpen: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
  contentRef: React.RefObject<HTMLDivElement>;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialog() {
  const context = React.useContext(DialogContext);
  if (!context) throw new Error("Dialog compound components must be used within <Dialog>");
  return context;
}

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      const first = contentRef.current?.querySelector<HTMLElement>(focusableSelector);
      (first ?? contentRef.current)?.focus();
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (event.key !== "Tab" || !contentRef.current) return;
      const focusable = [...contentRef.current.querySelectorAll<HTMLElement>(focusableSelector)];
      if (focusable.length === 0) {
        event.preventDefault();
        contentRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      window.setTimeout(() => restoreFocusRef.current?.focus());
    };
  }, [open, onOpenChange]);

  if (!open || !mounted) return null;

  return createPortal(
    <DialogContext.Provider value={{ setOpen: onOpenChange, titleId, descriptionId, contentRef }}>
      <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
        <button
          type="button"
          aria-label="关闭弹层"
          className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        />
        {children}
      </div>
    </DialogContext.Provider>,
    document.body,
  );
}

export function DialogContent({ className, children, role = "dialog", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { setOpen, titleId, descriptionId, contentRef } = useDialog();
  return (
    <div
      ref={contentRef}
      role={role}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      tabIndex={-1}
      className={cn(
        "relative z-10 max-h-[100dvh] w-full overflow-y-auto rounded-t-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-black/40",
        "sm:max-h-[85dvh] sm:max-w-lg sm:rounded-xl sm:p-6",
        className,
      )}
      {...props}
    >
      <button
        type="button"
        className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        onClick={() => setOpen(false)}
        aria-label="关闭"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      {children}
    </div>
  );
}

export function DialogHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 pr-10", className)} {...props}>{children}</div>;
}

export function DialogTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = useDialog();
  return <h2 id={titleId} className={cn("text-lg font-semibold text-white", className)} {...props}>{children}</h2>;
}

export function DialogDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const { descriptionId } = useDialog();
  return <p id={descriptionId} className={cn("mt-1 text-sm leading-6 text-slate-300", className)} {...props}>{children}</p>;
}

export function DialogFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end", className)} {...props}>{children}</div>;
}
