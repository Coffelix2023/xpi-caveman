/**
 * xpi-caveman — Pi 扩展:六档压缩回复模式(PLAN v0.2)。
 * /xpi-caveman 面板 + before_agent_start 注入 + footer 芯片 + session 持久化 + setup 自检 + stats。
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type FooterCtx, mountFooter } from "./lib/footer.js";
import { type CavemanMode, MODE_LABELS, MODES } from "./lib/modes.js";
import { PANEL_DEFAULT, PANEL_STATS, pickFromPanel } from "./lib/panel.js";
import { loadCavemanRules } from "./lib/rules.js";
import { runSetup } from "./lib/setup.js";
import {
  ENTRY_CUSTOM_TYPE,
  effectiveDefaultMode,
  restoreMode,
  updateConfig,
} from "./lib/state.js";
import { aggregateByMode, renderStats } from "./lib/stats.js";

const VERSION = "0.2.0";

/** mountFooter 实际依赖的最小上下文面(真实 ExtensionContext 结构兼容)。 */
function footerCtx(ctx: ExtensionContext): FooterCtx {
  return {
    mode: ctx.mode,
    ui: {
      setStatus: (key, text) => ctx.ui.setStatus(key, text),
    },
  };
}

export default function xpiCaveman(pi: ExtensionAPI): void {
  let mode: CavemanMode = "off";
  let isActive = false;
  let startMode: CavemanMode = "off"; // D7:会话起始档(恢复值),stats 分桶兜底。
  let coexist = false; // D8:共存让位 → 只做面板+指示灯,不注入规则。
  let footer: ReturnType<typeof mountFooter> | undefined;
  // 延迟接线信号:setMode 在 session_start 前也可能被调(命令先于事件),footer 就绪后补挂。
  let lastFooterCtx: FooterCtx | undefined;

  function attachFooter(ctx: ExtensionContext): void {
    lastFooterCtx = footerCtx(ctx);
    if (!footer) {
      footer = mountFooter(lastFooterCtx, {
        isActive: () => isActive,
        mode: () => mode,
      });
    } else {
      footer.refresh();
    }
  }

  /** 选档的唯一入口:写 entry + 刷灯 + notify。coexist 时注入层拦截,此处如实提示。 */
  function applyMode(next: CavemanMode, ctx: ExtensionContext, quiet = false): void {
    mode = next;
    pi.appendEntry(ENTRY_CUSTOM_TYPE, {
      mode,
    });
    footer?.refresh();
    if (quiet) return;
    const hint = coexist && mode !== "off" ? "(共存模式:规则未注入)" : "";
    ctx.ui.notify(`caveman: ${MODE_LABELS[mode]} ${hint}`.trim());
  }

  pi.on("session_start", async (_event, ctx) => {
    // D3/D9 优先级:session entry(含显式 off)> 跨会话默认(env > config)> off。
    mode = restoreMode(ctx.sessionManager.getBranch()) ?? effectiveDefaultMode();
    startMode = mode; // D7:会话起始档快照,stats 首个 mode entry 之前的 usage 归入此桶。
    // D8:检测旧 skill,未选择时弹 setup 面板;coexist 决定注入层是否拦截。
    coexist = (await runSetup(ctx)).coexist;
    attachFooter(ctx);
  });

  pi.on("before_agent_start", async (event) => {
    // D4:off 原样透传;D8 共存让位时也不注入(只做面板+指示灯)。
    if (mode === "off" || coexist) return undefined;
    const rules = loadCavemanRules(mode);
    return {
      systemPrompt: `${event.systemPrompt}\n\n${rules}`,
    };
  });

  pi.on("agent_start", async () => {
    isActive = true;
    footer?.refresh();
  });

  pi.on("agent_end", async () => {
    isActive = false;
    footer?.refresh();
  });

  pi.registerCommand("xpi-caveman", {
    description: `caveman ${VERSION}: /xpi-caveman [off|lite|full|ultra|lite-zh|full-zh|status|default <mode>]`,
    handler: async (args, ctx) => {
      const parts = args.trim().toLowerCase().split(/\s+/).filter(Boolean);

      if (parts.length === 0) {
        const picked = await pickFromPanel(
          {
            hasUI: ctx.hasUI,
            custom: (factory, options) => ctx.ui.custom(factory, options),
            notify: (message, type) => ctx.ui.notify(message, type),
          },
          mode,
        );
        if (!picked) return;
        const asMode = MODES.find((m) => m === picked);
        if (asMode) {
          applyMode(asMode, ctx);
        } else if (picked === PANEL_STATS) {
          const result = aggregateByMode(ctx.sessionManager.getBranch(), startMode);
          ctx.ui.notify(renderStats(result));
        } else if (picked === PANEL_DEFAULT) {
          const ok = updateConfig({
            defaultMode: mode,
          });
          ctx.ui.notify(
            ok ? `默认档已保存: ${MODE_LABELS[mode]}` : "config.json 写入失败",
            ok ? "info" : "error",
          );
        }
        return;
      }

      const [head, tail] = parts;
      if (head === "status") {
        ctx.ui.notify(
          `caveman ${VERSION} · mode=${MODE_LABELS[mode]} · active=${isActive} · default=${MODE_LABELS[effectiveDefaultMode()]}`,
        );
        return;
      }

      if (head === "default") {
        const target = MODES.find((m) => m === tail);
        if (!target) {
          ctx.ui.notify(`用法: /xpi-caveman default <${MODES.join("|")}>`, "warning");
          return;
        }
        const ok = updateConfig({
          defaultMode: target,
        });
        ctx.ui.notify(
          ok ? `默认档已保存: ${MODE_LABELS[target]}` : "config.json 写入失败",
          ok ? "info" : "error",
        );
        return;
      }

      const direct = MODES.find((m) => m === head);
      if (!direct) {
        ctx.ui.notify(
          `未知参数: ${head}。可用: ${MODES.join("|")}, status, default <mode>`,
          "warning",
        );
        return;
      }
      applyMode(direct, ctx);
    },
  });
}
