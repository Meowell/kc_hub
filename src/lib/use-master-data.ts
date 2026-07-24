"use client";

import { useEffect, useState } from "react";

import { MASTER_DATA_UPDATED_EVENT } from "@/lib/master-data-events";
import { emptyMasterData, type MasterData } from "@/lib/master-data";

let cachedMasterData: MasterData | null = null;
let pendingMasterData: Promise<MasterData> | null = null;

type MasterDataManifest = {
  version: string;
  url: string;
};

async function fetchMasterData(force = false) {
  const manifestUrl = force
    ? `/api/master-data/manifest?ts=${Date.now()}`
    : "/api/master-data/manifest";
  const manifestResponse = await fetch(manifestUrl, {
    cache: force ? "no-store" : "no-cache",
  });
  if (!manifestResponse.ok) {
    throw new Error(`master data manifest request failed: ${manifestResponse.status}`);
  }
  const manifest = await manifestResponse.json() as MasterDataManifest;
  if (!manifest.version || !manifest.url) {
    throw new Error("master data manifest is invalid");
  }

  const assetResponse = await fetch(manifest.url, { cache: "force-cache" });
  if (!assetResponse.ok) {
    throw new Error(`master data asset request failed: ${assetResponse.status}`);
  }
  return assetResponse.json() as Promise<MasterData>;
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
  const [isLoading, setIsLoading] = useState(!cachedMasterData);

  useEffect(() => {
    let active = true;

    async function refresh(force = false) {
      try {
        const data = await loadMasterData(force);
        if (active) {
          setMasterData(data);
          setError(null);
          setIsLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err : new Error("master data request failed"));
          setIsLoading(false);
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
    isLoading,
    isRuntime: masterData.source === "runtime",
  };
}
