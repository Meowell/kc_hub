import { z } from "zod";

export type ActivityBonusPoint = {
  code: string;
  label?: string;
  multiplier: number;
  note?: string;
};

export type ActivityBonusGroup = {
  id: string;
  name: string;
  map?: string;
  description?: string;
  shipIds: number[];
  shipTypeIds: number[];
  points: ActivityBonusPoint[];
};

export type ActivityBonusTagBinding = {
  tagId?: string;
  tagName?: string;
  map?: string;
  groupIds: string[];
};

export type ActivityBonusConfig = {
  version: 1;
  groups: ActivityBonusGroup[];
  tagBindings: ActivityBonusTagBinding[];
};

export type BonusTagLike = {
  id: string;
  name: string;
};

export type ShipBonusMatch = {
  groups: ActivityBonusGroup[];
  namedGroups: ActivityBonusGroup[];
  typeGroups: ActivityBonusGroup[];
  hasAnyBonus: boolean;
  hasNamedBonus: boolean;
  groupLabel: string;
  multiplierLabel: string;
};

const emptyActivityBonusConfig: ActivityBonusConfig = {
  version: 1,
  groups: [],
  tagBindings: [],
};

const optionalTextSchema = z.string().trim().max(500).optional().nullable();

function parseMultiplierInput(value: unknown) {
  if (typeof value !== "string") return value;

  const text = value.trim();
  if (!text) return value;

  const rangeLike = /[~～\-–—至到]/.test(text);
  const numbers = text.match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) ?? [];
  if (rangeLike && numbers.length >= 2) {
    return Number(((numbers[0] + numbers[1]) / 2).toFixed(6));
  }
  if (numbers.length === 1) return numbers[0];

  return value;
}

const bonusPointSchema = z.object({
  code: z.string().trim().min(1).max(30),
  label: optionalTextSchema,
  multiplier: z.preprocess(parseMultiplierInput, z.coerce.number().positive().max(99)),
  note: optionalTextSchema,
});

const bonusGroupSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  map: optionalTextSchema,
  description: optionalTextSchema,
  shipIds: z.array(z.coerce.number().int().positive()).optional().default([]),
  shipTypeIds: z.array(z.coerce.number().int().positive()).optional().default([]),
  points: z.array(bonusPointSchema).optional().default([]),
});

const bonusTagBindingSchema = z.object({
  tagId: optionalTextSchema,
  tagName: optionalTextSchema,
  map: optionalTextSchema,
  groupIds: z.array(z.string().trim().min(1).max(80)).optional().default([]),
});

const activityBonusConfigSchema = z.object({
  version: z.literal(1).optional().default(1),
  groups: z.array(bonusGroupSchema).optional().default([]),
  tagBindings: z.array(bonusTagBindingSchema).optional().default([]),
});

function cleanText(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return text || undefined;
}

function uniqueSorted(values: number[]) {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function formatZodError(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return "倍卡配置格式错误";
  const path = issue.path.length ? issue.path.join(".") : "root";
  return `倍卡配置格式错误：${path} ${issue.message}`;
}

export function normalizeActivityBonusConfig(input: unknown): ActivityBonusConfig {
  const parsed = activityBonusConfigSchema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }

  const seenGroupIds = new Set<string>();
  const groups: ActivityBonusGroup[] = parsed.data.groups.map((group) => {
    if (seenGroupIds.has(group.id)) {
      throw new Error(`倍卡组 id 重复：${group.id}`);
    }
    seenGroupIds.add(group.id);

    return {
      id: group.id,
      name: group.name,
      map: cleanText(group.map),
      description: cleanText(group.description),
      shipIds: uniqueSorted(group.shipIds),
      shipTypeIds: uniqueSorted(group.shipTypeIds),
      points: group.points.map((point) => ({
        code: point.code,
        label: cleanText(point.label),
        multiplier: point.multiplier,
        note: cleanText(point.note),
      })),
    };
  });

  const tagBindings: ActivityBonusTagBinding[] = parsed.data.tagBindings
    .map((binding) => ({
      tagId: cleanText(binding.tagId),
      tagName: cleanText(binding.tagName),
      map: cleanText(binding.map),
      groupIds: uniqueStrings(binding.groupIds),
    }))
    .filter((binding) => binding.tagId || binding.tagName);

  return {
    version: 1,
    groups,
    tagBindings,
  };
}

