import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  configPath,
  effectiveDefaultMode,
  readConfig,
  restoreMode,
  writeConfig,
} from "./state.js";

function tmpEnv(): {
  env: NodeJS.ProcessEnv;
  root: string;
} {
  const root = mkdtempSync(join(tmpdir(), "xpi-caveman-test-"));
  return {
    env: {
      XDG_CONFIG_HOME: root,
    },
    root,
  };
}

let cleanup: string | undefined;
afterEach(() => {
  if (cleanup) {
    rmSync(cleanup, {
      force: true,
      recursive: true,
    });
    cleanup = undefined;
  }
});

/** 绕过类型直接写磁盘 JSON(模拟旧版/外部/损坏数据),自动建目录。 */
function writeRaw(env: NodeJS.ProcessEnv, content: string): void {
  const path = configPath(env);
  mkdirSync(dirname(path), {
    recursive: true,
  });
  writeFileSync(path, content);
}

describe("configPath", () => {
  it("尊重 XDG_CONFIG_HOME,缺省回退 ~/.config", () => {
    expect(
      configPath({
        XDG_CONFIG_HOME: "/xdg",
      }),
    ).toBe("/xdg/xpi-caveman/config.json");
    expect(configPath({})).toContain(".config");
  });
});

describe("readConfig / writeConfig", () => {
  it("roundtrip:写入后读回一致", () => {
    const { env, root } = tmpEnv();
    cleanup = root;
    writeConfig(
      {
        coexist: true,
        defaultMode: "lite-zh",
      },
      env,
    );
    expect(readConfig(env)).toEqual({
      coexist: true,
      defaultMode: "lite-zh",
    });
  });

  it("坏 JSON 不抛错,fail-closed 回默认", () => {
    const { env, root } = tmpEnv();
    cleanup = root;
    writeRaw(env, "{not json");
    expect(readConfig(env)).toEqual({
      coexist: false,
      defaultMode: "off",
    });
  });

  it("config 目录是文件时读不抛错,回默认", () => {
    const { env, root } = tmpEnv();
    cleanup = root;
    writeFileSync(join(root, "xpi-caveman"), "");
    expect(readConfig(env)).toEqual({
      coexist: false,
      defaultMode: "off",
    });
  });

  it("文件不存在不抛错,回默认", () => {
    const { env, root } = tmpEnv();
    cleanup = root;
    expect(readConfig(env)).toEqual({
      coexist: false,
      defaultMode: "off",
    });
  });

  it("config 里 fx-cn 读入映射 lite-zh", () => {
    const { env, root } = tmpEnv();
    cleanup = root;
    writeRaw(
      env,
      JSON.stringify({
        coexist: false,
        defaultMode: "fx-cn",
      }),
    );
    expect(readConfig(env).defaultMode).toBe("lite-zh");
  });

  it("非法 defaultMode / coexist 值被归一化", () => {
    const { env, root } = tmpEnv();
    cleanup = root;
    writeRaw(
      env,
      JSON.stringify({
        coexist: "yes",
        defaultMode: "wenyan-ultra",
      }),
    );
    expect(readConfig(env)).toEqual({
      coexist: false,
      defaultMode: "off",
    });
  });
});

describe("effectiveDefaultMode", () => {
  it("env 覆盖 > config > off", () => {
    const { env, root } = tmpEnv();
    cleanup = root;
    expect(
      effectiveDefaultMode(env, {
        coexist: false,
        defaultMode: "full",
      }),
    ).toBe("full");
    expect(
      effectiveDefaultMode(
        {
          ...env,
          XPI_CAVEMAN_DEFAULT_MODE: "ultra",
        },
        {
          coexist: false,
          defaultMode: "full",
        },
      ),
    ).toBe("ultra");
    expect(
      effectiveDefaultMode(env, {
        coexist: false,
        defaultMode: "off",
      }),
    ).toBe("off");
  });
});

describe("restoreMode", () => {
  const entry = (mode: string, type = "custom", customType = "caveman-mode") => ({
    type,
    customType,
    data: {
      mode,
    },
  });

  it("倒序优先:取最新一条", () => {
    expect(
      restoreMode([
        entry("lite"),
        entry("full"),
        entry("ultra"),
      ]),
    ).toBe("ultra");
  });

  it("无 entry / 无关 entry 回 off", () => {
    expect(restoreMode([])).toBe("off");
    expect(
      restoreMode([
        {
          customType: "other-ext",
          type: "custom",
          data: {
            mode: "full",
          },
        },
      ]),
    ).toBe("off");
  });

  it("fx-cn 兼容映射 lite-zh", () => {
    expect(
      restoreMode([
        entry("fx-cn"),
      ]),
    ).toBe("lite-zh");
  });

  it("data 非法不抛错,跳过继续找", () => {
    expect(
      restoreMode([
        {
          customType: "caveman-mode",
          type: "custom",
          data: {
            mode: 42,
          },
        },
        entry("lite"),
      ]),
    ).toBe("lite");
    expect(
      restoreMode([
        {
          customType: "caveman-mode",
          type: "custom",
        },
      ]),
    ).toBe("off");
  });
});
