import start2Fallback from "@/data/START2.json";
import shipHpFallback from "@/data/shipHp.json";
import type { MasterData, ShipHpEntry, Start2Data } from "@/lib/master-data";

export const fallbackMasterData: MasterData = {
  start2: start2Fallback as Start2Data,
  shipHp: shipHpFallback as ShipHpEntry[],
  source: "fallback",
  runtimeFiles: {
    start2: false,
    shipHp: false,
  },
};
