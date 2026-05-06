import { Card } from "@/components/ui/card";
import { AvatarEditor } from "@/components/common/avatar-editor";
import { ImageUploader } from "@/components/common/image-uploader";
import { DailyCheckIn } from "@/components/common/daily-checkin";
import { requireCurrentUser } from "@/lib/auth";
import { GameEntryCard } from "@/components/games/game-entry-card";

export default async function HomePage() {
  const user = await requireCurrentUser();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span className="text-3xl">⚓</span> KanColle Hub
        </h1>
        <p className="mt-1.5 text-sm text-slate-400">
          只给几个人用的一站式工具吧大概
        </p>
      </div>

      <AvatarEditor initialAvatarUrl={user.avatarUrl} userName={user.name} />

      <ImageUploader
        label="页面背景"
        icon="🎨"
        initialUrl={user.backgroundUrl}
        apiEndpoint="/api/auth/background"
        fieldName="backgroundUrl"
        preview={user.backgroundUrl ? <img src={user.backgroundUrl} alt="bg" className="w-24 h-16 rounded-lg object-cover ring-1 ring-slate-600" /> : <span className="w-24 h-16 rounded-lg bg-slate-700/50 flex items-center justify-center text-xs text-slate-500">无背景</span>}
        reloadOnChange
      />

      <DailyCheckIn initialFood={user.food} />

      {/* 小游戏入口 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GameEntryCard gameType="dino" initialFood={user.food} />
        <GameEntryCard gameType="survivor" initialFood={user.food} />
        <GameEntryCard gameType="invaders" initialFood={user.food} />
      </div>
    </div>
  );
}
