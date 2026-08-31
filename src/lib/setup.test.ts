import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectLegacySkills } from "./detect.js";
import { runSetup } from "./setup.js";
import { configPath, readConfig } from "./state.js";

let root: string | undefined;
let env: NodeJS.ProcessEnv = {};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "xpi-caveman-setup-"));
  env = {
    XDG_CONFIG_HOME: root,
  };
});

afterEach(() => {
  if (root) {
    rmSync(root, {
      force: true,
      recursive: true,
    });
    root = undefined;
  }
});

function fakeHome(withAgents = false, withClaude = false): string {
  const home = mkdtempSync(join(tmpdir(), "xpi-caveman-home-"));
  if (withAgents)
    mkdirSync(join(home, ".agents/skills/caveman"), {
      recursive: true,
    });
  if (withClaude)
    mkdirSync(join(home, ".claude/skills/caveman"), {
      recursive: true,
    });
  return home;
}

describe("detectLegacySkills", () => {
  it("检测矩阵:两路径存在性", () => {
    expect(detectLegacySkills(fakeHome(false, false))).toEqual([]);
    expect(detectLegacySkills(fakeHome(true, false))).toHaveLength(1);
    expect(detectLegacySkills(fakeHome(false, true))).toHaveLength(1);
    expect(detectLegacySkills(fakeHome(true, true))).toHaveLength(2);
  });
});

describe("runSetup", () => {
  function mockCtx(hasUI = true, picked?: string) {
    const notifies: {
      message: string;
      type?: string;
    }[] = [];
    const select = vi.fn(async (): Promise<string | undefined> => picked);
    return {
      hasUI,
      ui: {
        notify: (message: string, type?: "info" | "warning" | "error") =>
          notifies.push({
            message,
            type,
          }),
        select,
      },
      notifies,
      select,
    };
  }

  it("未命中目录:不弹面板", async () => {
    const ctx = mockCtx();
    const result = await runSetup(ctx, env, fakeHome(false, false));
    expect(result).toEqual({
      coexist: false,
      prompted: false,
    });
    expect(ctx.select).not.toHaveBeenCalled();
  });

  it("命中目录 + 首次:弹面板;Esc 取消不持久化(下次再弹)", async () => {
    const home = fakeHome(true, false);
    const firstCtx = mockCtx();
    const first = await runSetup(firstCtx, env, home); // picked=undefined → Esc
    expect(first.prompted).toBe(false);
    expect(firstCtx.select).toHaveBeenCalledTimes(1);
    const secondCtx = mockCtx();
    expect(await runSetup(secondCtx, env, home)).toEqual({
      coexist: false,
      prompted: false,
    });
    expect(secondCtx.select).toHaveBeenCalledTimes(1);
  });

  it("选择接管:coexist=false + setupDone 持久化,不再重复弹", async () => {
    const home = fakeHome(true, false);
    const ctx = mockCtx(true, "本扩展接管(推荐)");
    expect(await runSetup(ctx, env, home)).toEqual({
      coexist: false,
      prompted: true,
    });
    expect(ctx.notifies.at(-1)?.message).toContain("mv");
    expect(readConfig(env).setupDone).toBe(true);
    const again = mockCtx();
    expect(await runSetup(again, env, home)).toEqual({
      coexist: false,
      prompted: false,
    });
    expect(again.select).not.toHaveBeenCalled();
  });

  it("选择共存:coexist=true 持久化,不重复弹", async () => {
    const home = fakeHome(false, true);
    expect(
      await runSetup(mockCtx(true, "共存让位(扩展不注入规则)"), env, home),
    ).toEqual({
      coexist: true,
      prompted: true,
    });
    expect(readConfig(env).setupDone).toBe(true);
    const again = mockCtx();
    expect(await runSetup(again, env, home)).toEqual({
      coexist: true,
      prompted: false,
    });
    expect(again.select).not.toHaveBeenCalled();
  });

  it("无 UI(hasUI=false):降级 notify 不弹面板,不持久化", async () => {
    const home = fakeHome(true, false);
    const ctx = mockCtx(false);
    expect(await runSetup(ctx, env, home)).toEqual({
      coexist: false,
      prompted: false,
    });
    expect(ctx.notifies.at(-1)?.type).toBe("warning");
    expect(ctx.select).not.toHaveBeenCalled();
  });

  it("config 预置 setupDone:true:命中目录也不弹", async () => {
    const home = fakeHome(true, false);
    mkdirSync(dirname(configPath(env)), {
      recursive: true,
    });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      configPath(env),
      JSON.stringify({
        coexist: false,
        defaultMode: "off",
        setupDone: true,
      }),
    );
    const ctx = mockCtx();
    expect(await runSetup(ctx, env, home)).toEqual({
      coexist: false,
      prompted: false,
    });
    expect(ctx.select).not.toHaveBeenCalled();
  });
});
