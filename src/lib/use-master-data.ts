"use client";

import { useEffect, useState } from "react";

import { MASTER_DATA_UPDATED_EVENT } from "@/lib/master-data-events";
import { emptyMasterData, type MasterData } from "@/lib/master-data";

let cachedMasterData: MasterData | null = null;
let pendingMasterData: Promise<MasterData> | null = null;

async function fetchMasterData(force = false) {
  const url = force ? `/api/master-data?ts=${Date.now()}` : "/api/master-data";
  const response = await fetch(url, { cache: force ? "no-store" : "default" });
  if (!response.ok) {
    throw new Error(`master data request failed: ${response.status}`);
  }
  return response.json() as Promise<MasterData>;
}

function loadMasterData(force = false) {
  if (!force && cachedMasterData) {
    return Promise.resolve(cachedMasterData);
  }
  if (!force && pendingMasterData) {
    return pendingMasterData;
  }
  pendingMasterData = fetchMasterData(force)
    .then((data) => {
      cachedMasterData = data;
      return data;
    })
    .finally(() => {
      pendingMasterData = null;
    });
  return pendingMasterData;
}

export function useMasterData() {
  const [masterData, setMasterData] = useState<MasterData>(cachedMasterData ?? emptyMasterData);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;

    async function refresh(force = false) {
      try {
        const data = await loadMasterData(force);
        if (active) {
          setMasterData(data);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err : new Error("master data request failed"));
        }
      }
    }

    const handleRuntimeUpdate = () => {
      cachedMasterData = null;
      refresh(true);
    };

    refresh();
    window.addEventListener(MASTER_DATA_UPDATED_EVENT, handleRuntimeUpdate);
    return () => {
      active = false;
      window.removeEventListener(MASTER_DATA_UPDATED_EVENT, handleRuntimeUpdate);
    };
  }, []);

  return {
    masterData,
    error,
    isRuntime: masterData.source === "runtime",
  };
}
