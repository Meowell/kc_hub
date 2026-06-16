export const STRATEGY_DEFAULT_TEMPLATE = `## 路线

## 配装思路

## 基地航空队

## 支援舰队

## 注意事项

## 参考阵容
`;

export type RoutineCardSearchEntry = {
  seaArea: string;
  missionName: string;
  user: { name: string };
};

export function filterRoutineCardsForInsert<T extends RoutineCardSearchEntry>(cards: T[], query: string): T[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return cards;

  return cards.filter((card) => {
    return [card.seaArea, card.missionName, card.user.name].some((value) => value.toLowerCase().includes(keyword));
  });
}

export function createStrategyFormDefaults() {
  return {
    phaseName: "",
    title: "",
    content: STRATEGY_DEFAULT_TEMPLATE,
  };
}
