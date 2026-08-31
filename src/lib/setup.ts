/**
 * setup 冲突自检面板(PLAN v0.2 D8)。
 * 检测到旧 skill 目录且用户未做过选择时弹 select:接管(提示自禁)/ 共存让位(coexist=true)。
 * 选择持久化 config.json(env 可注入隔离),不再重复询问。扩展不写用户全局配置,接管仅提示命令。
 */
import { homedir } from "node:os";
import { detectLegacySkills } from "./detect.js";
import { readConfig, updateConfig } from "./state.js";

/** select/notify 子集(真实 ExtensionContext 结构兼容)。 */
export type SetupCtx = {
  hasUI: boolean;
  ui: {
    select: (title: string, options: string[]) => Promise<string | undefined>;
    notify: (message: string, type?: "info" | "warning" | "error") => void;
  };
};

export interface SetupResult {
  /** 选择后的共存标记(false=接管,true=共存)。未弹面板时为 config 现值。 */
  coexist: boolean;
  /** 弹了面板(true)或无需弹(false)。 */
  prompted: boolean;
}

/**
 * 命中目录且未选择过 → 弹面板;否则静默返回现值。返回 coexist 供注入层拦截。
 * env:config 读写环境(测试注入 XDG_CONFIG_HOME 隔离),默认 process.env。
 */
export async function runSetup(
  ctx: SetupCtx,
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
): Promise<SetupResult> {
  const config = readConfig(env);
  const hits = detectLegacySkills(home);
  // setupDone=true(已选过,含接管)或 coexist=true(共存中)→ 不再弹。
  if (hits.length === 0 || config.setupDone) {
    return {
      coexist: config.coexist,
      prompted: false,
    };
  }

  if (!ctx.hasUI) {
    // 非 TUI/RPC 无面板能力:降级 notify,不阻塞会话,下次有 UI 再问。
    ctx.ui.notify(
      `检测到旧 caveman skill: ${hits.join(", ")}。请在交互模式下运行 /xpi-caveman 完成接管选择。`,
      "warning",
    );
    return {
      coexist: config.coexist,
      prompted: false,
    };
  }

  const picked = await ctx.ui.select(
    `检测到旧 caveman skill 安装(${hits.join("、")})。如何处理?`,
    [
      "本扩展接管(推荐)",
      "共存让位(扩展不注入规则)",
    ],
  );

  if (picked === "共存让位(扩展不注入规则)") {
    updateConfig(
      {
        coexist: true,
        setupDone: true,
      },
      env,
    );
    ctx.ui.notify("已选择共存:本扩展只提供面板与指示灯,不再注入压缩规则。", "info");
    return {
      coexist: true,
      prompted: true,
    };
  }

  if (picked === "本扩展接管(推荐)") {
    updateConfig(
      {
        coexist: false,
        setupDone: true,
      },
      env,
    );
    ctx.ui.notify(
      `已选择接管。请自行禁用旧 skill(扩展不写你的全局配置):\n  mv ~/.agents/skills/caveman{,.bak}`,
      "info",
    );
    return {
      coexist: false,
      prompted: true,
    };
  }

  // 用户 Esc 取消:不持久化,下次再问。
  return {
    coexist: config.coexist,
    prompted: false,
  };
}
