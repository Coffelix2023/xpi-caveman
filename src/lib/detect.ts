/**
 * 旧 caveman skill 目录检测(PLAN v0.2 D8)。
 * 范围仅 skill 目录两路径:~/.agents/skills/caveman、~/.claude/skills/caveman(existsSync)。
 * 不检测 CLI、不读其他工具配置。
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";

export const SKILL_DIRS = [
  "~/.agents/skills/caveman",
  "~/.claude/skills/caveman",
] as const;

/** 检测命中的旧 skill 目录绝对路径列表(空 = 未命中)。 */
export function detectLegacySkills(home: string = homedir()): string[] {
  const dirs = SKILL_DIRS.map((d) => d.replace("~", home));
  return dirs.filter((d) => existsSync(d));
}
