"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface SurvivorProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
}

const CANVAS_W = 800;
const CANVAS_H = 600;

interface Enemy {
  x: number;
  y: number;
  hp: number;
}

interface ExpOrb {
  x: number;
  y: number;
}

interface Torpedo {
  x: number;
  y: number;
  vx: number;
  vy: number;
  traveled: number;
  maxDist: number;
  damage: number;
}

interface UpgradeOption {
  label: string;
  apply: () => void;
}

export function SurvivorGame({ onScoreUpdate, onGameOver }: SurvivorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    running: true,
    score: 0,
    playerX: CANVAS_W / 2,
    playerY: CANVAS_H / 2,
    playerRadius: 14,
    playerSpeed: 3,
    fireRate: 1.2,        // 每秒发射鱼雷数
    fireTimer: 0,
    torpedoDamage: 30,
    torpedoRange: 250,
    level: 1,
    exp: 0,
    expToNext: 30,
    enemies: [] as Enemy[],
    orbs: [] as ExpOrb[],
    torpedoes: [] as Torpedo[],
    enemySpawnTimer: 0,
    enemySpawnInterval: 1.5,
    enemySpeed: 1.0,
    enemyHp: 50,
    keys: { w: false, a: false, s: false, d: false },
  });

  const [upgrades, setUpgrades] = useState<UpgradeOption[]>([]);
  const [selecting, setSelecting] = useState(false);

  const generateUpgrades = useCallback((): UpgradeOption[] => {
    const s = stateRef.current;
    const options: UpgradeOption[] = [
      { label: "移动速度 +", apply: () => { s.playerSpeed = Math.min(6, s.playerSpeed + 0.5); } },
      { label: "射击速度 +", apply: () => { s.fireRate = Math.min(3.5, s.fireRate + 0.4); } },
      { label: "鱼雷火力 +", apply: () => { s.torpedoDamage += 20; } },
      { label: "鱼雷射程 +", apply: () => { s.torpedoRange = Math.min(400, s.torpedoRange + 50); } },
      { label: "清除敌舰", apply: () => { s.enemies = []; } },
    ];
    return options.sort(() => Math.random() - 0.5).slice(0, 3);
  }, []);

  const pickUpgrade = useCallback((idx: number) => {
    if (upgrades[idx]) { upgrades[idx].apply(); setUpgrades([]); setSelecting(false); }
  }, [upgrades]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const s = stateRef.current;
    let lastTime = 0;
    let scoreAcc = 0;
    let animId = 0;

    const spawnEnemy = () => {
      const side = Math.floor(Math.random() * 4);
      let x: number, y: number;
      switch (side) {
        case 0: x = Math.random() * CANVAS_W; y = -20; break;
        case 1: x = Math.random() * CANVAS_W; y = CANVAS_H + 20; break;
        case 2: x = -20; y = Math.random() * CANVAS_H; break;
        default: x = CANVAS_W + 20; y = Math.random() * CANVAS_H; break;
      }
      s.enemies.push({ x, y, hp: s.enemyHp });
    };

    const fireTorpedo = () => {
      if (s.enemies.length === 0) return;
      // 找最近敌人方向
      let bestIdx = 0, bestDist = Infinity;
      for (let i = 0; i < s.enemies.length; i++) {
        const d = Math.hypot(s.enemies[i].x - s.playerX, s.enemies[i].y - s.playerY);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      const target = s.enemies[bestIdx];
      const dx = target.x - s.playerX;
      const dy = target.y - s.playerY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const speed = 250; // 鱼雷速度

      s.torpedoes.push({
        x: s.playerX,
        y: s.playerY,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        traveled: 0,
        maxDist: s.torpedoRange,
        damage: s.torpedoDamage,
      });
    };

    const loop = (time: number) => {
      if (!s.running) return;
      const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0.016;
      lastTime = time;

      scoreAcc += dt;
      if (scoreAcc >= 1) { scoreAcc -= 1; s.score++; onScoreUpdate(s.score); }

      // 敌人刷新
      s.enemySpawnTimer += dt;
      s.enemySpawnInterval = Math.max(0.35, 1.5 - s.score * 0.012);
      if (s.enemySpawnTimer >= s.enemySpawnInterval) {
        s.enemySpawnTimer = 0;
        spawnEnemy();
        if (s.score > 20) spawnEnemy();
        if (s.score > 50) spawnEnemy();
      }

      s.enemySpeed = 0.9 + s.score * 0.015;
      s.enemyHp = 50 + s.score * 2;

      // 玩家移动
      let dx = 0, dy = 0;
      if (s.keys.w) dy -= 1; if (s.keys.s) dy += 1;
      if (s.keys.a) dx -= 1; if (s.keys.d) dx += 1;
      if (dx && dy) { dx *= 0.707; dy *= 0.707; }
      s.playerX = Math.max(s.playerRadius, Math.min(CANVAS_W - s.playerRadius, s.playerX + dx * s.playerSpeed));
      s.playerY = Math.max(s.playerRadius, Math.min(CANVAS_H - s.playerRadius, s.playerY + dy * s.playerSpeed));

      // 鱼雷发射
      s.fireTimer += dt * s.fireRate;
      while (s.fireTimer >= 1 && s.enemies.length > 0) {
        s.fireTimer -= 1;
        fireTorpedo();
      }

      // 鱼雷移动 & 穿透伤害
      for (let ti = s.torpedoes.length - 1; ti >= 0; ti--) {
        const torp = s.torpedoes[ti];
        torp.x += torp.vx * dt;
        torp.y += torp.vy * dt;
        torp.traveled += Math.sqrt(torp.vx * torp.vx + torp.vy * torp.vy) * dt;

        // 超出射程
        if (torp.traveled >= torp.maxDist) {
          s.torpedoes.splice(ti, 1);
          continue;
        }
        // 出界
        if (torp.x < -20 || torp.x > CANVAS_W + 20 || torp.y < -20 || torp.y > CANVAS_H + 20) {
          s.torpedoes.splice(ti, 1);
          continue;
        }

        // 穿透伤害所有碰到的敌人
        for (let ei = s.enemies.length - 1; ei >= 0; ei--) {
          const e = s.enemies[ei];
          if (Math.hypot(torp.x - e.x, torp.y - e.y) < 18) {
            e.hp -= torp.damage;
            if (e.hp <= 0) {
              if (Math.random() < 0.6) s.orbs.push({ x: e.x, y: e.y });
              s.enemies.splice(ei, 1);
            }
          }
        }
      }

      // 敌人移动 & 碰撞
      for (let i = s.enemies.length - 1; i >= 0; i--) {
        const e = s.enemies[i];
        const edx = s.playerX - e.x;
        const edy = s.playerY - e.y;
        const dist = Math.sqrt(edx * edx + edy * edy);
        if (dist > 1) { e.x += (edx / dist) * s.enemySpeed; e.y += (edy / dist) * s.enemySpeed; }
        if (dist < s.playerRadius + 12) { s.running = false; onGameOver(s.score); return; }
      }

      // 经验球收集
      for (let i = s.orbs.length - 1; i >= 0; i--) {
        const orb = s.orbs[i];
        const dist = Math.hypot(s.playerX - orb.x, s.playerY - orb.y);
        if (dist < 40) {
          s.orbs.splice(i, 1);
          s.exp += 10;
          if (s.exp >= s.expToNext) {
            s.level++;
            s.exp -= s.expToNext;
            s.expToNext = Math.floor(s.expToNext * 1.3);
            setUpgrades(generateUpgrades());
            setSelecting(true);
          }
        } else if (dist < 200) {
          const od = Math.sqrt((s.playerX - orb.x) ** 2 + (s.playerY - orb.y) ** 2);
          orb.x += ((s.playerX - orb.x) / od) * 3;
          orb.y += ((s.playerY - orb.y) / od) * 3;
        }
      }

      // ==== 绘制 ====
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#0b0b1a";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // 网格
      ctx.strokeStyle = "#161630";
      ctx.lineWidth = 0.5;
      for (let gx = 0; gx < CANVAS_W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, CANVAS_H); ctx.stroke(); }
      for (let gy = 0; gy < CANVAS_H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CANVAS_W, gy); ctx.stroke(); }

      // 鱼雷
      for (const torp of s.torpedoes) {
        const angle = Math.atan2(torp.vy, torp.vx);
        ctx.save();
        ctx.translate(torp.x, torp.y);
        ctx.rotate(angle);
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect(-7, -2, 12, 4);
        ctx.beginPath();
        ctx.moveTo(7, 0);
        ctx.lineTo(3, -4);
        ctx.lineTo(3, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 经验球
      ctx.fillStyle = "#67e8f9";
      for (const orb of s.orbs) {
        ctx.save();
        ctx.translate(orb.x, orb.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-5, -5, 10, 10);
        ctx.restore();
      }

      // 深海棲艦
      ctx.fillStyle = "#a855f7";
      for (const e of s.enemies) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e9d5ff";
        ctx.fillRect(e.x - 5, e.y - 2, 3, 3);
        ctx.fillRect(e.x + 2, e.y - 2, 3, 3);
        ctx.fillStyle = "#a855f7";
      }

      // 玩家
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.moveTo(s.playerX, s.playerY - 16);
      ctx.lineTo(s.playerX + 12, s.playerY + 12);
      ctx.lineTo(s.playerX - 12, s.playerY + 12);
      ctx.closePath();
      ctx.fill();

      // HUD
      ctx.fillStyle = "#fff";
      ctx.font = "bold 15px monospace";
      ctx.fillText(`时间 ${s.score}s`, 16, 28);
      ctx.fillText(`Lv.${s.level}`, 16, 50);
      ctx.font = "bold 11px monospace";
      ctx.fillText(`火力 ${s.torpedoDamage}`, 16, 68);

      // 经验条
      const barW = 150, barH = 7, barX = CANVAS_W - barW - 16, barY = 18;
      ctx.fillStyle = "#333"; ctx.fillRect(barX, barY, barW, barH);
      const pct = Math.min(1, s.exp / s.expToNext);
      ctx.fillStyle = "#6f6"; ctx.fillRect(barX, barY, barW * pct, barH);
      ctx.strokeStyle = "#555"; ctx.strokeRect(barX, barY, barW, barH);

      // 鱼雷射程指示
      ctx.strokeStyle = "rgba(100, 200, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.playerX, s.playerY, s.torpedoRange, 0, Math.PI * 2);
      ctx.stroke();

      animId = requestAnimationFrame(loop);
    };

    // 重置
    s.running = true;
    s.score = 0;
    s.playerX = CANVAS_W / 2;
    s.playerY = CANVAS_H / 2;
    s.playerSpeed = 3;
    s.fireRate = 1.2;
    s.fireTimer = 0;
    s.torpedoDamage = 30;
    s.torpedoRange = 250;
    s.level = 1;
    s.exp = 0;
    s.expToNext = 30;
    s.enemies = [];
    s.orbs = [];
    s.torpedoes = [];
    s.enemySpawnTimer = 0;
    s.enemySpawnInterval = 1.5;
    s.enemySpeed = 0.9;
    s.enemyHp = 50;
    s.keys = { w: false, a: false, s: false, d: false };
    lastTime = 0;
    scoreAcc = 0;
    setUpgrades([]);
    setSelecting(false);

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in s.keys) { e.preventDefault(); (s.keys as Record<string, boolean>)[k] = true; }
      if (["1", "2", "3"].includes(k)) {
        setUpgrades((prev) => {
          const idx = parseInt(k) - 1;
          if (prev[idx]) { prev[idx].apply(); setSelecting(false); return []; }
          return prev;
        });
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in s.keys) (s.keys as Record<string, boolean>)[k] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    animId = requestAnimationFrame(loop);

    return () => {
      s.running = false;
      cancelAnimationFrame(animId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [onScoreUpdate, onGameOver, generateUpgrades]);

  return (
    <div className="flex flex-col items-center relative">
      <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="rounded-lg" style={{ maxWidth: "100%", height: "auto" }} />
      <p className="mt-2 text-xs text-slate-500">WASD 移动 · 氧气鱼雷自动发射 · 收集晶体强化</p>
      {selecting && upgrades.length > 0 && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-3 z-10">
          {upgrades.map((u, i) => (
            <button key={i} onClick={() => pickUpgrade(i)}
              className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm hover:bg-slate-700 transition-colors shadow-lg">
              {u.label}<span className="ml-2 text-xs text-slate-500">[{i + 1}]</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
