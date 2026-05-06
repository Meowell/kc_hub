"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { GameModal } from "./game-modal";
import { DinoRunner } from "./dino-runner";
import { SurvivorGame } from "./survivor-game";
import { SpaceInvaders } from "./space-invaders";

type Leader = { name: string; score: number };
type GameType = "dino" | "survivor" | "invaders";

interface GameConfig {
  type: GameType;
  label: string;
  icon: string;
  desc: string;
  border: string;
}

const gameConfigs: GameConfig[] = [
  { type: "dino", label: "🚢 鼠輸送", icon: "💣", desc: "機雷を回避！鼠輸送作戦", border: "border-l-blue-500" },
  { type: "survivor", label: "⚓ 艦隊決戦", icon: "💥", desc: "WASD移動 酸素魚雷で深海棲艦を迎撃", border: "border-l-purple-500" },
  { type: "invaders", label: "🛩️ 対空射撃", icon: "🎯", desc: "← → 移動 対空砲火で敵機撃墜", border: "border-l-emerald-500" },
];

interface GameEntryCardProps {
  gameType: GameType;
  initialFood: number;
}

export function GameEntryCard({ gameType, initialFood }: GameEntryCardProps) {
  const config = gameConfigs.find((c) => c.type === gameType)!;
  const [top3, setTop3] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [food, setFood] = useState(initialFood);
  const [modalOpen, setModalOpen] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [refunded, setRefunded] = useState(false);
  const [newRecord, setNewRecord] = useState(false);

  // 加载排行榜
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/leaderboard?type=${gameType}`);
      if (res.ok) {
        const data = await res.json();
        setTop3(data.top3);
      }
    } catch {
      // ignore
    }
  }, [gameType]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // 开始游戏
  const handleStart = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/games/start", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "粮食不足");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setFood(data.food);
      setLoading(false);
      setScore(0);
      setGameOver(false);
      setRefunded(false);
      setNewRecord(false);
      setGameStarted(true);
      setModalOpen(true);
    } catch {
      setError("网络错误");
      setLoading(false);
    }
  };

  // 游戏结束 - 用 useCallback 保持引用稳定
  const handleGameOver = useCallback(async (finalScore: number) => {
    setScore(finalScore);
    setGameOver(true);
    setGameStarted(false);

    try {
      const res = await fetch("/api/games/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType, score: finalScore }),
      });
      if (res.ok) {
        const data = await res.json();
        setRefunded(data.refunded);
        setNewRecord(data.newRecord || false);
        setFood(data.food);
        setTop3(data.top3);
      }
    } catch {
      // ignore
    }
  }, [gameType]);

  // 用 ref 持有最新 handleGameOver，确保传给子组件的回调永不变化
  const onGameOverRef = useRef(handleGameOver);
  onGameOverRef.current = handleGameOver;
  const stableOnGameOver = useCallback((s: number) => {
    onGameOverRef.current(s);
  }, []);

  // 用 ref 持有最新计分回调
  const stableOnScoreUpdate = useCallback((s: number) => {
    setScore(s);
  }, []);

  const handleClose = () => {
    setModalOpen(false);
    setGameOver(false);
    setGameStarted(false);
    setScore(0);
  };

  const renderGame = () => {
    if (!gameStarted && !gameOver) return null;
    switch (gameType) {
      case "dino":
        return <DinoRunner onScoreUpdate={stableOnScoreUpdate} onGameOver={stableOnGameOver} />;
      case "survivor":
        return <SurvivorGame onScoreUpdate={stableOnScoreUpdate} onGameOver={stableOnGameOver} />;
      case "invaders":
        return <SpaceInvaders onScoreUpdate={stableOnScoreUpdate} onGameOver={stableOnGameOver} />;
    }
  };

  return (
    <>
      {/* 入口卡片 */}
      <div
        className={`rounded-xl border border-slate-700/50 bg-slate-800/70 backdrop-blur-sm p-5 shadow-lg shadow-black/10 border-l-4 ${config.border}`}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-400">{config.label}</p>
          <span className="text-2xl">{config.icon}</span>
        </div>

        {/* 排行榜 Top 3 */}
        <div className="mt-3 space-y-1 min-h-[60px]">
          {top3.length === 0 ? (
            <p className="text-xs text-slate-600">暂无记录</p>
          ) : (
            top3.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {["🥇", "🥈", "🥉"][i]} {r.name}
                </span>
                <span className="text-slate-500 tabular-nums font-mono">{r.score}s</span>
              </div>
            ))
          )}
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}

        <button
          onClick={handleStart}
          disabled={loading}
          className="mt-3 w-full py-2 rounded-lg bg-blue-600/80 text-white text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "..." : "🎮 开始 (🍙 -1)"}
        </button>

        <p className="mt-1.5 text-xs text-slate-600 text-center">{config.desc}</p>
      </div>

      {/* 游戏弹窗 */}
      <GameModal
        open={modalOpen}
        onClose={handleClose}
        title={config.label}
        score={score}
        gameOver={gameOver}
        top3={top3}
        refunded={refunded}
        newRecord={newRecord}
      >
        {renderGame()}
      </GameModal>
    </>
  );
}
