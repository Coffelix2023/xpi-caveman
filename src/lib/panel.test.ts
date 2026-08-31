import { describe, expect, it } from "vitest";
import { MODE_LABELS, MODES } from "./modes.js";
import {
  ACTION_HINTS,
  applyFocusHint,
  buildPanelItems,
  initialFocusIndex,
  MODE_HINTS,
  PANEL_DEFAULT,
  PANEL_SEP,
  PANEL_STATS,
  skipSeparator,
} from "./panel.js";

describe("buildPanelItems", () => {
  it("六档 + 分隔 + 两操作;激活档标签后加 *", () => {
    const items = buildPanelItems("full-zh");
    expect(items).toHaveLength(9);
    expect(items.slice(0, 6).map((i) => i.value)).toEqual([
      ...MODES,
    ]);
    expect(items[5]?.label).toBe(`${MODE_LABELS["full-zh"]} *`);
    expect(items[0]?.label).toBe("OFF");
    expect(items[6]?.value).toBe(PANEL_SEP);
    expect(items[7]?.value).toBe(PANEL_STATS);
    expect(items[8]?.value).toBe(PANEL_DEFAULT);
  });

  it("仅焦点行带中文注释;分隔线永不带", () => {
    const items = buildPanelItems("full-zh");
    expect(items[5]?.description).toBe(MODE_HINTS["full-zh"]);
    expect(items.filter((i) => i.description).map((i) => i.value)).toEqual([
      "full-zh",
    ]);
    expect(items[6]?.description).toBeUndefined();
    applyFocusHint(items, PANEL_STATS);
    expect(items[5]?.description).toBeUndefined();
    expect(items[7]?.description).toBe(ACTION_HINTS[PANEL_STATS]);
    applyFocusHint(items, PANEL_SEP);
    expect(items.every((i) => i.description === undefined)).toBe(true);
  });
});

describe("skipSeparator", () => {
  const sep = 6;
  it("向下穿过分隔线", () => {
    expect(skipSeparator(5, sep, sep)).toBe(7);
  });
  it("向上穿过分隔线", () => {
    expect(skipSeparator(7, sep, sep)).toBe(5);
  });
  it("未落在分隔线原样返回", () => {
    expect(skipSeparator(5, 5, sep)).toBe(5);
    expect(skipSeparator(8, 0, sep)).toBe(0);
  });
});

describe("initialFocusIndex", () => {
  it("打开时焦点落在当前档", () => {
    expect(initialFocusIndex("off")).toBe(0);
    expect(initialFocusIndex("full-zh")).toBe(5);
  });
});
