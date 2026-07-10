import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, type, ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "min-h-11 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-base text-slate-200 outline-none sm:min-h-10 sm:text-sm",
        "placeholder:text-slate-500",
        "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
        "transition-colors",
        type === "file" && "file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1 file:text-xs file:text-slate-300 file:cursor-pointer hover:file:bg-slate-600",
        className,
      )}
      {...props}
    />
  );
});
