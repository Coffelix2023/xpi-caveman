# CONTEXT.md — xpi-caveman 术语表 (Glossary)

本文件定义本仓库的统一语言 (Ubiquitous Language)。代码、文档、issue、commit 中使用下列术语,禁止漂移为同义词。

## 领域术语

| 术语 | 定义 | 备注 |
| :--- | :--- | :--- |
| 档位 (mode) | 六档之一:`off`/`lite`/`full`/`ultra`/`lite-zh`/`full-zh`。 | 英文档移植上游;中文档按 D2 语义 |
| 档位标签 (MODE_LABELS) | 面板/footer 显示的大写标签(`lite-zh` → `LITE-ZH`,内含语言)。 | D6 |
| 注入 (injection) | `before_agent_start` 在 systemPrompt 尾部追加档位规则;coexist 时不注入。 | D4/D8 |
| 会话起始档 (startMode) | `session_start` 恢复出的初始档;stats 首个 mode entry 前的 usage 归入此桶。 | D7 |
| 分桶 (bucket) | stats 按 mode 切换切分的 usage 聚合单元。 | D7 |
| 接管 (takeover) | setup 面板选择让扩展接管:提示用户自禁旧 skill,扩展不写用户全局配置。 | D8 |
| 共存 (coexist) | setup 面板选择共存:扩展只做面板+指示灯,不注入规则。 | D8 |
| footer 芯片 | `ctx.ui.setStatus("caveman", …)` 的状态指示灯(图腾款,多键共存)。 | D6 |

## 仓库阶段

| 术语 | 定义 | 备注 |
| :--- | :--- | :--- |
| 阶段一 | 单人快速迭代优先的仓库阶段。默认允许在本仓内按仓库约束工作。 | 以 `docs/GITHUB-GUARD.md` 为准 |
| 阶段二 | 更严格的协作阶段。默认分支 + PR + 人工合并。 | 以后切换时再启用 |
| 直推 | 直接 push 到主分支。 | 仅在仓库阶段与规则明确允许时才可能出现 |
| PR | Pull Request，合并请求。 | 远端协作入口 |
| ruleset | GitHub 仓库规则集。 | 由用户在 GitHub UI 管理 |
| 远端同步 | 先 fetch，再决定是否 rebase / push / 停止。 | 避免覆盖与分叉 |

## 避免用词 (Banned Synonyms)

- <!-- 记录易混淆/禁用的同义词:fx-cn(已更名 lite-zh,不保留旧名)、caveman(商标,仅叙述性使用) -->
