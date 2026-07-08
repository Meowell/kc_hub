"use client";

import { BadgePercent, Pencil, Save, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";

import { BonusGroupDetails } from "@/components/lock-plan/bonus-group-details";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import {
  countNamedBonusShips,
  getBonusGroupsForTag,
  normalizeActivityBonusConfig,
  parseActivityBonusConfig,
  stringifyActivityBonusConfig,
  summarizeBonusMultipliers,
  type ActivityBonusConfig,
} from "@/lib/activity-bonus";

type BonusManagerTag = {
  id: string;
  name: string;
};

type BonusManagerProps = {
  activityId: string | null;
  tags: BonusManagerTag[];
  config: ActivityBonusConfig;
  canManage: boolean;
  getShipName: (shipId: number) => string;
  onConfigChange: (config: ActivityBonusConfig) => void;
};

function buildExampleConfig(tags: BonusManagerTag[]): ActivityBonusConfig {
  const tagName = tags[0]?.name ?? "第三十一戦隊";
  return {
    version: 1,
    groups: [
      {
        id: "e1-history",
        name: "E1 史实组",
        map: "E1",
        description: "示例：具名舰倍卡，命中后选船界面舰名标红。",
        shipIds: [566, 667, 706],
        shipTypeIds: [],
        points: [
          { code: "Z", label: "P1 Boss", multiplier: 1.07 },
          { code: "P", label: "道中点", multiplier: 1.03 },
        ],
      },
      {
        id: "e1-dd-common",
        name: "E1 DD 通用",
        map: "E1",
        description: "示例：舰种通用倍卡，只显示提示，不触发红名。",
        shipIds: [],
        shipTypeIds: [2],
        points: [{ code: "Z", label: "P1 Boss", multiplier: 1.02 }],
      },
    ],
    tagBindings: [
      {
        tagName,
        map: "E1",
        groupIds: ["e1-history", "e1-dd-common"],
      },
    ],
  };
}

export function BonusManager({
  activityId,
  tags,
  config,
  canManage,
  getShipName,
  onConfigChange,
}: BonusManagerProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(() => stringifyActivityBonusConfig(config));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const tagSummaries = useMemo(
    () =>
      tags.map((tag) => ({
        tag,
        groups: getBonusGroupsForTag(config, tag),
      })),
    [config, tags],
  );

  const boundTagCount = tagSummaries.filter((item) => item.groups.length > 0).length;
  const namedShipCount = countNamedBonusShips(config.groups);

  function openEditor() {
    setDraft(stringifyActivityBonusConfig(config));
    setError("");
    setEditorOpen(true);
  }

  function fillExample() {
    setDraft(stringifyActivityBonusConfig(buildExampleConfig(tags)));
    setError("");
  }

  async function saveConfig() {
    if (!activityId) return;
    setSaving(true);
    setError("");
    try {
      normalizeActivityBonusConfig(draft.trim() ? JSON.parse(draft) : {});
    } catch (err) {
      setSaving(false);
      setError(err instanceof SyntaxError ? "倍卡配置不是合法 JSON" : err instanceof Error ? err.message : "倍卡配置格式错误");
      return;
    }

    try {
      const res = await fetch("/api/activity-bonus", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ activityId, bonusData: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存倍卡配置失败");
      onConfigChange(parseActivityBonusConfig(data.bonusData));
      setEditorOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存倍卡配置失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Panel
        eyebrow="BONUS"
        title="活动倍卡"
        status={
          <StatusBadge variant={config.groups.length > 0 ? "success" : "warning"}>
            {config.groups.length > 0 ? "LOADED" : "EMPTY"}
          </StatusBadge>
        }
        actions={canManage ? (
          <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={openEditor}>
            <Pencil className="h-3.5 w-3.5" />
            导入/编辑
          </Button>
        ) : null}
        dense
      >
        <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)]">
          <div className="grid grid-cols-3 gap-2 lg:w-[360px]">
            <div className="border border-border-base bg-slate-950/30 px-3 py-2">
              <p className="terminal-label text-[10px] text-slate-500">GROUPS</p>
              <p className="text-lg font-semibold text-white">{config.groups.length}</p>
            </div>
            <div className="border border-border-base bg-slate-950/30 px-3 py-2">
              <p className="terminal-label text-[10px] text-slate-500">TAGS</p>
              <p className="text-lg font-semibold text-white">{boundTagCount}</p>
            </div>
            <div className="border border-border-base bg-slate-950/30 px-3 py-2">
              <p className="terminal-label text-[10px] text-slate-500">SHIPS</p>
              <p className="text-lg font-semibold text-white">{namedShipCount}</p>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap gap-2">
            {tagSummaries.filter((item) => item.groups.length > 0).length === 0 ? (
              <div className="flex min-h-14 items-center gap-2 border border-dashed border-border-base bg-slate-950/25 px-3 text-sm text-slate-500">
                <BadgePercent className="h-4 w-4" />
                当前活动尚未绑定贴条倍卡
              </div>
            ) : (
              tagSummaries
                .filter((item) => item.groups.length > 0)
                .map(({ tag, groups }) => (
                  <div key={tag.id} className="min-w-[180px] border border-border-base bg-slate-950/30 px-3 py-2">
                    <p className="truncate text-sm font-semibold text-slate-100">{tag.name}</p>
                    <p className="terminal-label mt-1 text-[10px] text-slate-500">
                      {groups.length} groups / {summarizeBonusMultipliers(groups)}
                    </p>
                  </div>
                ))
            )}
          </div>
        </div>
      </Panel>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>导入活动倍卡</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
            <div>
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                spellCheck={false}
                className="min-h-[420px] font-mono text-xs leading-relaxed"
              />
              {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
            </div>
            <div className="space-y-3">
              <div className="rounded-md border border-border-base bg-slate-950/30 p-3 text-xs text-slate-400">
                <p className="font-semibold text-slate-200">JSON 字段</p>
                <p className="mt-2">groups: 倍卡组，含 shipIds / shipTypeIds / points。</p>
                <p className="mt-1">tagBindings: 贴条绑定，可用 tagName 或 tagId。</p>
                <p className="mt-1">仅 shipTypeIds 命中的通用倍卡不会触发红名。</p>
              </div>
              <BonusGroupDetails groups={parseActivityBonusConfig(draft).groups.slice(0, 2)} getShipName={getShipName} emptyText="预览为空" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={fillExample}>
              <Wand2 className="h-4 w-4" />
              填入示例
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditorOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={saveConfig} disabled={saving || !canManage}>
              <Save className="h-4 w-4" />
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
