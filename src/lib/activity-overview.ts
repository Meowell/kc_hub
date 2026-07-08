export type ActivityOverviewMap = {
  code: string;
  area: string;
  operation: string;
  phase?: string;
  tags?: string[];
  note?: string;
};

export type ActivityOverviewReward = {
  label: string;
  value: string;
  note?: string;
};

export type ActivityOverview = {
  title: string;
  subtitle?: string;
  status?: string;
  period?: string;
  scale?: string;
  frontOperation?: string;
  rearOperation?: string;
  maps: ActivityOverviewMap[];
  rewards: ActivityOverviewReward[];
  notes: string[];
  updatedAt?: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeMap(input: unknown): ActivityOverviewMap | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const code = cleanText(record.code);
  const area = cleanText(record.area);
  const operation = cleanText(record.operation);
  if (!code || !area || !operation) return null;

  return {
    code,
    area,
    operation,
    phase: cleanText(record.phase),
    tags: Array.isArray(record.tags)
      ? record.tags.map(cleanText).filter((value): value is string => !!value)
      : [],
    note: cleanText(record.note),
  };
}

function normalizeReward(input: unknown): ActivityOverviewReward | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const label = cleanText(record.label);
  const value = cleanText(record.value);
  if (!label || !value) return null;

  return {
    label,
    value,
    note: cleanText(record.note),
  };
}

export function normalizeActivityOverview(input: unknown, fallbackTitle: string): ActivityOverview {
  const record = input && typeof input === "object" ? input as Record<string, unknown> : {};
  return {
    title: cleanText(record.title) ?? fallbackTitle,
    subtitle: cleanText(record.subtitle),
    status: cleanText(record.status),
    period: cleanText(record.period),
    scale: cleanText(record.scale),
    frontOperation: cleanText(record.frontOperation),
    rearOperation: cleanText(record.rearOperation),
    maps: Array.isArray(record.maps) ? record.maps.map(normalizeMap).filter((value): value is ActivityOverviewMap => !!value) : [],
    rewards: Array.isArray(record.rewards) ? record.rewards.map(normalizeReward).filter((value): value is ActivityOverviewReward => !!value) : [],
    notes: Array.isArray(record.notes) ? record.notes.map(cleanText).filter((value): value is string => !!value) : [],
    updatedAt: cleanText(record.updatedAt),
  };
}
