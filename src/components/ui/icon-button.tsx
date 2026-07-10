import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function IconButton({ className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-transparent text-slate-300 transition-colors",
        "hover:border-border-base hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
