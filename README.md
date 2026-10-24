# rea-factory

A small software factory for Claude Code. One session acts as orchestrator and takes a feature through:

spec-writer → builder → 4 parallel reviewers (security, UX, UI, code) → approver → local merge or needs-human.

## Commands

| Command | What it does |
|---|---|
| `/factory <feature>` | Run a new job through the loop |
| `/factory next` | Run the first unchecked item in `factory/backlog.md` |
| `/factory approve <job-id>` | Merge a `needs-human` job into main |
| `/factory rework <job-id> <note>` | Send a job back to the builder with feedback |

## Layout

- `.claude/skills/factory/SKILL.md` — orchestrator
- `.claude/agents/` — one file per agent
- `factory/board.json` — job state
- `factory/dashboard.html` — live board (`python3 -m http.server 8000 --directory factory`)
- `factory/backlog.md` — queue for `/factory next`
