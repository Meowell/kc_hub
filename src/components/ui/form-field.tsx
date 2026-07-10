import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function FormField({
  id,
  label,
  help,
  error,
  required,
  children,
  className,
}: {
  id: string;
  label: string;
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactElement;
  className?: string;
}) {
  const descriptionId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        required,
        "aria-invalid": !!error,
        "aria-describedby": describedBy,
      })
    : children;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-slate-200">
        {label}
        {required && <span className="ml-1 text-red-300" aria-hidden="true">*</span>}
      </label>
      {control}
      {help && <p id={descriptionId} className="text-sm text-slate-400">{help}</p>}
      {error && <p id={errorId} role="alert" className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
