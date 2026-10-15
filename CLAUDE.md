# CLAUDE.md

@AGENTS.md

## Claude Code notes

- Verify UI changes in a real browser: load the `frontend-verify` skill (`.claude/skills/`) for the full check sequence.
- Design work: the `impeccable` and `design-taste-frontend` skills apply. The direction contract is in `.impeccable/surfaces/`; product context is `docs/PRODUCT.md` and the design spec is `docs/DESIGN.md`. Impeccable resolves both only at the top of `docs/`, so never move them into a subfolder.
- Path-scoped rules live in `.claude/rules/`; shared settings (permissions, MCP servers) in `.claude/settings.json`.
- Playwright MCP comes from `.mcp.json` and is enabled in `.claude/settings.json`. On native Windows, if it fails to start, run it as `cmd /c npx -y @playwright/mcp@0.0.83`.
