"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/home", label: "主页", icon: "🏠" },
  { href: "/dashboard", label: "数据中心", icon: "📊" },
  { href: "/routine", label: "周回记录", icon: "📋" },
  { href: "/strategy", label: "攻略贴", icon: "📝" },
  { href: "/lock-plan", label: "锁船总览", icon: "🔒" },
];

function cx(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function AppShell({ children, userName, avatarUrl, backgroundUrl }: { children: React.ReactNode; userName: string; avatarUrl?: string; backgroundUrl?: string }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col" style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})`, backgroundSize: "cover", backgroundAttachment: "fixed", backgroundPosition: "center" } : undefined}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-700/50 bg-slate-900/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/home" className="flex items-center gap-2.5 shrink-0">
            <span className="text-2xl">⚓</span>
            <span className="text-lg font-bold tracking-tight text-white">KanColle Hub</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "relative flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all",
                    isActive
                      ? "bg-blue-500/15 text-blue-400"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60",
                  )}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-blue-400" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User area */}
          <div className="flex items-center gap-3 shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-600" />
            ) : (
              <span className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-400 ring-1 ring-blue-500/30">
                {userName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="hidden sm:inline text-sm text-slate-400">{userName}</span>
            <Link
              href="/logout"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              退出
            </Link>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden flex border-t border-slate-700/30 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "flex-shrink-0 flex items-center gap-1 px-4 py-2.5 text-xs font-medium border-b-2 transition-all",
                  isActive
                    ? "text-blue-400 border-blue-400"
                    : "text-slate-500 border-transparent",
                )}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-8">{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-600">
        KanColle Hub · 舰队Collection 亲友群协同工具
      </footer>
    </div>
  );
}
