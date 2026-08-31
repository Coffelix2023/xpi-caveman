/**
 * /xpi-caveman 模式面板(ctx.ui.custom + SelectList)。
 * 激活档标签后加 *;焦点行 accent + 灰色注释;dim 横线不可选;上下循环。
 */
import { DynamicBorder, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text } from "@earendil-works/pi-tui";
import { type CavemanMode, MODE_LABELS, MODES } from "./modes.js";

export const PANEL_SEP = "__sep__";
export const PANEL_STATS = "stats";
export const PANEL_DEFAULT = "default";

export const MODE_HINTS = {
  full: "英文完全档，去冠词可片段",
  "full-zh": "中文完全档，去冗余连接词",
  lite: "英文基础档，去客套保留整句",
  "lite-zh": "中文轻压缩，去客套保留语法",
  off: "关闭压缩",
  ultra: "英文极限档，一行说完",
} as const satisfies Record<CavemanMode, string>;

export const ACTION_HINTS = {
  [PANEL_DEFAULT]: "写入新会话默认档",
  [PANEL_STATS]: "本会话真实 token 分桶",
} as const;

const SEP_LABEL = "─".repeat(16);
const SEP_INDEX = MODES.length;

function hintFor(value: string): string | undefined {
  if (value === PANEL_SEP) return undefined;
  if (value === PANEL_STATS || value === PANEL_DEFAULT) return ACTION_HINTS[value];
  if ((MODES as readonly string[]).includes(value))
    return MODE_HINTS[value as CavemanMode];
  return undefined;
}

function modeLabel(mode: CavemanMode, current: CavemanMode): string {
  return mode === current ? `${MODE_LABELS[mode]} *` : MODE_LABELS[mode];
}

/** 6 档 + 分隔 sentinel + 2 操作。仅 focused 带 description。 */
export function buildPanelItems(
  current: CavemanMode,
  focused: string = current,
): SelectItem[] {
  const modes: SelectItem[] = MODES.map((m) => ({
    label: modeLabel(m, current),
    value: m,
  }));
  const actions: SelectItem[] = [
    {
      label: SEP_LABEL,
      value: PANEL_SEP,
    },
    {
      label: "查看统计",
      value: PANEL_STATS,
    },
    {
      label: "设为跨会话默认档",
      value: PANEL_DEFAULT,
    },
  ];
  return applyFocusHint(
    [
      ...modes,
      ...actions,
    ],
    focused,
  );
}

/** 只给焦点行挂灰色注释;分隔线永不带 description。 */
export function applyFocusHint(items: SelectItem[], focused: string): SelectItem[] {
  for (const item of items) {
    item.description = item.value === focused ? hintFor(item.value) : undefined;
  }
  return items;
}

/**
 * SelectList 把分隔线当普通项。落在 sep 上时按来向再跳一格。
 * from < sep → 向下穿过;from > sep → 向上穿过。
 */
export function skipSeparator(
  from: number,
  landed: number,
  sepIndex: number = SEP_INDEX,
): number {
  if (landed !== sepIndex) return landed;
  return from < sepIndex ? sepIndex + 1 : sepIndex - 1;
}

export function initialFocusIndex(current: CavemanMode): number {
  const idx = MODES.indexOf(current);
  return idx >= 0 ? idx : 0;
}

type PanelUi = Pick<ExtensionContext["ui"], "custom" | "notify"> & {
  hasUI: boolean;
};

/** 打开面板;取消 / 无 UI 返回 undefined。值:档位 | stats | default。 */
export async function pickFromPanel(
  ui: PanelUi,
  current: CavemanMode,
): Promise<string | undefined> {
  if (!ui.hasUI) {
    ui.notify(
      "用法: /xpi-caveman <off|lite|full|ultra|lite-zh|full-zh|status|default <mode>>",
      "info",
    );
    return undefined;
  }

  return ui.custom<string | undefined>((tui, theme, _kb, done) => {
    const items = buildPanelItems(current);
    const sep = items.find((i) => i.value === PANEL_SEP);
    if (sep) sep.label = theme.fg("dim", SEP_LABEL);
    let lastIndex = initialFocusIndex(current);
    applyFocusHint(items, items[lastIndex]?.value ?? current);

    const container = new Container();
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
    container.addChild(new Text(theme.fg("accent", theme.bold("caveman mode")), 1, 0));

    let focusedHint = hintFor(items[lastIndex]?.value ?? current) ?? "";
    const selectList = new SelectList(items, items.length, {
      description: (t) => theme.fg("muted", t),
      noMatch: (t) => theme.fg("warning", t),
      scrollInfo: (t) => theme.fg("dim", t),
      selectedPrefix: (t) => theme.fg("accent", t),
      selectedText: (t) => {
        if (!focusedHint) return theme.fg("accent", t);
        const idx = t.lastIndexOf(focusedHint);
        if (idx < 0) return theme.fg("accent", t);
        return theme.fg("accent", t.slice(0, idx)) + theme.fg("muted", t.slice(idx));
      },
    });
    selectList.setSelectedIndex(lastIndex);
    selectList.onSelect = (item) => {
      if (item.value === PANEL_SEP) return;
      done(item.value);
    };
    selectList.onCancel = () => done(undefined);
    selectList.onSelectionChange = (item) => {
      applyFocusHint(items, item.value);
      focusedHint = hintFor(item.value) ?? "";
    };
    container.addChild(selectList);
    container.addChild(
      new Text(theme.fg("dim", "↑↓ 循环 · enter 选定 · esc 取消"), 1, 0),
    );
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

    return {
      handleInput: (data: string) => {
        selectList.handleInput(data);
        const landed = items.findIndex(
          (i) => i.value === selectList.getSelectedItem()?.value,
        );
        const next = skipSeparator(lastIndex, landed);
        if (next !== landed) {
          selectList.setSelectedIndex(next);
          const item = items[next];
          if (item) {
            applyFocusHint(items, item.value);
            focusedHint = hintFor(item.value) ?? "";
          }
        }
        lastIndex = next >= 0 ? next : lastIndex;
        tui.requestRender();
      },
      invalidate: () => container.invalidate(),
      render: (w: number) => container.render(w),
    };
  });
}
