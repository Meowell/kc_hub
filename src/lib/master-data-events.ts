"use client";

export const MASTER_DATA_UPDATED_EVENT = "kc-master-data-updated";

export function notifyMasterDataUpdated() {
  window.dispatchEvent(new Event(MASTER_DATA_UPDATED_EVENT));
}
