import { describe, expect, it, vi } from "vitest";
import { FOOTER_STATUS_KEY, mountFooter, statusText } from "./footer.js";

describe("statusText", () => {
  it("激活态:● + 大写档位标签(D6 图腾款)", () => {
    expect(statusText("lite-zh", true)).toBe("● 🗿 caveman LITE-ZH");
    expect(statusText("full", true)).toBe("● 🗿 caveman FULL");
    expect(statusText("ultra", true)).toBe("● 🗿 caveman ULTRA");
  });

  it("空闲态:○ + idle", () => {
    expect(statusText("lite", false)).toBe("○ 🗿 caveman idle");
  });

  it("off 返回 undefined(整段隐藏)", () => {
    expect(statusText("off", true)).toBeUndefined();
    expect(statusText("off", false)).toBeUndefined();
  });
});

describe("mountFooter", () => {
  function tuiCtx() {
    const setStatus = vi.fn();
    return {
      ctx: {
        mode: "tui" as const,
        ui: {
          setStatus,
        },
      },
      setStatus,
    };
  }

  it("挂载即写入初始状态,refresh 重读 getter", () => {
    const { ctx, setStatus } = tuiCtx();
    let mode = "lite-zh" as Parameters<typeof statusText>[0];
    let active = true;
    const handle = mountFooter(ctx, {
      isActive: () => active,
      mode: () => mode,
    });
    expect(setStatus).toHaveBeenNthCalledWith(
      1,
      FOOTER_STATUS_KEY,
      "● 🗿 caveman LITE-ZH",
    );
    mode = "off";
    active = false;
    handle.refresh();
    expect(setStatus).toHaveBeenLastCalledWith(FOOTER_STATUS_KEY, undefined);
  });

  it("unmount 以 undefined 清除,调用键恒为 caveman", () => {
    const { ctx, setStatus } = tuiCtx();
    const handle = mountFooter(ctx, {
      isActive: () => true,
      mode: () => "full",
    });
    setStatus.mockClear();
    handle.unmount();
    expect(setStatus).toHaveBeenCalledWith(FOOTER_STATUS_KEY, undefined);
  });

  it("非 tui 模式 no-op", () => {
    const setStatus = vi.fn();
    const ctx = {
      mode: "rpc" as const,
      ui: {
        setStatus,
      },
    };
    const handle = mountFooter(ctx, {
      isActive: () => true,
      mode: () => "full",
    });
    handle.refresh();
    handle.unmount();
    expect(setStatus).not.toHaveBeenCalled();
  });
});