export function parseActivityBonusConfig(value?: string | null): ActivityBonusConfig {
  if (!value?.trim()) return emptyActivityBonusConfig;
  try {
    return normalizeActivityBonusConfig(JSON.parse(value));
  } catch {
    return emptyActivityBonusConfig;
  }
}

export function stringifyActivityBonusConfig(config: ActivityBonusConfig) {
  return JSON.stringify(normalizeActivityBonusConfig(config), null, 2);
}

function bindingMatchesTag(binding: ActivityBonusTagBinding, tag: BonusTagLike) {
  return binding.tagId === tag.id || binding.tagName === tag.name;
}

export function getBonusGroupsForTag(
  config: ActivityBonusConfig,
  tag: BonusTagLike,
): ActivityBonusGroup[] {
  const groupsById = new Map(config.groups.map((group) => [group.id, group]));
  const groupsByMap = new Map<string, ActivityBonusGroup[]>();
  for (const group of config.groups) {
    if (!group.map) continue;
    const list = groupsByMap.get(group.map) ?? [];
    list.push(group);
    groupsByMap.set(group.map, list);
  }

  const selected: ActivityBonusGroup[] = [];
  const seen = new Set<string>();

  for (const binding of config.tagBindings) {
    if (!bindingMatchesTag(binding, tag)) continue;

    for (const groupId of binding.groupIds) {
      const group = groupsById.get(groupId);
      if (!group || seen.has(group.id)) continue;
      selected.push(group);
      seen.add(group.id);
    }

    if (binding.map) {
      for (const group of groupsByMap.get(binding.map) ?? []) {
        if (seen.has(group.id)) continue;
        selected.push(group);
        seen.add(group.id);
      }
    }
  }

  return selected;
}

export function formatMultiplier(multiplier: number) {
  const fixed = multiplier.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return `x${fixed}`;
}

export function summarizeBonusMultipliers(groups: ActivityBonusGroup[]) {
  const values = uniqueSorted(groups.flatMap((group) => group.points.map((point) => point.multiplier)));
  if (values.length === 0) return "未填倍率";
  if (values.length <= 2) return values.map(formatMultiplier).join("/");
  return "多倍率";
}

export function summarizeBonusGroupNames(groups: ActivityBonusGroup[]) {
  if (groups.length === 0) return "无倍卡";
  if (groups.length === 1) return groups[0].name;
  return `${groups.length}组`;
}

function shipMatchesGroup(group: ActivityBonusGroup, shipId: number, originalShipId?: number | null) {
  return group.shipIds.includes(shipId) || (!!originalShipId && group.shipIds.includes(originalShipId));
}

export function getShipBonusMatch(
  groups: ActivityBonusGroup[],
  shipId: number,
  shipTypeId?: number | null,
  originalShipId?: number | null,
): ShipBonusMatch {
  const matchedGroups: ActivityBonusGroup[] = [];
  const namedGroups: ActivityBonusGroup[] = [];
  const typeGroups: ActivityBonusGroup[] = [];

  for (const group of groups) {
    const namedMatch = shipMatchesGroup(group, shipId, originalShipId);
    const typeMatch = !!shipTypeId && group.shipTypeIds.includes(shipTypeId);

    if (!namedMatch && !typeMatch) continue;
    matchedGroups.push(group);
    if (namedMatch) namedGroups.push(group);
    if (!namedMatch && typeMatch) typeGroups.push(group);
  }

  return {
    groups: matchedGroups,
    namedGroups,
    typeGroups,
    hasAnyBonus: matchedGroups.length > 0,
    hasNamedBonus: namedGroups.length > 0,
    groupLabel: summarizeBonusGroupNames(matchedGroups),
    multiplierLabel: summarizeBonusMultipliers(matchedGroups),
  };
}

export function countNamedBonusShips(groups: ActivityBonusGroup[]) {
  return uniqueSorted(groups.flatMap((group) => group.shipIds)).length;
}
