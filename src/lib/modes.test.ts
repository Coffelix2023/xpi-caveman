import { describe, expect, it } from "vitest";
import { MODE_LABELS, MODES, normalizeMode } from "./modes.js";
import { loadCavemanRules } from "./rules.js";

describe("normalizeMode", () => {
  it("合法档位原样通过", () => {
    for (const m of MODES) {
      expect(normalizeMode(m)).toBe(m);
    }
  });

  it("大小写与空白不敏感", () => {
    expect(normalizeMode("LITE")).toBe("lite");
    expect(normalizeMode("  Full-Zh ")).toBe("full-zh");
  });

  it("fx-cn 旧名映射 lite-zh(D9)", () => {
    expect(normalizeMode("fx-cn")).toBe("lite-zh");
    expect(normalizeMode("FX-CN")).toBe("lite-zh");
  });

  it("未知值 fail-closed 回退 off", () => {
    expect(normalizeMode("wenyan-full")).toBe("off");
    expect(normalizeMode("unknown")).toBe("off");
    expect(normalizeMode("")).toBe("off");
    expect(normalizeMode(undefined)).toBe("off");
  });
});

describe("MODE_LABELS", () => {
  it("六档齐全且大写、无 · zh 后缀", () => {
    expect(MODE_LABELS["lite-zh"]).toBe("LITE-ZH");
    expect(MODE_LABELS["full-zh"]).toBe("FULL-ZH");
    for (const m of MODES) {
      expect(MODE_LABELS[m]).toBe(m.toUpperCase());
    }
  });
});

const HAS_LANG = /LANGUAGE|中文/;
describe("loadCavemanRules", () => {
  it("off 规则为空串", () => {
    expect(loadCavemanRules("off")).toBe("");
  });

  it("其余五档非空且含语言声明与档位头", () => {
    for (const m of [
      "lite",
      "full",
      "ultra",
      "lite-zh",
      "full-zh",
    ] as const) {
      const rules = loadCavemanRules(m);
      expect(rules.length).toBeGreaterThan(0);
      expect(rules).toContain(`level: ${m}`);
      expect(rules).toMatch(HAS_LANG);
    }
  });

  it("ultra 含禁造缩写与禁箭头条款(D1:禁造缩写/箭头)", () => {
    const rules = loadCavemanRules("ultra");
    expect(rules).toContain("never abbreviate");
    expect(rules).toContain("No causal arrows");
  });

  it("中文档含示例句与虚词保留说明(D2)", () => {
    expect(loadCavemanRules("lite-zh")).toContain("useMemo");
    expect(loadCavemanRules("full-zh")).toContain("不删承载语法角色的虚词");
  });
});
