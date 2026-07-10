"use client";

import { AlertTriangle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipName: string;
  currentTagName: string;
  targetTagName: string;
  onConfirm: () => void | Promise<void>;
};

export function ConflictAlertDialog({ open, onOpenChange, shipName, currentTagName, targetTagName, onConfirm }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />覆盖锁定确认</AlertDialogTitle>
        <AlertDialogDescription>
          <strong className="text-white">{shipName}</strong> 已被锁定在{" "}
          <span className="font-semibold text-blue-400">{currentTagName}</span>。
          <br />确认移动到 <span className="font-semibold text-blue-400">{targetTagName}</span>？
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={() => onOpenChange(false)}>取消</AlertDialogCancel>
        <AlertDialogAction variant="danger" onClick={onConfirm}>
          确认覆盖
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialog>
  );
}
