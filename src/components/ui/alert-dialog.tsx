"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function AlertDialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent role="alertdialog" className="sm:max-w-md">{children}</DialogContent>
    </Dialog>
  );
}

export function AlertDialogHeader(props: React.HTMLAttributes<HTMLDivElement>) { return <DialogHeader {...props} />; }
export function AlertDialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) { return <DialogTitle className={cn("text-base", className)} {...props} />; }
export function AlertDialogDescription(props: React.HTMLAttributes<HTMLParagraphElement>) { return <DialogDescription {...props} />; }
export function AlertDialogFooter(props: React.HTMLAttributes<HTMLDivElement>) { return <DialogFooter {...props} />; }
export function AlertDialogAction({ className, variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "danger" }) {
  return <Button variant={variant === "danger" ? "danger" : "primary"} className={className} {...props} />;
}
export function AlertDialogCancel({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button variant="secondary" className={className} {...props}>{children ?? "取消"}</Button>;
}
