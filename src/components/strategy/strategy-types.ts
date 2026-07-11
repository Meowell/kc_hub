export type StrategyLockTag = {
  id: string;
  name: string;
  colorClass: string;
  isActive: boolean;
  sortOrder: number;
};

export type StrategyPostView = {
  id: string;
  userId: string;
  activityId: string | null;
  sectionId: string | null;
  phaseName: string;
  title: string;
  content: string;
  contentFormat: string;
  status: string;
  revision: number;
  plainText: string;
  publishedAt: string | null;
  isDeleted: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
};

export type StrategySectionView = {
  id: string;
  strategyMapId: string;
  name: string;
  sortOrder: number;
  isDeleted: boolean;
  postCount: number;
  lockTags: Array<{ sectionId: string; lockTagId: string; sortOrder: number; lockTag: StrategyLockTag }>;
  posts: StrategyPostView[];
};

export type StrategyMapView = {
  id: string;
  activityId: string;
  code: string;
  sortOrder: number;
  isOpenForPosts: boolean;
  isDeleted: boolean;
  sections: StrategySectionView[];
};

export type RoutineCardView = {
  id: string;
  seaArea: string;
  missionName: string;
  airControl: number;
  note: string | null;
  imageUrl: string | null;
  fleetData: string | null;
  updatedAt: string;
  user: { id: string; name: string };
};
