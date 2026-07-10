"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Registration = { dirty: boolean; save: () => Promise<boolean> };
type DirtyGuardContextValue = {
  navigate: (href: string) => void;
  register: (id: string, registration: Registration) => () => void;
};

const DirtyGuardContext = createContext<DirtyGuardContextValue | null>(null);

export function DirtyGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const registrationsRef = useRef(new Map<string, Registration>());
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hasDirty = useCallback(
    () => [...registrationsRef.current.values()].some((registration) => registration.dirty),
    [],
  );

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!hasDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hasDirty]);

  const value = useMemo<DirtyGuardContextValue>(() => ({
    navigate(href) {
      if (hasDirty()) setPendingHref(href);
      else router.push(href);
    },
    register(id, registration) {
      registrationsRef.current.set(id, registration);
      return () => registrationsRef.current.delete(id);
    },
  }), [hasDirty, router]);

  async function saveAndNavigate() {
    if (!pendingHref || saving) return;
    setSaving(true);
    const dirtyRegistrations = [...registrationsRef.current.values()].filter((registration) => registration.dirty);
    const results = await Promise.all(dirtyRegistrations.map((registration) => registration.save().catch(() => false)));
    setSaving(false);
    if (results.every(Boolean)) {
      const href = pendingHref;
      setPendingHref(null);
      router.push(href);
    }
  }

  return (
    <DirtyGuardContext.Provider value={value}>
      {children}
      <AlertDialog open={!!pendingHref} onOpenChange={(open) => { if (!open && !saving) setPendingHref(null); }}>
        <AlertDialogHeader>
          <AlertDialogTitle>切换前处理未保存内容</AlertDialogTitle>
          <AlertDialogDescription>当前页面还有未保存内容。你可以先保存并切换，或放弃这些修改。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving} onClick={() => setPendingHref(null)}>取消</AlertDialogCancel>
          <AlertDialogAction
            variant="danger"
            disabled={saving}
            onClick={() => {
              if (!pendingHref) return;
              const href = pendingHref;
              setPendingHref(null);
              router.push(href);
            }}
          >
            放弃并切换
          </AlertDialogAction>
          <AlertDialogAction disabled={saving} onClick={() => void saveAndNavigate()}>{saving ? "保存中…" : "保存并切换"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </DirtyGuardContext.Provider>
  );
}

export function useDirtyGuardNavigation() {
  const context = useContext(DirtyGuardContext);
  if (!context) throw new Error("useDirtyGuardNavigation must be used within DirtyGuardProvider");
  return context.navigate;
}

export function useDirtyForm(dirty: boolean, save: () => Promise<boolean>) {
  const context = useContext(DirtyGuardContext);
  const id = useId();
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (!context) return;
    return context.register(id, { dirty, save: () => saveRef.current() });
  }, [context, dirty, id]);
}
