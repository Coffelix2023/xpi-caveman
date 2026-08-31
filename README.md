# xpi-caveman

> Caveman for Pi: six reply-compression modes that cut agent verbosity, word by word, to save tokens.
>
> 中文说明见 [README.zh-CN.md](./README.zh-CN.md)

A [Pi coding agent](https://github.com/badlogic/pi-mono) extension ported from the MIT-licensed skill portion of [caveman](https://github.com/JuliusBrussee/caveman) by Julius Brussee. Everything runs locally in this extension — no upstream binaries required.

> **Trademark notice:** "caveman" is a trademark of Julius Brussee. This project uses the name descriptively only (per the upstream [TRADEMARKS.md](https://github.com/JuliusBrussee/caveman/blob/main/TRADEMARKS.md)); it is not affiliated with or endorsed by the upstream author.

## Features

- **Six-mode system**: English `lite` / `full` / `ultra` + Chinese `lite-zh` / `full-zh` + `off` (default off — installed doesn't mean enabled).
- **`/xpi-caveman` panel**: single-layer select with all six modes + "View stats" + "Set cross-session default"; direct args `/xpi-caveman <mode>`, `status`, `default <mode>`.
- **Footer indicator**: `ctx.ui.setStatus("caveman", …)` coexists with other extensions' status keys. Active `● 🗿 caveman LITE-ZH`; idle `○ 🗿 caveman idle`; hidden when off.
- **Honest token stats**: bucketed by session entry order (a mode switch starts a new bucket), showing per-mode request count / output tokens / cost. Real data only — no estimates, no savings percentages; free models show `—` for cost.
- **First-install check**: detects legacy caveman skill directories (`~/.agents/skills/caveman`, `~/.claude/skills/caveman`) and offers takeover/coexistence. In **coexistence** mode the extension only renders the panel + footer and injects nothing (avoids double-injection token waste).

## Install

```bash
pi install git:github.com/Coffelix2023/xpi-caveman
```

## Mode table

| Mode | Behavior |
| :--- | :--- |
| `off` | Disabled (default), normal replies |
| `lite` | English base: drop filler/hedging/pleasantries, keep articles and full sentences |
| `full` | English full: drop articles/pleasantries/hedges, allow fragments, prefer short synonyms |
| `ultra` | English extreme: full-plus — one line when one line works; no invented abbreviations, no causal arrows |
| `lite-zh` | Chinese base: drop hedging/pleasantries/filler, keep full sentences and particles' grammatical roles; replies in Chinese |
| `full-zh` | Chinese full: lite-zh plus dropping redundant connectives, fragments allowed, short synonyms; particles with grammatical roles are kept |

All modes **preserve** technical terms, code blocks, file paths, URLs, error strings, exact API names; invented abbreviations and causal arrows (`→`) are banned.

## Persistence

- Within a session: writes a `caveman-mode` custom entry, restored at `session_start` by scanning branches newest-first (legacy `fx-cn` entries map to `lite-zh`).
- Across sessions: `~/.config/xpi-caveman/config.json` (respects `XDG_CONFIG_HOME`); env var `XPI_CAVEMAN_DEFAULT_MODE` overrides.
- Priority: session entry (incl. explicit off) > env > config.defaultMode > off.

## Development

```bash
pnpm typecheck        # tsc --noEmit
pnpm -w run lint      # biome check .
pnpm test             # vitest run
```

All three green before committing. See `AGENTS.md` for details.

## License & attribution

- Licensed under [MIT](./LICENSE).
- English rule texts are ported from the **MIT-licensed skill portion** of [caveman](https://github.com/JuliusBrussee/caveman) by Julius Brussee (MIT → MIT). The upstream BSL-1.1 products (caveman CLI / engine / proxy) are **not imported, linked, or distributed** here.
- The upstream caveman project (skill, docs, design) inspired this port — thank you, [@JuliusBrussee](https://github.com/JuliusBrussee).
- Trademark notice: "caveman" is a trademark of Julius Brussee, used here descriptively only; not affiliated with or endorsed by the upstream author.
