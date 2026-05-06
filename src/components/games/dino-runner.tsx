"use client";

import { useEffect, useRef, useCallback } from "react";

interface DinoRunnerProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
}

const CANVAS_W = 800;
const CANVAS_H = 300;
const GROUND_Y = 240;

// Chrome Dino 物理（调高滞空时间）
const GRAVITY = 0.4;           // 适中重力
const JUMP_VELOCITY = -10;     // 起跳
const CUT_VELOCITY = -3;       // 松手砍速，触发提前下落
const MAX_FALL_SPEED = 8;
const DINO_W = 34;
const DINO_H = 38;
const DINO_X = 80;
const DINO_GROUND_Y = GROUND_Y - DINO_H; // 200

export function DinoRunner({ onScoreUpdate, onGameOver }: DinoRunnerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const jumpHeld = useRef(false); // 空格是否按住

  const stateRef = useRef({
    running: true,
    score: 0,
    dinoY: DINO_GROUND_Y,
    dinoVy: 0,
    grounded: true,
    obstacles: [] as { x: number; w: number; h: number }[],
    speed: 3,
    maxSpeed: 14,
    frameCount: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const s = stateRef.current;
    let lastTime = 0;
    let scoreAcc = 0;
    let animId = 0;
    const groundMarks: number[] = [];
    let groundOffset = 0;

    const spawnObstacle = () => {
      s.obstacles.push({
        x: CANVAS_W,
        w: 18 + Math.random() * 22,
        h: 30 + Math.random() * 18,
      });
    };

    const loop = (time: number) => {
      if (!s.running) return;
      const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0.016;
      lastTime = time;

      // === Chrome Dino 物理 ===
      // 变量跳跃：按住空格 = 完整高度，松开 = 提前下落
      if (!jumpHeld.current && s.dinoVy < CUT_VELOCITY) {
        // 松手且还在快速上升 → 砍速度触发提前下落
        s.dinoVy = CUT_VELOCITY;
      }

      s.dinoVy += GRAVITY;
      if (s.dinoVy > MAX_FALL_SPEED) s.dinoVy = MAX_FALL_SPEED;
      s.dinoY += s.dinoVy;

      if (s.dinoY >= DINO_GROUND_Y) {
        s.dinoY = DINO_GROUND_Y;
        s.dinoVy = 0;
        s.grounded = true;
      }

      // 障碍物移动 & 碰撞
      const dx = DINO_X;
      const dy = s.dinoY;
      for (const obs of s.obstacles) {
        obs.x -= s.speed;

        // AABB 碰撞（缩小4px容错）
        if (
          dx + 4 < obs.x + obs.w - 4 &&
          dx + DINO_W - 4 > obs.x + 4 &&
          dy + 4 < GROUND_Y - 4 &&
          dy + DINO_H - 4 > GROUND_Y - obs.h - 4
        ) {
          s.running = false;
          onGameOver(s.score);
          return;
        }
      }
      s.obstacles = s.obstacles.filter((o) => o.x > -60);

      // 生成障碍物（间隔随速度减小，但有保底）
      s.frameCount++;
      const spawnInterval = Math.max(70, 160 - s.speed * 4);
      if (s.frameCount % Math.floor(spawnInterval) === 0) {
        spawnObstacle();
      }

      // 平滑加速
      s.speed = Math.min(s.maxSpeed, 3 + s.score * 0.005);

      // 分数
      scoreAcc += dt;
      if (scoreAcc >= 1) {
        scoreAcc -= 1;
        s.score++;
        onScoreUpdate(s.score);
      }

      // 地面滚动
      groundOffset += s.speed;
      if (groundOffset > 30) { groundOffset -= 30; groundMarks.push(CANVAS_W); }
      for (let i = groundMarks.length - 1; i >= 0; i--) {
        groundMarks[i] -= s.speed;
        if (groundMarks[i] < -10) groundMarks.splice(i, 1);
      }

      // === 绘制 ===
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // 地面
      ctx.strokeStyle = "#4a4a6a";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(CANVAS_W, GROUND_Y); ctx.stroke();

      ctx.fillStyle = "#333355";
      for (const mx of groundMarks) ctx.fillRect(mx, GROUND_Y + 4, 3, 10);

      // 機雷 💣
      for (const obs of s.obstacles) {
        ctx.font = `${obs.h}px serif`;
        ctx.fillText("💣", obs.x, GROUND_Y);
      }

      // 玩家 🚢（翻转朝右跑）
      ctx.font = "34px serif";
      const shipAngle = s.grounded ? 0 : Math.min(0.3, Math.max(-0.15, s.dinoVy * 0.02));
      ctx.save();
      ctx.translate(DINO_X + 17, s.dinoY + 17);
      ctx.rotate(shipAngle);
      ctx.scale(-1, 1); // 🚢 默认朝左，水平翻转后朝右
      ctx.fillText("🚢", -17, 11);
      ctx.restore();

      // HUD
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px monospace";
      ctx.fillText(`${s.score}s`, CANVAS_W - 70, 36);

      ctx.font = "10px monospace";
      ctx.fillStyle = s.speed > 10 ? "#f66" : s.speed > 6 ? "#fa0" : "#6f6";
      ctx.fillText(`速度 ${((s.speed / 3) * 100).toFixed(0)}%`, CANVAS_W - 70, 52);

      animId = requestAnimationFrame(loop);
    };

    // === 初始化 ===
    s.obstacles = [];
    s.running = true;
    s.score = 0;
    s.dinoY = DINO_GROUND_Y;
    s.dinoVy = 0;
    s.grounded = true;
    s.speed = 3;
    s.frameCount = 0;
    jumpHeld.current = false;
    lastTime = 0;
    scoreAcc = 0;
    groundMarks.length = 0;

    // === 输入：支持长按大跳 / 短按小跳 ===
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        if (s.grounded && s.running) {
          s.dinoVy = JUMP_VELOCITY;
          s.grounded = false;
          jumpHeld.current = true;
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        jumpHeld.current = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // 点击/触摸也支持变量跳跃
    const onPointerDown = (e: Event) => {
      e.preventDefault();
      if (s.grounded && s.running) {
        s.dinoVy = JUMP_VELOCITY;
        s.grounded = false;
        jumpHeld.current = true;
      }
    };
    const onPointerUp = () => {
      jumpHeld.current = false;
    };
    canvas.addEventListener("mousedown", onPointerDown);
    canvas.addEventListener("mouseup", onPointerUp);
    canvas.addEventListener("touchstart", onPointerDown);
    canvas.addEventListener("touchend", onPointerUp);

    animId = requestAnimationFrame(loop);

    return () => {
      s.running = false;
      cancelAnimationFrame(animId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousedown", onPointerDown);
      canvas.removeEventListener("mouseup", onPointerUp);
      canvas.removeEventListener("touchstart", onPointerDown);
      canvas.removeEventListener("touchend", onPointerUp);
    };
  }, [onScoreUpdate, onGameOver]);

  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="rounded-lg cursor-pointer" style={{ maxWidth: "100%", height: "auto" }} />
      <p className="mt-2 text-xs text-slate-500">
        長押し大跳 · 軽触小跳 · 💣 機雷を回避！
      </p>
    </div>
  );
}
