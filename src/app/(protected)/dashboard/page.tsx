import { ShipDataCenter } from "@/components/ship-data/ship-data-center";
import { UpdateMastersButton } from "@/components/ship-data/update-masters-button";
import { requireCurrentUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireCurrentUser();

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="terminal-label text-xs font-semibold text-primary">DATA / FLEET REGISTRY</p>
          <h1 className="mt-2 text-xl font-bold text-white sm:text-2xl">舰籍数据</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            上传 noro6 舰船存档，解锁大部分功能。
          </p>
        </div>
        <UpdateMastersButton />
      </div>

      <ShipDataCenter
        initialShipData={user.shipData ?? ""}
        initialLastShipDataUpdatedAt={user.lastShipDataUpdatedAt?.toISOString() ?? null}
        currentUserName={user.name}
      />
    </div>
  );
}
