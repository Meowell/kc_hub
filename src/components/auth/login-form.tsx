"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, pinCode }),
    });

    const data = await response.json();
    setIsSubmitting(false);

    if (!response.ok) {
      setError(data.error ?? "登录失败");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Branding */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-4">⚓</div>
        <h1 className="text-2xl font-bold text-white tracking-tight">KanColle Hub</h1>
      </div>

      {/* Form card */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/70 backdrop-blur-sm p-6 shadow-xl shadow-black/20">
        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">用户名</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="提督名"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">PIN 码</label>
            <Input
              inputMode="numeric"
              maxLength={4}
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="4 位数字"
              type="password"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || !name.trim() || pinCode.length !== 4}
          >
            {isSubmitting ? "⏳ 登录中..." : "🚀 进入指挥室"}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        还没有账号？{" "}
        <Link href="/register" className="font-medium text-blue-400 hover:text-blue-300 transition-colors">
          注册新提督
        </Link>
      </p>
    </div>
  );
}
