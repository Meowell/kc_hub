"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CheckInStatus {
  checkedIn: boolean;
  todayReward: number | null;
  totalFood: number;
}

export function DailyCheckIn({ initialFood }: { initialFood: number }) {
  const [status, setStatus] = useState<CheckInStatus>({
    checkedIn: false,
    todayReward: null,
    totalFood: initialFood,
  });
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/checkin/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    setError(null);
    try {
      const res = await fetch("/api/checkin", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setStatus({
          checkedIn: true,
          todayReward: data.reward,
          totalFood: data.totalFood,
        });
      } else {
        setError(data.error ?? "签到失败");
      }
    } catch {
      setError("网络错误");
    } finally {
      setCheckingIn(false);
    }
  };

  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;

  return (
    <Card className="border-l-4 border-l-amber-500">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400 flex items-center gap-1.5">
            <span className="text-lg">🍙</span> 战斗粮食
          </p>
          <p className="mt-2 text-3xl font-bold text-white tabular-nums">
            {loading ? "..." : status.totalFood}
          </p>
          {status.checkedIn && (
            <p className="mt-1 text-xs text-emerald-400">
              今日已签到 +{status.todayReward} 🍙
            </p>
          )}
        </div>

        <button
          onClick={handleCheckIn}
          disabled={status.checkedIn || checkingIn || loading}
          className={cn(
            "px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
            "shadow-lg active:scale-95",
            status.checkedIn || loading
              ? "bg-slate-700/50 text-slate-500 cursor-not-allowed"
              : "bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 hover:border-amber-400/50 hover:-translate-y-0.5",
          )}
        >
          {checkingIn ? (
            <span className="flex items-center gap-1.5">
              <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-amber-300 border-t-transparent rounded-full" />
              签到中
            </span>
          ) : status.checkedIn ? (
            "已签到"
          ) : (
            <span className="flex items-center gap-1.5">
              🍙 签到
              <span className="text-xs opacity-70">
                {isWeekend ? "5~6" : "2~3"}
              </span>
            </span>
          )}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-400">{error}</p>
      )}
    </Card>
  );
}
