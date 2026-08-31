/**
 * 真实 token 分桶统计(PLAN v0.2 D7)。
 * 数据源:session entries(getBranch),assistant 消息取 usage(output/cost.total)。
 * 分桶:按 entry 时序,caveman-mode custom entry 切换当前桶;首个 mode entry 之前的 usage 归入起始档(恢复值)。
 * 真实数据,无估算,无节省百分比。全部桶 cost 为 0/缺失时费用列显示 —(免费模型不显示误导性 $0.00)。
 */
import { type CavemanMode, MODE_LABELS, normalizeMode } from "./modes.js";
import { ENTRY_CUSTOM_TYPE } from "./state.js";

/** stats 依赖的最小 entry 面(真实 SessionEntry 结构兼容)。 */
export interface StatsEntry {
  customType?: string;
  data?: unknown;
  message?: {
    role?: string;
    usage?: {
      output?: number;
      cost?: {
        total?: number;
      };
    };
  };
  type: string;
}

export interface BucketStats {
  cost: number;
  mode: CavemanMode;
  outputTokens: number;
  requests: number;
}

export interface StatsResult {
  buckets: BucketStats[];
  /** 是否观测到真实费用(cost.total>0);false 时费用列显示 —。 */
  hasCost: boolean;
  total: {
    requests: number;
    outputTokens: number;
    cost: number;
  };
}

export function aggregateByMode(
  entries: readonly StatsEntry[],
  initialMode: CavemanMode,
): StatsResult {
  let current = initialMode;
  const buckets = new Map<CavemanMode, BucketStats>();
  let hasCost = false;

  for (const e of entries) {
    if (e.type === "custom" && e.customType === ENTRY_CUSTOM_TYPE) {
      const raw = (
        e.data as
          | {
              mode?: unknown;
            }
          | undefined
      )?.mode;
      if (typeof raw === "string") current = normalizeMode(raw);
      continue;
    }
    if (e.type !== "message" || e.message?.role !== "assistant") continue;
    const usage = e.message.usage;
    if (!usage) continue;
    const bucket = buckets.get(current) ?? {
      cost: 0,
      mode: current,
      outputTokens: 0,
      requests: 0,
    };
    bucket.requests += 1;
    bucket.outputTokens += usage.output ?? 0;
    const c = usage.cost?.total;
    if (typeof c === "number") {
      bucket.cost += c;
      if (c > 0) hasCost = true;
    }
    buckets.set(current, bucket);
  }

  const ordered = [
    ...buckets.values(),
  ];
  const total = ordered.reduce(
    (acc, b) => ({
      cost: acc.cost + b.cost,
      outputTokens: acc.outputTokens + b.outputTokens,
      requests: acc.requests + b.requests,
    }),
    {
      cost: 0,
      outputTokens: 0,
      requests: 0,
    },
  );
  return {
    buckets: ordered,
    total,
    hasCost,
  };
}

/** 等宽对齐的 notify 文本块(模式标签为英文大写,对齐可用 ASCII 空格)。 */
export function renderStats(result: StatsResult): string {
  if (result.total.requests === 0) {
    return "caveman stats: 本会话暂无 assistant 请求可统计";
  }
  const rows = result.buckets.filter((b) => b.requests > 0);
  const modeW = Math.max(
    ...rows.map((r) => MODE_LABELS[r.mode].length),
    "total".length,
  );
  const costW = 5; // "$0.00" 宽
  const fmtCost = (n: number): string =>
    result.hasCost ? `$${n.toFixed(2)}` : "—".padStart(costW);
  const row = (label: string, req: number, out: number, cost: number): string =>
    `${label.padEnd(modeW)}  ${String(req).padStart(3)}  ${String(out).padStart(6)}  ${fmtCost(cost).padStart(costW)}`;
  const lines = [
    `${"mode".padEnd(modeW)}  ${"req".padStart(3)}  ${"out".padStart(6)}  ${"cost".padStart(costW)}`,
    ...rows.map((r) => row(MODE_LABELS[r.mode], r.requests, r.outputTokens, r.cost)),
    row("total", result.total.requests, result.total.outputTokens, result.total.cost),
  ];
  return `caveman stats\n${lines.join("\n")}`;
}
