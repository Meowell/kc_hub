"use client";

import {
  Anchor,
  ClipboardList,
  Database,
  FileText,
  Home,
  LockKeyhole,
  LogOut,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils";

const navItems: Array<{
  href: string;
  label: string;
  code: string;
  icon: ComponentType<{ className?: string }>;
  carriesActivity?: boolean;
}> = [
  { href: "/home", label: "作战大厅", code: "OPS", icon: Home },
  { href: "/dashboard", label: "舰籍数据", code: "DATA", icon: Database },
  { href: "/routine", label: "作业卡", code: "SORTIE", icon: ClipboardList, carriesActivity: true },
  { href: "/strategy", label: "攻略档案", code: "NOTES", icon: FileText, carriesActivity: true },
  { href: "/lock-plan", label: "锁船矩阵", code: "LOCK", icon: LockKeyhole, carriesActivity: true },
  { href: "/profile", label: "个人设置", code: "USER", icon: Settings },
];

export function AppShell({
  children,
  userName,
  avatarUrl,
  backgroundUrl,
}: {
  children: ReactNode;
  userName: string;
  avatarUrl?: string;
  backgroundUrl?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activityId = searchParams.get("activityId");

  function navHref(href: string, carriesActivity?: boolean) {
    if (!activityId || !carriesActivity) return href;
    return `${href}?activityId=${encodeURIComponent(activityId)}`;
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-bg-base text-text-main"
      style={
        backgroundUrl
          ? {
              backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.78), rgba(2, 6, 23, 0.88)), url(${backgroundUrl})`,
              backgroundSize: "cover",
              backgroundAttachment: "fixed",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      <header className="sticky top-0 z-50 border-b border-border-base/80 bg-slate-950/92">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/home" className="flex min-w-0 shrink-0 items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md border border-primary/45 bg-primary/10 text-primary">
              <Anchor className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="terminal-label block text-[11px] font-semibold text-primary">KANCOLLE HUB</span>
              <span className="block truncate text-sm font-semibold text-white">舰队协作作战台</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={navHref(item.href, item.carriesActivity)}
                  className={cn(
                    "group flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "border-primary/50 bg-primary/12 text-sky-100"
                      : "border-transparent text-slate-400 hover:border-border-base hover:bg-slate-900 hover:text-slate-100",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  <span className="terminal-label text-[10px] text-slate-500 group-hover:text-slate-300">
                    {item.code}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="terminal-label text-[10px] font-semibold uppercase text-slate-500">ADMIRAL</p>
              <p className="max-w-28 truncate text-sm text-slate-200">{userName}</p>
            </div>
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="h-9 w-9 rounded-md object-cover ring-1 ring-border-base" />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-md border border-primary/35 bg-primary/10 text-sm font-bold text-primary">
                {userName.charAt(0).toUpperCase()}
              </span>
            )}
            <Link
              href="/logout"
              prefetch={false}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-slate-500 transition-colors hover:border-danger/45 hover:bg-danger/10 hover:text-red-200"
              aria-label="退出"
              title="退出"
            >
              <LogOut className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-border-base/55 px-3 py-2 lg:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={navHref(item.href, item.carriesActivity)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "border-primary/50 bg-primary/12 text-sky-100"
                    : "border-transparent text-slate-400",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto min-h-[calc(100vh-9rem)] w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-border-base/60 bg-slate-950/70 py-4 text-center terminal-label text-[11px] text-slate-600">
        KANCOLLE HUB / FLEET OPERATIONS CONSOLE
      </footer>
    </div>
  );
}
