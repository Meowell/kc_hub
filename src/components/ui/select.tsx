import { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({ className, style, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-11 w-full cursor-pointer rounded-md border border-slate-600 !bg-slate-900 px-3 py-2 text-base !text-slate-100 outline-none sm:min-h-10 sm:text-sm",
        "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
        "transition-colors appearance-none",
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat pr-10",
        className,
      )}
      style={{ colorScheme: "dark", backgroundColor: "#0f172a", color: "#f1f5f9", ...style }}
      {...props}
    />
  );
}
