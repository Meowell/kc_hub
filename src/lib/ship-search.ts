// Search-only aliases generated from the playable ship names in START2.
// Original names remain indexed, so this table never changes display text.
const shipKanjiToSimplified: Readonly<Record<string, string>> = {
  "愛": "爱",
  "綾": "绫",
  "磯": "矶",
  "稲": "稻",
  "鵜": "鹈",
  "雲": "云",
  "沖": "冲",
  "賀": "贺",
  "樫": "㭴",
  "巻": "卷",
  "艦": "舰",
  "橋": "桥",
  "響": "响",
  "暁": "晓",
  "鯨": "鲸",
  "後": "后",
  "護": "护",
  "剛": "刚",
  "黒": "黑",
  "歳": "岁",
  "時": "时",
  "親": "亲",
  "進": "进",
  "勢": "势",
  "戦": "战",
  "叢": "丛",
  "倉": "仓",
  "蒼": "苍",
  "蔵": "藏",
  "対": "对",
  "鷹": "鹰",
  "択": "择",
  "張": "张",
  "長": "长",
  "鳥": "鸟",
  "鶴": "鹤",
  "電": "电",
  "島": "岛",
  "東": "东",
  "馬": "马",
  "飛": "飞",
  "浜": "滨",
  "風": "风",
  "補": "补",
  "穂": "穗",
  "峯": "峰",
  "鳳": "凤",
  "満": "满",
  "無": "无",
  "霧": "雾",
  "門": "门",
  "輸": "输",
  "葉": "叶",
  "陽": "阳",
  "嵐": "岚",
  "陸": "陆",
  "龍": "龙",
  "涼": "凉",
  "輪": "轮",
  "鈴": "铃",
  "漣": "涟",
  "呂": "吕",
  "朧": "胧",
  "驤": "骧",
};

export function toSimplifiedShipName(name: string): string {
  return Array.from(name, (character) => shipKanjiToSimplified[character] ?? character).join("");
}

export function normalizeShipSearchQuery(query: string): string {
  return query.normalize("NFKC").trim().toLowerCase();
}

export function buildShipSearchText({
  shipId,
  name,
  yomi,
}: {
  shipId: number;
  name: string;
  yomi?: string;
}): string {
  const values = [
    name,
    toSimplifiedShipName(name),
    yomi ?? "",
    String(shipId),
  ]
    .map(normalizeShipSearchQuery)
    .filter(Boolean);

  return [...new Set(values)].join("\n");
}

export function matchesShipSearchText(
  searchText: string,
  normalizedQuery: string,
): boolean {
  return !normalizedQuery || searchText.includes(normalizedQuery);
}
