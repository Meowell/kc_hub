"use client";

import { useEffect, useRef } from "react";

interface InvadersProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
}

const CANVAS_W = 520;
const CANVAS_H = 650;
const PLAYER_Y = CANVAS_H - 55;
const PLAYER_SPEED = 0.8;  // 1/5 原速
const SHOOT_COOLDOWN = 0.45;   // 火力削弱

interface Enemy {
  x: number;
  y: number;
  alive: boolean;
}

export function SpaceInvaders({ onScoreUpdate, onGameOver }: InvadersProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef({ left: false, right: false, space: false });

  const stateRef = useRef({
    running: true,
    score: 0,
    wave: 1,
    playerX: CANVAS_W / 2,
    enemies: [] as Enemy[],
    enemyDir: 1,
    enemySpeed: 0.5,          // 敌人速度削弱
    bullets: [] as { x: number; y: number; vy: number }[],
    shootCooldown: 0,
    enemyShootTimer: 1.8,
    cols: 8,
    rows: 3,
    stepDownAmount: 20,
  });

  const buildFormation = (s: typeof stateRef.current) => {
    s.enemies = [];
    const spacingX = 48;
    const spacingY = 38;
    const startX = (CANVAS_W - (s.cols - 1) * spacingX) / 2;
    const startY = 70;
    for (let r = 0; r < s.rows; r++) {
      for (let c = 0; c < s.cols; c++) {
        s.enemies.push({ x: startX + c * spacingX, y: startY + r * spacingY, alive: true });
      }
    }
    s.enemyDir = 1;
    s.enemySpeed = 0.5 + s.wave * 0.2;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const s = stateRef.current;
    let lastTime = 0;
    let scoreAcc = 0;
    let animId = 0;

    buildFormation(s);

    const loop = (time: number) => {
      if (!s.running) return;
      const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0.016;
      lastTime = time;

      // 分数
      scoreAcc += dt;
      if (scoreAcc >= 1) { scoreAcc -= 1; s.score++; onScoreUpdate(s.score); }

      // 长按移动
      if (keysRef.current.left) s.playerX -= PLAYER_SPEED;
      if (keysRef.current.right) s.playerX += PLAYER_SPEED;
      s.playerX = Math.max(20, Math.min(CANVAS_W - 20, s.playerX));

      s.shootCooldown = Math.max(0, s.shootCooldown - dt);

      // 长按连射
      if (keysRef.current.space && s.shootCooldown <= 0) {
        s.bullets.push(
          { x: s.playerX - 7, y: PLAYER_Y - 10, vy: -380 },
          { x: s.playerX + 7, y: PLAYER_Y - 10, vy: -380 },
        );
        s.shootCooldown = SHOOT_COOLDOWN;
      }

      // 活着的敌人
      const aliveEnemies = s.enemies.filter(e => e.alive);
      if (aliveEnemies.length === 0) {
        s.wave++;
        s.rows = Math.min(5, 3 + Math.floor((s.wave - 1) / 2));
        s.cols = Math.min(10, 8 + (s.wave > 3 ? 1 : 0));
        buildFormation(s);
      }

      // 阵型边界检测
      let minX = CANVAS_W, maxX = 0;
      for (const e of s.enemies) {
        if (!e.alive) continue;
        if (e.x < minX) minX = e.x;
        if (e.x > maxX) maxX = e.x;
      }

      let hitEdge = false;
      if (s.enemyDir > 0 && maxX >= CANVAS_W - 30) hitEdge = true;
      if (s.enemyDir < 0 && minX <= 30) hitEdge = true;

      const stepDownThisFrame = hitEdge;

      for (const e of s.enemies) {
        if (!e.alive) continue;
        e.x += s.enemyDir * s.enemySpeed;
        if (stepDownThisFrame) e.y += s.stepDownAmount;
      }

      if (hitEdge) {
        s.enemyDir *= -1;
        s.enemySpeed = Math.min(2.5, s.enemySpeed + 0.05);
      }

      // 敌人到达底部 → 游戏结束
      for (const e of s.enemies) {
        if (e.alive && e.y > PLAYER_Y - 30) {
          s.running = false;
          onGameOver(s.score);
          return;
        }
      }

      // 敌人射击（只有底排的射击）
      s.enemyShootTimer -= dt;
      if (s.enemyShootTimer <= 0 && aliveEnemies.length > 0) {
        const shooters = aliveEnemies.filter(e =>
          !aliveEnemies.find(o => Math.abs(o.x - e.x) < 24 && o.y > e.y)
        );
        if (shooters.length > 0) {
          const shooter = shooters[Math.floor(Math.random() * shooters.length)];
          s.bullets.push({ x: shooter.x, y: shooter.y + 18, vy: 160 });
        }
        s.enemyShootTimer = Math.max(0.5, 2.0 - s.wave * 0.15);
      }

      // 子弹移动
      for (let i = s.bullets.length - 1; i >= 0; i--) {
        s.bullets[i].y += s.bullets[i].vy * dt;
        if (s.bullets[i].y < -20 || s.bullets[i].y > CANVAS_H + 20) s.bullets.splice(i, 1);
      }

      // 玩家子弹击中敌人
      for (let bi = s.bullets.length - 1; bi >= 0; bi--) {
        const b = s.bullets[bi];
        if (b.vy > 0) continue;
        for (const e of s.enemies) {
          if (!e.alive) continue;
          if (b.y < e.y + 22 && b.y > e.y - 8 && b.x > e.x - 20 && b.x < e.x + 20) {
            e.alive = false;
            s.bullets.splice(bi, 1);
            break;
          }
        }
      }

      // 敌方子弹击中玩家
      for (let bi = s.bullets.length - 1; bi >= 0; bi--) {
        const b = s.bullets[bi];
        if (b.vy <= 0) continue;
        if (b.y > PLAYER_Y - 10 && b.y < PLAYER_Y + 10 && b.x > s.playerX - 16 && b.x < s.playerX + 16) {
          s.running = false;
          onGameOver(s.score);
          return;
        }
      }

      // ===== 绘制 =====
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // 夜空背景渐变
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      grad.addColorStop(0, "#0a0a2e");
      grad.addColorStop(0.7, "#0d1b3e");
      grad.addColorStop(1, "#162a4a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // 固定星星
      ctx.fillStyle = "#ffffff1a";
      for (let i = 0; i < 50; i++) {
        const sx = ((i * 137 + 42) % CANVAS_W);
        const sy = ((i * 73 + 42) % CANVAS_H);
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      // 🛩️ 敌机
      ctx.font = "22px serif";
      for (const e of s.enemies) {
        if (!e.alive) continue;
        ctx.fillText("🛩️", e.x - 13, e.y + 11);
      }

      // 子弹
      for (const b of s.bullets) {
        if (b.vy < 0) {
          // 対空砲火
          ctx.shadowColor = "#ff8";
          ctx.shadowBlur = 6;
          ctx.fillStyle = "#ffdd44";
          ctx.fillRect(b.x - 2, b.y - 6, 4, 13);
          ctx.shadowBlur = 0;
        } else {
          // 敵機の弾
          ctx.shadowColor = "#f44";
          ctx.shadowBlur = 4;
          ctx.fillStyle = "#ff4444";
          ctx.fillRect(b.x - 2, b.y - 3, 4, 8);
          ctx.shadowBlur = 0;
        }
      }

      // 🚢 艦娘（旋转朝上迎击）
      ctx.font = "28px serif";
      ctx.save();
      ctx.translate(s.playerX, PLAYER_Y);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("🚢", -14, 5);
      ctx.restore();

      // 底部線
      ctx.strokeStyle = "#335";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, PLAYER_Y - 15); ctx.lineTo(CANVAS_W, PLAYER_Y - 15); ctx.stroke();

      // HUD
      ctx.fillStyle = "#fff";
      ctx.font = "bold 15px monospace";
      ctx.fillText(`⏱ ${s.score}s`, 14, 26);
      ctx.font = "bold 12px monospace";
      ctx.fillText(`Wave ${s.wave}`, 14, 46);
      ctx.fillText(`🛩️ ${aliveEnemies.length}`, 14, 64);

      animId = requestAnimationFrame(loop);
    };

    // === 重置 ===
    s.running = true;
    s.score = 0;
    s.wave = 1;
    s.playerX = CANVAS_W / 2;
    s.bullets = [];
    s.shootCooldown = 0;
    s.enemyShootTimer = 1.8;
    s.rows = 3;
    s.cols = 8;
    s.enemyDir = 1;
    s.enemySpeed = 0.5;
    buildFormation(s);
    lastTime = 0;
    scoreAcc = 0;
    keysRef.current = { left: false, right: false, space: false };

    // === 输入：长按支持 ===
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        keysRef.current.left = true;
      }
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        keysRef.current.right = true;
      }
      if (e.code === "Space") {
        e.preventDefault();
        keysRef.current.space = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") keysRef.current.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") keysRef.current.right = false;
      if (e.code === "Space") keysRef.current.space = false;
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
  }, [onScoreUpdate, onGameOver]);

  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="rounded-lg" style={{ maxWidth: "100%", height: "auto" }} />
      <p className="mt-2 text-xs text-slate-500">← → 長押し移動 · 空格 対空砲火 · 🛩️ 敵機を撃墜！</p>
    </div>
  );
}
