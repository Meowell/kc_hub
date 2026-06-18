import { Gamepad2, Image as ImageIcon, UserRound } from "lucide-react";

import { AvatarEditor } from "@/components/common/avatar-editor";
import { DailyCheckIn } from "@/components/common/daily-checkin";
import { ImageUploader } from "@/components/common/image-uploader";
import { GameEntryCard } from "@/components/games/game-entry-card";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireCurrentUser } from "@/lib/auth";
import { getRoleLabel } from "@/lib/collaboration";

export default async function ProfilePage() {
  const user = await requireCurrentUser();

  return (
    <div className="space-y-6">
      <section>
        <p className="terminal-label text-xs font-semibold text-primary">ADMIRAL STATUS</p>
        <h1 className="mt-2 text-2xl font-bold text-white">个人设置</h1>
        <p className="mt-2 text-sm text-slate-400">
          管理头像、个人背景、签到粮食与附属小游戏。
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel
          eyebrow="PROFILE"
          title="提督资料"
          status={<StatusBadge variant="muted">{getRoleLabel(user.role)}</StatusBadge>}
          actions={<UserRound className="h-4 w-4 text-slate-500" />}
        >
          <div className="space-y-5">
            <AvatarEditor initialAvatarUrl={user.avatarUrl} userName={user.name} />
            <ImageUploader
              label="个人背景"
              icon={<ImageIcon className="h-4 w-4" />}
              initialUrl={user.backgroundUrl}
              apiEndpoint="/api/auth/background"
              fieldName="backgroundUrl"
              preview={
                user.backgroundUrl ? (
                  <img src={user.backgroundUrl} alt="bg" className="h-16 w-24 rounded-md object-cover ring-1 ring-border-base" />
                ) : (
                  <span className="flex h-16 w-24 items-center justify-center rounded-md border border-border-base bg-slate-900/60 text-xs text-slate-500">
                    无背景
                  </span>
                )
              }
              reloadOnChange
            />
          </div>
        </Panel>

        <Panel eyebrow="SUPPLY" title="战斗粮食" status={<StatusBadge variant="warning">FOOD</StatusBadge>}>
          <DailyCheckIn initialFood={user.food} />
        </Panel>
      </div>

      <Panel
        eyebrow="SIDE OPS"
        title="小游戏"
        status={<StatusBadge variant="muted">OPTIONAL</StatusBadge>}
        actions={<Gamepad2 className="h-4 w-4 text-slate-500" />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <GameEntryCard gameType="dino" initialFood={user.food} />
          <GameEntryCard gameType="survivor" initialFood={user.food} />
          <GameEntryCard gameType="invaders" initialFood={user.food} />
        </div>
      </Panel>
    </div>
  );
}
