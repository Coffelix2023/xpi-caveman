# xpi-caveman

> Pi 的 Caveman 扩展:让 Agent 字字珠玑,大幅节省 tokens。
>
> English README: [README.md](./README.md)

[Pi Coding Agent](https://github.com/badlogic/pi-mono) 扩展,移植自 [caveman](https://github.com/JuliusBrussee/caveman) by Julius Brussee(MIT 许可的 skill 部分)。全部逻辑在本扩展内本地运行,无需安装任何上游产物。

> **商标注记**:"caveman" 是 Julius Brussee 的商标,本项目仅叙述性使用(遵循上游 [TRADEMARKS.md](https://github.com/JuliusBrussee/caveman/blob/main/TRADEMARKS.md));与上游作者无隶属或背书关系。

## 功能

- **六档模式体系**:英 `lite` / `full` / `ultra` + 中 `lite-zh` / `full-zh` + `off`(默认关闭,装了不等于开了)。
- **`/xpi-caveman` 面板**:单层 select 平铺六档 + 「查看统计」 + 「设为跨会话默认档」;直接参数形式 `/xpi-caveman <mode>`、`status`、`default <mode>`。
- **Footer 指示灯**:`ctx.ui.setStatus("caveman", …)` 多键共存(不顶掉其他扩展状态)。激活 `● 🗿 caveman LITE-ZH`;空闲 `○ 🗿 caveman idle`;off 时隐藏。
- **真实 token 统计**:按会话 entry 时序分桶(切换档位后归入新桶),展示每档请求数 / output tokens / 费用。真实数据,无估算、无节省百分比;免费模型费用列显示 `—`。
- **首次安装自检**:检测旧 caveman skill 目录(`~/.agents/skills/caveman`、`~/.claude/skills/caveman`),弹出接管/共存选择。**共存让位**后扩展只做面板+指示灯、不注入规则(避免双注入翻倍 token)。

## 安装

```bash
pi install git:github.com/Coffelix2023/xpi-caveman
```

## 六档表

| 档位 | 行为 |
| :--- | :--- |
| `off` | 关闭(默认),正常回复 |
| `lite` | 英文基础档:删 filler/hedging/pleasantries,保留冠词与完整句子 |
| `full` | 英文完全档:删冠词/客套/委婉,允许片段,用短同义词 |
| `ultra` | 英文极限档:full 之上,一行能说完不说第二行;禁自造缩写、禁因果箭头 |
| `lite-zh` | 中文基础档:删 hedging/客套/filler,保留完整句子与虚词语法功能;默认中文回复 |
| `full-zh` | 中文完全档:lite-zh 之上再删冗余连接词、允许片段、用短同义词;不删承载语法角色的虚词 |

所有档位**保留**技术术语、代码块、文件路径、URL、错误字符串、精确 API 名;禁自造缩写、禁因果箭头(`→`)。

## 持久化

- 会话内:写入 `caveman-mode` custom entry,`session_start` 时从分支倒序恢复(旧 `fx-cn` entry 自动映射为 `lite-zh`)。
- 跨会话默认档:`~/.config/xpi-caveman/config.json`(尊重 `XDG_CONFIG_HOME`);环境变量 `XPI_CAVEMAN_DEFAULT_MODE` 覆盖。
- 优先级:session entry(含显式 off)> env > config.defaultMode > off。

## 开发

```bash
pnpm typecheck        # tsc --noEmit
pnpm -w run lint      # biome check .
pnpm test             # vitest run
```

提交前三条全绿。详见 `AGENTS.md`。

## 许可与鸣谢

- 本项目以 [MIT](./LICENSE) 许可发布。
- 英文档规则文本移植自 [caveman](https://github.com/JuliusBrussee/caveman) by Julius Brussee(**MIT 许可的 skill 部分**,MIT → MIT);上游 BSL-1.1 产物(caveman CLI / engine / proxy)**不引入、不链接、不分发**。
- 上游 caveman 项目(skill、文档与设计)启发了本次移植 —— 感谢 [@JuliusBrussee](https://github.com/JuliusBrussee)。
- 商标注记:"caveman" 为 Julius Brussee 商标,本项目仅叙述性使用,与上游作者无隶属或背书关系。
