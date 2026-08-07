export type RoutineCollectionStep = {
  key: string;
  seaArea: string;
  tasks: string[];
  requiredCount: number;
  images: string[];
  fleetText?: string;
  airControl?: string;
  note?: string;
};

export type RoutineCollection = {
  key: string;
  title: string;
  description: string;
  sourceUrl: string;
  steps: RoutineCollectionStep[];
};

const image = (index: number) =>
  `/routine-collections/seasonal-month/fleet-${String(index).padStart(2, "0")}.webp`;

export const SEASONAL_MONTH_COLLECTION: RoutineCollection = {
  key: "seasonal-month-v1",
  title: "季常月任务清理",
  description: "按解锁顺序清理季常月中的出击、演习与前置任务。",
  sourceUrl: "https://docs.qq.com/sheet/DTXBCTUtXb1RCSHJr?tab=BB08J2",
  steps: [
    { key: "01-3-1", seaArea: "3-1", tasks: ["Bd1出击", "Bq5北方戒备"], requiredCount: 1, images: [image(1)], airControl: "出门100+", note: "无" },
    { key: "02-3-2", seaArea: "3-2", tasks: ["Bd2出击", "Bq5北方戒备"], requiredCount: 1, images: [image(2)], airControl: "0", note: "高速+ / 尽量电碳" },
    { key: "03-exercise", seaArea: "演习", tasks: ["Cm1演习", "Cm2演习"], requiredCount: 1, images: [], note: "演习解锁后续月常" },
    { key: "04-3-3", seaArea: "3-3", tasks: ["Bw7北方", "Bq5北方戒备"], requiredCount: 1, images: [image(3)], note: "带个电碳" },
    { key: "05-3-5", seaArea: "3-5（EX）", tasks: ["Bd5补给", "Bw7北方"], requiredCount: 1, images: [], fleetText: "1CL + 5DD", airControl: "单水爆/战", note: "水司退避" },
    { key: "06-2-5", seaArea: "2-5", tasks: ["Bm1第五战队"], requiredCount: 1, images: [image(4)], airControl: "出门100+", note: "最矢青桶" },
    { key: "07-1-5", seaArea: "1-5（EX）", tasks: ["Bm5护卫强化", "Bq8泊地周边"], requiredCount: 1, images: [], fleetText: "1DD + 3DE" },
    { key: "08-7-1", seaArea: "7-1", tasks: ["Bq8泊地周边"], requiredCount: 1, images: [], fleetText: "1CL + 4DD" },
    { key: "09-7-2-p1", seaArea: "7-2-P1", tasks: ["Bq8泊地周边"], requiredCount: 1, images: [image(5)] },
    { key: "10-1-6", seaArea: "1-6", tasks: ["Bq3强行运输"], requiredCount: 2, images: [image(6)] },
    { key: "11-5-1", seaArea: "5-1", tasks: ["Bm4水打南方"], requiredCount: 1, images: [] },
    { key: "12-5-4", seaArea: "5-4", tasks: ["Bq6三一驱", "Bq7三川"], requiredCount: 1, images: [image(7)], airControl: "0" },
    { key: "13-5-4", seaArea: "5-4", tasks: ["Bq6三一驱", "Bq13六水战"], requiredCount: 1, images: [image(8)], airControl: "出门160+" },
    { key: "14-5-1", seaArea: "5-1", tasks: ["Bq7三川", "Bq13六水战"], requiredCount: 1, images: [image(9)], airControl: "126", note: "野崎出门，第二个点拉烟" },
    { key: "15-5-3", seaArea: "5-3", tasks: ["Bq7三川"], requiredCount: 1, images: [image(10)], airControl: "空丧", note: "野崎出门" },
    { key: "16-2-1", seaArea: "2-1", tasks: ["Bw2い号", "Bd5南西"], requiredCount: 1, images: [image(11)], airControl: "0" },
    { key: "17-6-4", seaArea: "6-4", tasks: ["Bq2Z前", "Bq13六水战"], requiredCount: 1, images: [image(12)], airControl: "出门130+", note: "陆航压C" },
    { key: "18-6-5", seaArea: "6-5", tasks: ["Bq13六水战"], requiredCount: 1, images: [image(13)], airControl: "出门180+" },
    { key: "19-6-3", seaArea: "6-3", tasks: ["Bq2Z前", "Bq4航空侦察"], requiredCount: 1, images: [image(14)], airControl: "0" },
    { key: "20-6-1", seaArea: "6-1", tasks: ["Bq2Z前", "Bm2潜水舰队"], requiredCount: 1, images: [image(15), image(16)], airControl: "索敌x4 > 25", note: "if野崎出门：126空优" },
    { key: "21-2-4", seaArea: "2-4", tasks: ["Bq2Z前"], requiredCount: 1, images: [image(17)], airControl: "出门180+" },
    { key: "22-1-2", seaArea: "1-2", tasks: ["Bm8兵站线确保"], requiredCount: 1, images: [image(18)], airControl: "0" },
    { key: "23-1-3", seaArea: "1-3", tasks: ["Bq9空母战力", "Bm8兵站线确保"], requiredCount: 1, images: [image(19)], airControl: "0" },
    { key: "24-1-4", seaArea: "1-4", tasks: ["Bm8兵站线确保"], requiredCount: 1, images: [image(20)], airControl: "出门70+" },
    { key: "25-2-1", seaArea: "2-1", tasks: ["Bq9空母战力", "Bm8兵站线确保"], requiredCount: 1, images: [image(21)], airControl: "出门180+" },
    { key: "26-2-1", seaArea: "2-1", tasks: ["Bq11海上警备"], requiredCount: 1, images: [image(21)], airControl: "出门180+" },
    { key: "27-1-4", seaArea: "1-4", tasks: ["Bq11海上警备"], requiredCount: 1, images: [image(20)], airControl: "出门70+" },
    { key: "28-2-2", seaArea: "2-2", tasks: ["Bq9空母战力", "Bq11海上警备"], requiredCount: 1, images: [image(22)], airControl: "出门90+" },
    { key: "29-2-3", seaArea: "2-3", tasks: ["Bq9空母战力", "Bq11海上警备"], requiredCount: 1, images: [image(23)], airControl: "出门180+" },
    { key: "30-4-1", seaArea: "4-1", tasks: ["Bq12西方海域"], requiredCount: 1, images: [image(24)], airControl: "出门80+" },
    { key: "31-4-2", seaArea: "4-2", tasks: ["Bm5空母西方", "Bq12西方海域"], requiredCount: 1, images: [image(25)], airControl: "出门180+" },
    { key: "32-4-3", seaArea: "4-3", tasks: ["Bq12西方海域"], requiredCount: 1, images: [image(26)], airControl: "出门180+", note: "带点对陆" },
    { key: "33-4-4", seaArea: "4-4", tasks: ["Bq12西方海域"], requiredCount: 1, images: [image(27)], airControl: "出门180+" },
    { key: "34-4-5", seaArea: "4-5（EX）", tasks: ["Bq12西方海域"], requiredCount: 1, images: [image(28)], airControl: "大于左图", note: "省时间/桶还是高速+" },
    { key: "35-7-2-p2", seaArea: "7-2-P2", tasks: ["Bq10Z后", "Bq8泊地周边"], requiredCount: 1, images: [] },
  ],
};

