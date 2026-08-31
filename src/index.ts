/**
 * xpi-caveman — Pi 扩展:六档压缩回复模式(PLAN v0.2)。
 * /xpi-caveman 面板 + before_agent_start 注入 + footer 芯片 + session 持久化。
 * T4 接线层:coexist(T5)与 stats(T6)后续任务接入。
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type FooterCtx, mountFooter } from "./lib/footer.js";
import { type CavemanMode, MODE_LABELS, MODES } from "./lib/modes.js";
import { loadCavemanRules } from "./lib/rules.js";
import {
  ENTRY_CUSTOM_TYPE,
  effectiveDefaultMode,
  readConfig,
  restoreMode,
  writeConfig,
} from "./lib/state.js";

const VERSION = "0.2.0";

/** 面板选项文案(与 MODES 顺序一致,后接操作项)。 */
/** 面板选项文案(D5 单层平铺:6 档 + 分隔 + 2 操作)。● 标记当前档(select 类型无 preselect)。 */
function panelOptions(current: CavemanMode): string[] {
  const modeItems = MODES.map(
    (m) =>
      `${m === current ? "● " : "  "}${MODE_LABELS[m]}${m === "off" ? " (关闭)" : ""}`,
  );
  return [
    ...modeItems,
    "─".repeat(16),
    "查看统计",
    "设为跨会话默认档",
  ];
}

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

  /** 选档的唯一入口:写 entry + 刷灯 + notify。coexist 拦截在调用方。 */
  function applyMode(next: CavemanMode, ctx: ExtensionContext, quiet = false): void {
    mode = next;
    pi.appendEntry(ENTRY_CUSTOM_TYPE, {
      mode,
    });
    footer?.refresh();
    if (!quiet) ctx.ui.notify(`caveman: ${MODE_LABELS[mode]}`);
  }

  pi.on("session_start", async (_event, ctx) => {
    // D3/D9 优先级:session entry(含显式 off)> 跨会话默认(env > config)> off。
    mode = restoreMode(ctx.sessionManager.getBranch()) ?? effectiveDefaultMode();
    attachFooter(ctx);
  });

  pi.on("before_agent_start", async (event) => {
    // D4:off 原样透传;非 off 在 systemPrompt 尾部追加档位规则(链式,多扩展叠加)。
    if (mode === "off") return undefined;
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
        // D5:单层 select 平铺,8 项;当前档以 ● 标记(0.84.4 select 无 preselect 选项)。
        const options = panelOptions(mode);
        const picked = await ctx.ui.select("caveman mode", options);
        if (!picked) return;
        const idx = options.indexOf(picked);
        if (idx >= 0 && idx < MODES.length) {
          applyMode(MODES[idx]!, ctx);
        } else if (picked === "查看统计") {
          ctx.ui.notify("stats: T6 接入后可用");
        } else if (picked === "设为跨会话默认档") {
          const ok = writeConfig({
            coexist: readConfig().coexist,
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
        const ok = writeConfig({
          coexist: readConfig().coexist,
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
