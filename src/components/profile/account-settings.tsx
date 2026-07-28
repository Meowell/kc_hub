"use client";

import { KeyRound, UserPen } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { AsyncButton, InlineStatus, type AsyncState } from "@/components/ui/async-status";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

async function readResponse(response: Response) {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? "保存失败，请稍后重试");
  return data;
}

export function AccountSettings({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [currentName, setCurrentName] = useState(initialName);
  const [newName, setNewName] = useState(initialName);
  const [renamePin, setRenamePin] = useState("");
  const [renameState, setRenameState] = useState<AsyncState>("idle");
  const [renameMessage, setRenameMessage] = useState("");

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinState, setPinState] = useState<AsyncState>("idle");
  const [pinMessage, setPinMessage] = useState("");

  async function renameAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRenameState("pending");
    setRenameMessage("正在验证并保存…");

    try {
      const response = await fetch("/api/auth/account/name", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newName, currentPin: renamePin }),
      });
      await readResponse(response);
      const savedName = newName.trim();
      setCurrentName(savedName);
      setNewName(savedName);
      setRenamePin("");
      setRenameState("success");
      setRenameMessage("用户名已更新");
      router.refresh();
    } catch (error) {
      setRenameState("error");
      setRenameMessage(error instanceof Error ? error.message : "用户名修改失败");
    }
  }

  async function changePin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPin !== confirmPin) {
      setPinState("error");
      setPinMessage("两次输入的新 PIN 不一致");
      return;
    }

    setPinState("pending");
    setPinMessage("正在验证并保存…");

    try {
      const response = await fetch("/api/auth/account/pin", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPin, newPin, confirmPin }),
      });
      await readResponse(response);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setPinState("success");
      setPinMessage("PIN 已更新，下次登录请使用新 PIN");
    } catch (error) {
      setPinState("error");
      setPinMessage(error instanceof Error ? error.message : "PIN 修改失败");
    }
  }

  const renameDisabled =
    !newName.trim() || newName.trim() === currentName || renamePin.length !== 4;
  const pinMismatch = confirmPin.length === 4 && newPin !== confirmPin;
  const pinUnchanged = newPin.length === 4 && currentPin === newPin;
  const pinDisabled =
    currentPin.length !== 4 ||
    newPin.length !== 4 ||
    confirmPin.length !== 4 ||
    newPin !== confirmPin ||
    currentPin === newPin;

  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="account-settings">
      <form
        className="surface-panel-subtle rounded-md border border-border-base/70 p-4"
        onSubmit={renameAccount}
      >
        <div className="mb-4 flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-primary/35 bg-primary/10 text-primary">
            <UserPen className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white">修改用户名</h3>
            <p className="mt-1 text-sm text-slate-400">修改后使用新用户名登录，现有数据不会变化。</p>
          </div>
        </div>

        <div className="space-y-4">
          <FormField
            id="account-new-name"
            label="新用户名"
            required
            help={
              newName.trim() === currentName
                ? "请输入不同于当前用户名的新名称"
                : `当前用户名：${currentName}`
            }
          >
            <Input
              autoComplete="username"
              maxLength={30}
              value={newName}
              onChange={(event) => {
                setNewName(event.target.value);
                if (renameState !== "pending") {
                  setRenameState("idle");
                  setRenameMessage("");
                }
              }}
            />
          </FormField>
          <FormField id="account-rename-pin" label="当前 PIN" required>
            <Input
              autoComplete="current-password"
              inputMode="numeric"
              maxLength={4}
              placeholder="4 位数字"
              type="password"
              value={renamePin}
              onChange={(event) => {
                setRenamePin(digitsOnly(event.target.value));
                if (renameState !== "pending") {
                  setRenameState("idle");
                  setRenameMessage("");
                }
              }}
            />
          </FormField>
          <div className="flex min-h-10 flex-wrap items-center gap-3">
            <AsyncButton
              type="submit"
              pending={renameState === "pending"}
              pendingLabel="修改中…"
              disabled={renameDisabled}
            >
              修改用户名
            </AsyncButton>
            <InlineStatus state={renameState}>{renameMessage}</InlineStatus>
          </div>
        </div>
      </form>

      <form
        className="surface-panel-subtle rounded-md border border-border-base/70 p-4"
        onSubmit={changePin}
      >
        <div className="mb-4 flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-primary/35 bg-primary/10 text-primary">
            <KeyRound className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white">修改 PIN</h3>
            <p className="mt-1 text-sm text-slate-400">验证当前 PIN 后，设置新的四位数字 PIN。</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="account-current-pin" label="当前 PIN" required className="sm:col-span-2">
            <Input
              autoComplete="current-password"
              inputMode="numeric"
              maxLength={4}
              placeholder="4 位数字"
              type="password"
              value={currentPin}
              onChange={(event) => {
                setCurrentPin(digitsOnly(event.target.value));
                if (pinState !== "pending") {
                  setPinState("idle");
                  setPinMessage("");
                }
              }}
            />
          </FormField>
          <FormField
            id="account-new-pin"
            label="新 PIN"
            required
            error={pinUnchanged ? "新 PIN 不能与当前 PIN 相同" : undefined}
          >
            <Input
              autoComplete="new-password"
              inputMode="numeric"
              maxLength={4}
              placeholder="4 位数字"
              type="password"
              value={newPin}
              onChange={(event) => {
                setNewPin(digitsOnly(event.target.value));
                if (pinState !== "pending") {
                  setPinState("idle");
                  setPinMessage("");
                }
              }}
            />
          </FormField>
          <FormField
            id="account-confirm-pin"
            label="确认新 PIN"
            required
            error={pinMismatch ? "两次输入的新 PIN 不一致" : undefined}
          >
            <Input
              autoComplete="new-password"
              inputMode="numeric"
              maxLength={4}
              placeholder="再次输入"
              type="password"
              value={confirmPin}
              onChange={(event) => {
                setConfirmPin(digitsOnly(event.target.value));
                if (pinState !== "pending") {
                  setPinState("idle");
                  setPinMessage("");
                }
              }}
            />
          </FormField>
        </div>
        <div className="mt-4 flex min-h-10 flex-wrap items-center gap-3">
          <AsyncButton
            type="submit"
            pending={pinState === "pending"}
            pendingLabel="修改中…"
            disabled={pinDisabled}
          >
            修改 PIN
          </AsyncButton>
          <InlineStatus state={pinState}>{pinMessage}</InlineStatus>
        </div>
      </form>
    </div>
  );
}
