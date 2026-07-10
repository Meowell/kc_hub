export function getSafePage(requestedPage: number, totalCount: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalCount) / Math.max(1, pageSize)));
  const currentPage = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), totalPages);
  return { currentPage, totalPages };
}

export function filterRowsByLockTag<T extends { rowId: string }>(
  rows: T[],
  selectedTagId: string,
  assignmentsByTagId: Record<string, string[]>,
) {
  if (selectedTagId === "all") return rows;
  if (selectedTagId === "unassigned") {
    const allAssigned = new Set(Object.values(assignmentsByTagId).flat());
    return rows.filter((row) => !allAssigned.has(row.rowId));
  }
  const selected = new Set(assignmentsByTagId[selectedTagId] ?? []);
  return rows.filter((row) => selected.has(row.rowId));
}

export function shouldFlushLatestSnapshot(pending: string | null, saved: string | null, inFlight: boolean) {
  return !inFlight && !!pending && pending !== saved;
}
