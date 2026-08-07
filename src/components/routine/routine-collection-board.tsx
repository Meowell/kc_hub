"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  Check,
  ExternalLink,
  Images,
  LoaderCircle,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RoutineCollection, RoutineCollectionStep } from "@/lib/routine-collections";
import { summarizeRoutineProgress } from "@/lib/routine-collections";

type InitialProgress = {
  stepKey: string;
  completedCount: number;
};

type ImagePreview = {
  src: string;
  alt: string;
} | null;

function progressRecord(initialProgress: InitialProgress[]) {
  return Object.fromEntries(initialProgress.map((item) => [item.stepKey, item.completedCount]));
}

function StepControl({
  step,
  value,
  pending,
  onChange,
}: {
  step: RoutineCollectionStep;
  value: number;
  pending: boolean;
  onChange: (nextValue: number) => void;
}) {
  if (step.requiredCount === 1) {
    const checked = value === 1;
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={`${step.seaArea} ${checked ? "标记为未完成" : "标记为完成"}`}
        disabled={pending}
        onClick={() => onChange(checked ? 0 : 1)}
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition-colors ${
          checked
            ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
            : "border-slate-600 bg-slate-900/70 text-slate-500 hover:border-sky-400/60 hover:text-sky-200"
        } disabled:cursor-wait disabled:opacity-70`}
      >
        {pending ? (
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <Check className={`h-5 w-5 ${checked ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />
        )}
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center rounded-md border border-slate-600 bg-slate-900/70" aria-label={`${step.seaArea} 完成次数`}>
      <button
        type="button"
        aria-label={`${step.seaArea} 减少一次完成记录`}
        title="减少一次"
        disabled={pending || value <= 0}
        onClick={() => onChange(value - 1)}
        className="inline-flex h-11 w-11 items-center justify-center text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="min-w-14 text-center text-sm font-semibold tabular-nums text-white" aria-live="polite">
        {pending ? <LoaderCircle className="mx-auto h-4 w-4 animate-spin" aria-hidden="true" /> : `${value}/${step.requiredCount}`}
      </span>
      <button
        type="button"
        aria-label={`${step.seaArea} 增加一次完成记录`}
        title="增加一次"
        disabled={pending || value >= step.requiredCount}
        onClick={() => onChange(value + 1)}
        className="inline-flex h-11 w-11 items-center justify-center text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function RoutineCollectionBoard({
  collection,
  initialProgress,
}: {
  collection: RoutineCollection;
  initialProgress: InitialProgress[];
}) {
  const [progress, setProgress] = useState<Record<string, number>>(() => progressRecord(initialProgress));
  const [pendingSteps, setPendingSteps] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ImagePreview>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const summary = useMemo(() => summarizeRoutineProgress(collection, progress), [collection, progress]);

  async function updateStep(step: RoutineCollectionStep, completedCount: number) {
    if (pendingSteps.has(step.key)) return;
    const previous = progress[step.key] ?? 0;
    setError("");
    setProgress((current) => ({ ...current, [step.key]: completedCount }));
    setPendingSteps((current) => new Set(current).add(step.key));

    try {
      const response = await fetch("/api/routine-collections/progress", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ collectionKey: collection.key, stepKey: step.key, completedCount }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "保存进度失败");
    } catch (saveError) {
      setProgress((current) => ({ ...current, [step.key]: previous }));
      setError(saveError instanceof Error ? saveError.message : "保存进度失败，请重试。");
    } finally {
      setPendingSteps((current) => {
        const next = new Set(current);
        next.delete(step.key);
        return next;
      });
    }
  }

  async function resetProgress() {
    if (resetting) return;
    const previous = progress;
    setResetting(true);
    setError("");
    setProgress({});

    try {
      const response = await fetch(
        `/api/routine-collections/progress?collectionKey=${encodeURIComponent(collection.key)}`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "重置进度失败");
      setResetOpen(false);
    } catch (resetError) {
      setProgress(previous);
      setError(resetError instanceof Error ? resetError.message : "重置进度失败，请重试。");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="surface-panel rounded-md p-4 sm:p-5" aria-labelledby="routine-collection-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="routine-collection-title" className="text-lg font-semibold text-white">
                {collection.title}
              </h2>
              <a
                href={collection.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-700 px-2.5 text-xs font-medium text-slate-300 transition-colors hover:border-sky-500/50 hover:text-sky-200"
              >
                原表 <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
            <p className="mt-1 text-sm text-slate-400">{collection.description}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setResetOpen(true)}
            disabled={summary.completedCount === 0 || pendingSteps.size > 0 || resetting}
            className="shrink-0"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            重置进度
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-slate-300">总进度</span>
              <span className="tabular-nums text-slate-400">
                {summary.completedSteps}/{summary.totalSteps} 步 · {summary.completedCount}/{summary.requiredCount} 次
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-slate-800"
              role="progressbar"
              aria-label="作业合集总进度"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={summary.percent}
            >
              <div className="h-full rounded-full bg-emerald-400 transition-[width]" style={{ width: `${summary.percent}%` }} />
            </div>
          </div>
          <p className="text-right text-2xl font-bold tabular-nums text-emerald-300">{summary.percent}%</p>
        </div>
        <p className="mt-2 min-h-5 text-sm text-red-300" role="status" aria-live="polite">
          {error}
        </p>
      </section>

      <ol className="surface-panel divide-y divide-slate-700/70 overflow-hidden rounded-md">
        {collection.steps.map((step, index) => {
          const completedCount = progress[step.key] ?? 0;
          const complete = completedCount === step.requiredCount;
          const pending = pendingSteps.has(step.key);

          return (
            <li
              key={step.key}
              data-testid="routine-collection-step"
              data-step-key={step.key}
              className={`grid gap-4 border-l-4 p-4 transition-colors sm:grid-cols-[auto_minmax(0,1fr)] sm:p-5 ${
                complete ? "border-l-emerald-400 bg-emerald-500/[0.045]" : "border-l-transparent"
              }`}
            >
              <div className="flex items-center justify-between gap-3 sm:flex-col sm:justify-start">
                <span className="terminal-label text-xs font-semibold tabular-nums text-slate-500">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <StepControl
                  step={step}
                  value={completedCount}
                  pending={pending}
                  onChange={(nextValue) => void updateStep(step, nextValue)}
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-white">{step.seaArea}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {step.tasks.map((task) => (
                        <span key={task} className="rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-1 text-xs font-semibold text-sky-200">
                          {task}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm md:max-w-[48%] md:justify-end">
                    {step.airControl && <span className="text-amber-200">制空：{step.airControl}</span>}
                    {step.note && <span className="text-slate-300">{step.note}</span>}
                  </div>
                </div>

                {step.fleetText && (
                  <p className="terminal-label mt-4 inline-flex rounded-md border border-slate-600 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-200">
                    {step.fleetText}
                  </p>
                )}

                {step.images.length > 0 && (
                  <div className={`mt-4 grid gap-3 ${step.images.length > 1 ? "lg:grid-cols-2" : ""}`}>
                    {step.images.map((src, imageIndex) => {
                      const alt = `${step.seaArea} 阵容${step.images.length > 1 ? ` ${imageIndex + 1}` : ""}`;
                      return (
                        <button
                          key={src}
                          type="button"
                          onClick={() => setPreview({ src, alt })}
                          aria-label={`放大查看${alt}`}
                          className="group relative min-h-28 overflow-hidden rounded-md border border-slate-700 bg-slate-950 text-left transition-colors hover:border-sky-500/60 focus-visible:border-sky-400"
                        >
                          <Image
                            src={src}
                            alt={alt}
                            width={1400}
                            height={700}
                            sizes={step.images.length > 1 ? "(min-width: 1024px) 40vw, 90vw" : "90vw"}
                            unoptimized
                            className="h-auto max-h-[30rem] w-full object-contain"
                          />
                          <span className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-600/70 bg-slate-950/85 text-slate-200 opacity-100 shadow-lg sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
                            <Images className="h-4 w-4" aria-hidden="true" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <Dialog open={preview !== null} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent className="sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>{preview?.alt ?? "阵容图"}</DialogTitle>
            <DialogDescription>阵容与装备配置</DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="overflow-auto rounded-md border border-slate-700 bg-slate-950">
              <Image
                src={preview.src}
                alt={preview.alt}
                width={1400}
                height={700}
                unoptimized
                priority
                className="h-auto max-h-[70dvh] w-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogHeader>
          <AlertDialogTitle>重置合集进度？</AlertDialogTitle>
          <AlertDialogDescription>当前已完成的步骤和次数会全部清空。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={resetting}>取消</AlertDialogCancel>
          <AlertDialogAction variant="danger" disabled={resetting} onClick={() => void resetProgress()}>
            {resetting ? "重置中…" : "确认重置"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </div>
  );
}