export const ROUTINE_COLLECTIONS = [SEASONAL_MONTH_COLLECTION] as const;

export function findRoutineCollection(collectionKey: string) {
  return ROUTINE_COLLECTIONS.find((collection) => collection.key === collectionKey);
}

export function findRoutineCollectionStep(collectionKey: string, stepKey: string) {
  return findRoutineCollection(collectionKey)?.steps.find((step) => step.key === stepKey);
}

export function clampRoutineProgress(completedCount: number, requiredCount: number) {
  if (!Number.isInteger(completedCount)) return 0;
  return Math.min(requiredCount, Math.max(0, completedCount));
}

export function summarizeRoutineProgress(
  collection: RoutineCollection,
  progress: Readonly<Record<string, number>>,
) {
  let completedSteps = 0;
  let completedCount = 0;
  let requiredCount = 0;

  for (const step of collection.steps) {
    const value = clampRoutineProgress(progress[step.key] ?? 0, step.requiredCount);
    completedCount += value;
    requiredCount += step.requiredCount;
    if (value === step.requiredCount) completedSteps += 1;
  }

  return {
    completedSteps,
    totalSteps: collection.steps.length,
    completedCount,
    requiredCount,
    percent: requiredCount === 0 ? 0 : Math.round((completedCount / requiredCount) * 100),
  };
}
