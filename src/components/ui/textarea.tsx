import { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-base text-slate-200 outline-none resize-y sm:text-sm",
        "placeholder:text-slate-500",
        "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
        "transition-colors",
        className,
      )}
      {...props}
    />
  );
}
