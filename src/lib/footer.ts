/**
 * Footer 状态芯片(PLAN v0.2 D6,图腾款)。
 * 用 ctx.ui.setStatus("caveman", text) 多键共存,禁 setFooter(单槽覆盖,会顶掉 pi-open-tui)。
 * 激活 `● 🗿 caveman LITE-ZH`;空闲 `○ 🗿 caveman idle`;mode=off 整段隐藏。
 * 非 TUI 模式(print/json/rpc)no-op。
 */
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type CavemanMode, MODE_LABELS } from "./modes.js";

export const FOOTER_STATUS_KEY = "caveman";

/** 状态文本:off 返回 undefined(setStatus(key, undefined) 清除整段)。 */
export function statusText(mode: CavemanMode, isActive: boolean): string | undefined {
  if (mode === "off") return undefined;
  return `${isActive ? "●" : "○"} 🗿 caveman ${isActive ? MODE_LABELS[mode] : "idle"}`;
}

export interface FooterHandle {
  /** 档位/激活态变化后重算状态文本。 */
  refresh(): void;
  /** 清除状态文本(session 重挂时先调)。 */
  unmount(): void;
}

/** 上报 caveman 状态芯片;state 用 getter 形式,refresh() 时重读。 */
/** mountFooter 实际依赖的最小上下文面(真实 ExtensionContext 结构兼容)。 */
export type FooterCtx = {
  mode: ExtensionContext["mode"];
  ui: {
    setStatus: (key: string, text: string | undefined) => void;
  };
};

export function mountFooter(
  ctx: FooterCtx,
  state: {
    mode: () => CavemanMode;
    isActive: () => boolean;
  },
): FooterHandle {
  if (ctx.mode !== "tui") {
    return {
      refresh() {},
      unmount() {},
    };
  }
  const refresh = (): void => {
    ctx.ui.setStatus(FOOTER_STATUS_KEY, statusText(state.mode(), state.isActive()));
  };
  refresh();
  return {
    refresh,
    unmount: () => ctx.ui.setStatus(FOOTER_STATUS_KEY, undefined),
  };
}
