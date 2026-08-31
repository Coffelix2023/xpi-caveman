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
  pickFromPanel,
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
describe("pickFromPanel TUI", () => {
  const UP = "\x1b[A";
  const DOWN = "\x1b[B";

  function paint(color: string, text: string): string {
    return `[${color}]${text}`;
  }

  function themeStub() {
    return {
      bold: (t: string) => t,
      fg: (color: string, text: string) => paint(color, text),
    };
  }

  async function openPanel() {
    let factory:
      | ((
          tui: {
            requestRender: () => void;
          },
          theme: ReturnType<typeof themeStub>,
          kb: undefined,
          done: (value: string | undefined) => void,
        ) => {
          handleInput: (data: string) => void;
          render: (w: number) => string[];
        })
      | undefined;
    const ui = {
      hasUI: true,
      custom: async (fn: typeof factory) => {
        factory = fn;
        return undefined;
      },
      notify: () => {},
    };
    const pending = pickFromPanel(ui as never, "full-zh");
    const tui = {
      requestRender: () => {},
    };
    if (!factory) throw new Error("custom factory not captured");
    const component = factory(tui, themeStub(), undefined, () => {});
    return {
      component,
      pending,
    };
  }

  function focusedLine(rendered: string, label: string): string | undefined {
    return rendered
      .split("\n")
      .find((l) => l.includes("[accent]→") && l.includes(label));
  }

  it("宽屏:激活 FULL-ZH *、焦点 accent、注释 muted、分隔线 dim", async () => {
    const { component } = await openPanel();
    const lines = component.render(80).join("\n");
    const focused = focusedLine(lines, "FULL-ZH *");
    expect(focused).toBeDefined();
    expect(focused).toContain(`[muted]${MODE_HINTS["full-zh"]}`);
    expect(focused).not.toContain(`[accent]${MODE_HINTS["full-zh"]}`);
    expect(lines).toContain(`[dim]${"─".repeat(16)}`);
  });

  it("FULL-ZH ↓ 跳过分隔线落到查看统计;↑ 回到 FULL-ZH", async () => {
    const { component } = await openPanel();
    component.handleInput(DOWN);
    let lines = component.render(80).join("\n");
    expect(focusedLine(lines, "查看统计")).toContain(
      `[muted]${ACTION_HINTS[PANEL_STATS]}`,
    );
    expect(lines).not.toContain(`[muted]${MODE_HINTS["full-zh"]}`);
    component.handleInput(UP);
    lines = component.render(80).join("\n");
    expect(focusedLine(lines, "FULL-ZH *")).toBeDefined();
  });

  it("OFF ↑ 循环到设为跨会话默认档;末项 ↓ 循环到 OFF", async () => {
    const { component } = await openPanel();
    for (let i = 0; i < 5; i++) component.handleInput(UP);
    let lines = component.render(80).join("\n");
    expect(focusedLine(lines, "OFF")).toBeDefined();
    component.handleInput(UP);
    lines = component.render(80).join("\n");
    expect(focusedLine(lines, "设为跨会话默认档")).toBeDefined();
    component.handleInput(DOWN);
    lines = component.render(80).join("\n");
    expect(focusedLine(lines, "OFF")).toBeDefined();
  });

  it("窄屏隐藏注释,标签与 * 仍在", async () => {
    const { component } = await openPanel();
    const lines = component.render(32).join("\n");
    expect(lines).toContain("FULL-ZH *");
    expect(lines).not.toContain(MODE_HINTS["full-zh"]);
  });
});
