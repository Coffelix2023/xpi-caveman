/**
 * 内存 mode 态 + 持久化(PLAN v0.2 D3/D9)。
 * 会话内:pi.appendEntry("caveman-mode", { mode }),session_start 时 getBranch 倒序恢复。
 * 跨会话:~/.config/xpi-caveman/config.json(尊重 XDG_CONFIG_HOME),env XPI_CAVEMAN_DEFAULT_MODE 覆盖。
 * config 读写 fail-closed:坏 JSON / IO 错误按默认值,不抛错。
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { type CavemanMode, normalizeMode } from "./modes.js";

export const ENTRY_CUSTOM_TYPE = "caveman-mode";

export interface CavemanConfig {
  coexist: boolean;
  defaultMode: CavemanMode;
}

export const DEFAULT_CONFIG: CavemanConfig = {
  coexist: false,
  defaultMode: "off",
};

/** config.json 路径;XDG_CONFIG_HOME 优先,XDG=跨桌面目录规范。 */
export function configPath(env: NodeJS.ProcessEnv = process.env): string {
  const xdg = env.XDG_CONFIG_HOME?.trim();
  return join(xdg ? xdg : join(homedir(), ".config"), "xpi-caveman", "config.json");
}

/** 读跨会话配置;坏 JSON / IO 失败 → DEFAULT_CONFIG(fail-closed)。 */
export function readConfig(env: NodeJS.ProcessEnv = process.env): CavemanConfig {
  try {
    const raw = readFileSync(configPath(env), "utf8");
    const parsed = JSON.parse(raw) as {
      defaultMode?: unknown;
      coexist?: unknown;
    };
    const defaultMode =
      typeof parsed.defaultMode === "string"
        ? normalizeMode(parsed.defaultMode)
        : "off";
    return {
      defaultMode,
      coexist: parsed.coexist === true,
    };
  } catch {
    return {
      ...DEFAULT_CONFIG,
    };
  }
}

/** 写跨会话配置;失败静默(面板下一步 notify 如实提示由调用方处理)。 */
export function writeConfig(
  config: CavemanConfig,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  try {
    const path = configPath(env);
    mkdirSync(dirname(path), {
      recursive: true,
    });
    writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
}

/** 生效默认档:env XPI_CAVEMAN_DEFAULT_MODE > config.defaultMode > off。 */
export function effectiveDefaultMode(
  env: NodeJS.ProcessEnv = process.env,
  config = readConfig(env),
): CavemanMode {
  const fromEnv = normalizeMode(env.XPI_CAVEMAN_DEFAULT_MODE);
  if (fromEnv !== "off") return fromEnv;
  return config.defaultMode;
}

/** 从 session entries 倒序找最新 caveman-mode entry;无 entry 返回 null(调用方回退跨会话默认)。兼容 fx-cn。 */
export function restoreMode(
  entries: readonly {
    type: string;
    customType?: string;
    data?: unknown;
  }[],
): CavemanMode | null {
  for (const e of [
    ...entries,
  ].reverse()) {
    if (e.type === "custom" && e.customType === ENTRY_CUSTOM_TYPE) {
      const mode = (
        e.data as
          | {
              mode?: unknown;
            }
          | undefined
      )?.mode;
      if (typeof mode === "string") return normalizeMode(mode);
    }
  }
  return null;
}
