"use client";

import {
  Anchor,
  ClipboardList,
  Database,
  FileText,
  Home,
  LockKeyhole,
  LogOut,
  MoreHorizontal,
  Settings,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, type ComponentType, type MouseEvent, type ReactNode } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DirtyGuardProvider, useDirtyGuardNavigation } from "@/components/common/dirty-guard";
import { ToastRegion } from "@/components/ui/toast-region";
import { cn } from "@/lib/utils";

const navItems: Array<{
  href: string;
  label: string;
  code: string;
  icon: ComponentType<{ className?: string }>;
  carriesActivity?: boolean;
}> = [
  { href: "/home", label: "作战大厅", code: "OPS", icon: Home, carriesActivity: true },
  { href: "/dashboard", label: "舰籍数据", code: "DATA", icon: Database },
  { href: "/routine", label: "作业卡", code: "SORTIE", icon: ClipboardList, carriesActivity: true },
  { href: "/strategy", label: "攻略档案", code: "NOTES", icon: FileText, carriesActivity: true },
  { href: "/lock-plan", label: "锁船矩阵", code: "LOCK", icon: LockKeyhole, carriesActivity: true },
  { href: "/profile", label: "个人设置", code: "USER", icon: Settings },
];

function AppShellContent({
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
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const guardedNavigate = useDirtyGuardNavigation();

  function guardLink(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    guardedNavigate(href);
  }

  function navHref(href: string, carriesActivity?: boolean) {
    if (!activityId || !carriesActivity) return href;
    return `${href}?activityId=${encodeURIComponent(activityId)}`;
  }

  return (
    <div
      className="relative min-h-[100dvh] overflow-x-hidden bg-bg-base bg-scroll text-text-main md:bg-fixed"
      style={
        backgroundUrl
          ? {
              backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.78), rgba(2, 6, 23, 0.88)), url(${backgroundUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      <header className="sticky top-0 z-50 border-b border-border-base/80 bg-slate-950/92">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href={navHref("/home", true)} onClick={(event) => guardLink(event, navHref("/home", true))} className="flex min-w-0 shrink-0 items-center gap-3">
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
                  onClick={(event) => guardLink(event, navHref(item.href, item.carriesActivity))}
                  aria-current={isActive ? "page" : undefined}
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
              <Image src={avatarUrl} alt={userName} width={36} height={36} unoptimized className="h-9 w-9 rounded-md object-cover ring-1 ring-border-base" />
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

      </header>

      <main className={cn(
        "mx-auto min-h-[calc(100dvh-9rem)] w-full px-4 pb-28 pt-6 sm:px-6 sm:py-8 lg:pb-8",
        pathname.startsWith("/strategy") ? "max-w-[112rem]" : "max-w-7xl",
      )}>
        {children}
      </main>

      <footer className="hidden border-t border-border-base/60 bg-slate-950/70 py-4 text-center terminal-label text-[11px] text-slate-500 lg:block">
        KANCOLLE HUB / FLEET OPERATIONS CONSOLE
      </footer>

      <nav
        aria-label="移动端主导航"
        className="fixed inset-x-0 bottom-0 z-[70] grid grid-cols-5 border-t border-border-base bg-slate-950/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_rgba(0,0,0,0.3)] backdrop-blur lg:hidden"
      >
        {navItems.filter((item) => ["/home", "/dashboard", "/routine", "/lock-plan"].includes(item.href)).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={navHref(item.href, item.carriesActivity)}
              onClick={(event) => guardLink(event, navHref(item.href, item.carriesActivity))}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-medium",
                isActive ? "text-sky-200" : "text-slate-400",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMoreOpen(true)}
          aria-current={pathname === "/strategy" || pathname === "/profile" ? "page" : undefined}
          className={cn(
            "flex min-h-16 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-medium",
            pathname === "/strategy" || pathname === "/profile" ? "text-sky-200" : "text-slate-400",
          )}
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
          <span>更多</span>
        </button>
      </nav>

      <Dialog open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>更多功能</DialogTitle>
            <DialogDescription>进入攻略档案或个人设置。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {navItems.filter((item) => item.href === "/strategy" || item.href === "/profile").map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={navHref(item.href, item.carriesActivity)}
                  onClick={(event) => { setMobileMoreOpen(false); guardLink(event, navHref(item.href, item.carriesActivity)); }}
                  className="flex min-h-14 items-center gap-3 rounded-md border border-border-base bg-slate-950/35 px-4 text-sm font-medium text-slate-100 hover:border-primary/55"
                >
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AppShell(props: Parameters<typeof AppShellContent>[0]) {
  return <ToastRegion><DirtyGuardProvider><AppShellContent {...props} /></DirtyGuardProvider></ToastRegion>;
}
