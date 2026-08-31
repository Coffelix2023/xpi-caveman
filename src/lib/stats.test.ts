import { describe, expect, it } from "vitest";
import { aggregateByMode, renderStats, type StatsEntry } from "./stats.js";

function assistant(output: number, cost?: number): StatsEntry {
  return {
    type: "message",
    message: {
      role: "assistant",
      usage: {
        output,
        cost:
          cost === undefined
            ? undefined
            : {
                total: cost,
              },
      },
    },
  };
}

function modeSwitch(mode: string): StatsEntry {
  return {
    customType: "caveman-mode",
    type: "custom",
    data: {
      mode,
    },
  };
}

describe("aggregateByMode", () => {
  it("分桶:起始档兜底 + mode 切换后归入新桶", () => {
    const result = aggregateByMode(
      [
        assistant(10, 0.1),
        modeSwitch("full"),
        assistant(20, 0.2),
        assistant(5, 0.05),
      ],
      "lite-zh",
    );
    expect(result.buckets).toEqual([
      {
        cost: 0.1,
        mode: "lite-zh",
        outputTokens: 10,
        requests: 1,
      },
      {
        cost: 0.25,
        mode: "full",
        outputTokens: 25,
        requests: 2,
      },
    ]);
    expect(result.total).toEqual({
      cost: 0.35,
      outputTokens: 35,
      requests: 3,
    });
    expect(result.hasCost).toBe(true);
  });

  it("cost 全缺失:hasCost=false,合计不造假", () => {
    const result = aggregateByMode(
      [
        assistant(10),
        assistant(20),
      ],
      "off",
    );
    expect(result.buckets).toEqual([
      {
        cost: 0,
        mode: "off",
        outputTokens: 30,
        requests: 2,
      },
    ]);
    expect(result.total.cost).toBe(0);
    expect(result.hasCost).toBe(false);
  });

  it("忽略非 assistant 消息与无 usage 消息", () => {
    const result = aggregateByMode(
      [
        {
          type: "message",
          message: {
            role: "user",
          },
        },
        {
          type: "message",
          message: {
            role: "assistant",
          },
        },
        assistant(7),
        {
          type: "compaction",
        },
        {
          customType: "other-ext",
          data: {},
          type: "custom",
        },
      ],
      "full",
    );
    expect(result.total).toEqual({
      cost: 0,
      outputTokens: 7,
      requests: 1,
    });
  });

  it("caveman-mode entry 显式 off 后归入 off 桶", () => {
    const result = aggregateByMode(
      [
        assistant(3, 0.01),
        modeSwitch("off"),
        assistant(4, 0.02),
      ],
      "lite",
    );
    expect(result.buckets.map((b) => b.mode)).toEqual([
      "lite",
      "off",
    ]);
  });

  it("空会话:无桶,合计零", () => {
    const result = aggregateByMode([], "off");
    expect(result.buckets).toEqual([]);
    expect(result.total).toEqual({
      cost: 0,
      outputTokens: 0,
      requests: 0,
    });
    expect(result.hasCost).toBe(false);
  });
});

describe("renderStats", () => {
  it("等宽文本含表头/合计行,费用为 $", () => {
    const result = aggregateByMode(
      [
        assistant(10, 0.1),
        modeSwitch("full"),
        assistant(5, 0.05),
      ],
      "lite",
    );
    const text = renderStats(result);
    expect(text).toContain("caveman stats");
    expect(text).toContain("mode   req");
    expect(text).toContain("LITE");
    expect(text).toContain("total");
    expect(text).toContain("$0.15");
  });

  it("全 0 费用显示 —", () => {
    const result = aggregateByMode(
      [
        assistant(10),
        assistant(5),
      ],
      "off",
    );
    const text = renderStats(result);
    expect(text).not.toContain("$");
    expect(text).toContain("—");
  });

  it("空会话显示占位文案", () => {
    const text = renderStats(aggregateByMode([], "off"));
    expect(text).toContain("暂无 assistant 请求");
  });
});
