"use client";

import { useEffect } from "react";

type Leader = { name: string; score: number };

interface GameModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
  score: number;
  gameOver: boolean;
  top3: Leader[];
  refunded: boolean;
  newRecord: boolean;
}

export function GameModal({
  open,
  onClose,
  children,
  title,
  score,
  gameOver,
  top3,
  refunded,
  newRecord,
}: GameModalProps) {
  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="relative rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            {title}
          </h2>
          <div className="flex items-center gap-3">
            {!gameOver && (
              <span className="text-sm text-slate-400 tabular-nums">
                ⏱ {score}s
              </span>
            )}
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-300 text-lg leading-none transition-colors"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 游戏区域 */}
        <div className="relative">{children}</div>

        {/* 结算面板 */}
        {gameOver && (
          <div className="absolute inset-0 bg-black/70 rounded-xl flex items-center justify-center">
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-bold text-white">游戏结束</h3>
              <p className="text-4xl font-bold text-amber-400 tabular-nums">
                {score}s
              </p>
              {newRecord && (
                <p className="text-base font-bold text-yellow-400 animate-pulse">
                  🏆 新記録達成！🍙 +10
                </p>
              )}
              {refunded && (
                <p className="text-sm text-emerald-400">堅持 60 秒！返還 🍙 +1</p>
              )}

              {/* 排行榜 */}
              {top3.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <p className="text-xs text-slate-500 mb-2">🏆 排行榜</p>
                  <div className="space-y-1">
                    {top3.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-6 text-sm"
                      >
                        <span className="text-slate-300">
                          {["🥇", "🥈", "🥉"][i]} {r.name}
                        </span>
                        <span className="text-slate-400 tabular-nums font-mono">
                          {r.score}s
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={onClose}
                className="mt-3 px-6 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
              >
                返回主页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
