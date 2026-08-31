/** 六档模式常量与归一化(PLAN v0.2 D1/D3/D9)。 */
export const MODES = [
  "off",
  "lite",
  "full",
  "ultra",
  "lite-zh",
  "full-zh",
] as const;

export type CavemanMode = (typeof MODES)[number];

/** 面板/footer 用大写标签(lite-zh → LITE-ZH,内含语言,无 · zh 后缀,D6)。 */
export const MODE_LABELS = {
  full: "FULL",
  "full-zh": "FULL-ZH",
  lite: "LITE",
  "lite-zh": "LITE-ZH",
  off: "OFF",
  ultra: "ULTRA",
} as const satisfies Record<CavemanMode, string>;

/**
 * 归一化任意输入到合法档位;非法值 fail-closed 回退 off(D3 默认档)。
 * 旧数据兼容:fx-cn → lite-zh(D9),大小写不敏感。
 */
export function normalizeMode(value: string | undefined): CavemanMode {
  const v = value?.trim().toLowerCase();
  if (v === "fx-cn") return "lite-zh";
  return MODES.find((m): m is CavemanMode => m === v) ?? "off";
}
