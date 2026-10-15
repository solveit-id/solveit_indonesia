# .ai: agent handoff

This folder lets either of the project's coding agents (Claude Code and OpenAI Codex) pick up the Solveit Indonesia project without the previous agent's conversation. It holds state that changes from task to task. Stable rules live elsewhere and are only linked here.

## Read in this order

1. [`../AGENTS.md`](../AGENTS.md): rules every agent follows (content integrity, design, motion, Git).
2. [`project-status.md`](project-status.md): what is shipped, branch state, open decisions, the next task.
3. [`workflow.md`](workflow.md): how to set up, change, verify, and release without Claude Code tooling (the Codex path).
4. [`../docs/README.md`](../docs/README.md): map of the project documentation; start with `docs/PRODUCT.md`.
5. Backend work: [`../backend/AGENTS.md`](../backend/AGENTS.md) (Laravel Boost guidelines) and [`../backend/README.md`](../backend/README.md) (setup). API contracts: [`../docs/api/`](../docs/api/README.md).

## Two `.ai/` folders

This folder is the repository handoff. `backend/.ai/` is different: it belongs to Laravel Boost and holds the Laravel app's guidelines, skills, and rules (`docs/project-structure.md` section 9.6). Never move files between them.

## Keeping it current

- Update `project-status.md` at the end of every task: date, what changed, branch SHAs after merge, the next step, and anything left unfinished. Write facts you verified, not plans presented as done.
- Keep this folder small: status and workflow only. Product facts belong in `docs/PRODUCT.md`, design in `docs/DESIGN.md` and `docs/design/`, QA evidence in `docs/qa/qa-report.md`.
- No secrets, tokens, personal data, or machine-only paths.
