import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configPath } from "./lib/state.js";

type Handler = (event: unknown, ctx: unknown) => Promise<unknown> | unknown;

/** 最小 mock pi:捕获 hooks 与命令 handler。 */
function mockPi() {
  const hooks = new Map<string, Handler>();
  const commands = new Map<
    string,
    {
      description?: string;
      handler: (args: string, ctx: unknown) => Promise<void>;
    }
  >();
  const entries: {
    customType: string;
    data: unknown;
  }[] = [];
  const api = {
    appendEntry: (customType: string, data: unknown) =>
      entries.push({
        customType,
        data,
      }),
    on: (event: string, handler: Handler) => hooks.set(event, handler),
    registerCommand: (
      name: string,
      options: {
        handler: (args: string, ctx: unknown) => Promise<void>;
      },
    ) => commands.set(name, options),
  };
  return {
    api,
    hooks,
    commands,
    entries,
  };
}

/** 最小 mock ctx:branch 可注入,notify/select/setStatus 够用即可。 */
type EntryLike = {
  type: string;
  customType?: string;
  data?: unknown;
};
function mockCtx(branch: EntryLike[] = []) {
  const notifies: {
    message: string;
    type?: string;
  }[] = [];
  return {
    hasUI: true,
    mode: "tui" as const,
    sessionManager: {
      getBranch: () => branch,
    },
    ui: {
      select: vi.fn(async () => undefined),
      setStatus: vi.fn(),
      notify: (message: string, type?: "info" | "warning" | "error") =>
        notifies.push({
          message,
          type,
        }),
    },
    notifies,
  };
}
async function load() {
  const mod = await import("./index.js");
  return mod.default;
}
describe("xpiCaveman wiring", () => {
  let pi: ReturnType<typeof mockPi>;
  let root: string | undefined;
  const prevXdg = process.env.XDG_CONFIG_HOME;
  beforeEach(async () => {
    // 隔离:config 读写指向临时目录,避免污染真实 ~/.config/xpi-caveman。
    root = mkdtempSync(join(tmpdir(), "xpi-caveman-index-"));
    process.env.XDG_CONFIG_HOME = root;
    // 预置 setupDone:runSetup 提前返回,测试不依赖真实机器是否装了旧 skill。
    mkdirSync(dirname(configPath()), {
      recursive: true,
    });
    writeFileSync(
      configPath(),
      JSON.stringify({
        coexist: false,
        defaultMode: "off",
        setupDone: true,
      }),
    );
    pi = mockPi();
    const register = await load();
    register(pi.api as never);
  });
  afterEach(() => {
    if (root)
      rmSync(root, {
        force: true,
        recursive: true,
      });
    root = undefined;
    if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = prevXdg;
  });
  function handler(name: string): Handler {
    const h = pi.hooks.get(name);
    expect(h, `hook ${name} registered`).toBeDefined();
    return h!;
  }

  it("before_agent_start: off 透传(返回 undefined)", async () => {
    const result = await handler("before_agent_start")(
      {
        systemPrompt: "BASE",
      },
      mockCtx(),
    );
    expect(result).toBeUndefined();
  });

  it("before_agent_start: 非 off 返回拼接 systemPrompt(D4 尾部追加)", async () => {
    await handler("session_start")(
      {
        type: "session_start",
      },
      mockCtx(),
    );
    const ctx = mockCtx();
    await handler("before_agent_start")(
      {
        systemPrompt: "BASE",
      },
      ctx,
    );
    // 默认 off,直接透传;设为 full 后再验
    await pi.commands.get("xpi-caveman")!.handler("full", ctx);
    const result = (await handler("before_agent_start")(
      {
        systemPrompt: "BASE",
      },
      ctx,
    )) as {
      systemPrompt: string;
    };
    expect(result.systemPrompt.startsWith("BASE\n\n")).toBe(true);
    expect(result.systemPrompt).toContain("level: full");
  });

  it("选档后 appendEntry 写入 caveman-mode", async () => {
    const ctx = mockCtx();
    await pi.commands.get("xpi-caveman")!.handler("lite-zh", ctx);
    expect(pi.entries).toEqual([
      {
        customType: "caveman-mode",
        data: {
          mode: "lite-zh",
        },
      },
    ]);
  });

  it("session_start: entry 恢复优先于 config 默认档(含显式 off)", async () => {
    // entry 显式 off
    const ctxOff = mockCtx([
      {
        customType: "caveman-mode",
        type: "custom",
        data: {
          mode: "off",
        },
      },
    ]);
    await handler("session_start")(
      {
        type: "session_start",
      },
      ctxOff,
    );
    await pi.commands.get("xpi-caveman")!.handler("status", ctxOff);
    expect(ctxOff.notifies.at(-1)?.message).toContain("mode=OFF");
    // entry lite-zh
    const ctxLite = mockCtx([
      {
        customType: "caveman-mode",
        type: "custom",
        data: {
          mode: "lite-zh",
        },
      },
    ]);
    await handler("session_start")(
      {
        type: "session_start",
      },
      ctxLite,
    );
    await pi.commands.get("xpi-caveman")!.handler("status", ctxLite);
    expect(ctxLite.notifies.at(-1)?.message).toContain("mode=LITE-ZH");
  });
  it("面板直设档位;status/default 子命令工作", async () => {
    const ctx = mockCtx();
    await pi.commands.get("xpi-caveman")!.handler("ultra", ctx);
    expect(pi.entries.at(-1)?.data).toEqual({
      mode: "ultra",
    });
    await pi.commands.get("xpi-caveman")!.handler("status", ctx);
    expect(ctx.notifies.at(-1)?.message).toContain("mode=ULTRA");
    await pi.commands.get("xpi-caveman")!.handler("default", ctx);
    expect(ctx.notifies.at(-1)?.type).toBe("warning");
    await pi.commands.get("xpi-caveman")!.handler("default lite-zh", ctx);
    expect(ctx.notifies.at(-1)?.message).toContain("默认档已保存: LITE-ZH");
    await pi.commands.get("xpi-caveman")!.handler("bogus", ctx);
    expect(ctx.notifies.at(-1)?.type).toBe("warning");
  });

  it("footer: agent_start/end 刷新 ●/○,tui 模式写 caveman 键", async () => {
    const ctx = mockCtx();
    await handler("session_start")(
      {
        type: "session_start",
      },
      ctx,
    ); // 挂灯 + 初始文本
    await pi.commands.get("xpi-caveman")!.handler("full", ctx);
    await handler("agent_start")({}, ctx);
    const calls = ctx.ui.setStatus.mock.calls.filter(([key]) => key === "caveman");
    expect(calls.at(-1)?.[1]).toContain("●");
    expect(calls.at(-1)?.[1]).toContain("FULL");
    await handler("agent_end")({}, ctx);
    expect(ctx.ui.setStatus.mock.calls.at(-1)?.[1]).toContain("○");
  });

  it("coexist: config coexist=true 时 before_agent_start 不注入(D8)", async () => {
    writeFileSync(
      configPath(),
      JSON.stringify({
        coexist: true,
        defaultMode: "off",
        setupDone: true,
      }),
    );
    const ctx = mockCtx();
    await handler("session_start")(
      {
        type: "session_start",
      },
      ctx,
    );
    await pi.commands.get("xpi-caveman")!.handler("full", ctx);
    const result = await handler("before_agent_start")(
      {
        systemPrompt: "BASE",
      },
      ctx,
    );
    expect(result).toBeUndefined();
  });

  it("coexist: 选档 notify 如实提示规则未注入", async () => {
    writeFileSync(
      configPath(),
      JSON.stringify({
        coexist: true,
        defaultMode: "off",
        setupDone: true,
      }),
    );
    const ctx = mockCtx();
    await handler("session_start")(
      {
        type: "session_start",
      },
      ctx,
    );
    await pi.commands.get("xpi-caveman")!.handler("full", ctx);
    expect(ctx.notifies.at(-1)?.message).toContain("共存模式");
  });
});
