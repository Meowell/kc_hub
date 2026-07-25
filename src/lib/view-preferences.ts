export function parseStoredIdList(raw: string | null): string[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    return parsed.filter((value): value is string => {
      if (typeof value !== "string" || value.length === 0 || seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  } catch {
    return [];
  }
}

export function parseStoredStringMap(raw: string | null): Record<string, string> {
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([key, value]) => key.length > 0 && typeof value === "string" && value.length > 0,
      ),
    );
  } catch {
    return {};
  }
}

export function mergeIdOrder(
  defaultIds: readonly string[],
  persistedIds: readonly string[],
): string[] {
  const availableIds = new Set(defaultIds);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of persistedIds) {
    if (!availableIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }

  for (const id of defaultIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }

  return result;
}

export function moveIdOntoTarget(
  order: readonly string[],
  movedId: string,
  targetId: string,
): string[] {
  const movedIndex = order.indexOf(movedId);
  const targetIndex = order.indexOf(targetId);
  if (movedIndex < 0 || targetIndex < 0 || movedIndex === targetIndex) {
    return [...order];
  }

  const next = [...order];
  const [moved] = next.splice(movedIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}
