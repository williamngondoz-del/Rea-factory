---
name: factory
description: Run a small software factory. Takes a feature through spec, build, four parallel reviews, and approval, tracked on factory/board.json with a live dashboard. Use for /factory <feature>, /factory next, /factory approve <job-id>, /factory rework <job-id> <note>.
disable-model-invocation: true
argument-hint: <feature> | next | approve <job-id> | rework <job-id> <note>
---

# /factory: the orchestrator

Whichever Claude Code session runs this skill becomes the orchestrator. It runs the loop below, spawns every agent, and is the ONLY writer of `factory/board.json`. Agents never touch the board.

## Repo facts (inspected; agents must follow them)

- Language: TypeScript on Node (see `.nvmrc`), ESM, npm. Product: REA, a local-only reverse-engineering tool with shared CLI and MCP workflows.
- Source: `src/`. Tests: `tests/` (vitest). Docs: `docs/`. Website: `website/`.
- Test: `npx vitest run <path>` for targeted runs; `npm test` is the full suite (slow, builds first).
- Lint: `npm run lint`. Format: `npm run format` (check with `npm run format:check`).
- Conventions live in `AGENTS.md` and `CONTRIBUTING.md`. Read them before building or reviewing. Key rules: fail-closed on scope and authority questions, dependencies flow inward (domain, providers, application, CLI/MCP adapters), `Result` and tagged errors at boundaries, no speculative complexity, additive and idempotent config changes.
- Never push, open PRs, or publish. All factory work stays local until the human says otherwise.

## The loop (edit this to change the factory)

```
        feature
           |
           v
      spec-writer (opus)
           |
           v
   +-> builder (opus)
   |       |
   |  fan out to 4 reviewers in parallel
   |  security (opus) | ux (sonnet) | ui (sonnet) | code (sonnet)
   |       |
   |  WAIT FOR ALL 4 reviews in
   |       |
   |   any CHANGES --> resume builder (max 2 rounds) --+
   |       |
   |    all PASS
   |       v
   |   approver (opus)
   |     |         |
   |  APPROVE    ESCALATE
   |     |         |
   |  merge to   needs-human <-- /factory approve <job-id>
   |    main
```

## File layout

```
.claude/skills/factory/SKILL.md      this file
.claude/agents/                      one file per agent
factory/board.json                   durable state, drives the dashboard
factory/dashboard.html               visual board, polls board.json
factory/backlog.md                   queue for /factory next
factory/jobs/<NNN-slug>/
  spec.md
  build.md
  round-1/review-security.md, review-ux.md, review-ui.md, review-code.md
  round-2/...                        only if round 1 had CHANGES
  decision.md
```

## board.json

```json
{ "jobs": [ {
  "id": "003-rate-limiting", "title": "Rate limiting", "branch": "factory/003-rate-limiting",
  "stage": "review", "round": 2,
  "reviews": { "security": "CHANGES", "ux": "PASS", "ui": "pending", "code": "PASS" },
  "decision": null,
  "files": ["spec.md", "build.md", "round-1/review-security.md"]
} ] }
```

- `stage` is one of: `spec`, `build`, `review`, `approve`, `needs-human`, `merged`.
- `reviews` values: `pending`, `PASS`, `CHANGES`. Reset all four to `pending` at the start of each round.
- `decision` is `null`, `APPROVE`, or `ESCALATE`.
- `files` lists every markdown file in the job folder so the dashboard can open them. Refresh it after each step.
- Write the board atomically (write a temp file, then rename). Update it at every stage change and every time a verdict lands.

## Rules

- Agents get context from files, not the conversation, and write only their own file.
- Each review starts with `VERDICT: PASS` or `VERDICT: CHANGES`. `decision.md` starts with `APPROVE` or `ESCALATE`.
- The builder works and commits on a feature branch (`factory/<job-id>`) and tests against the spec's acceptance criteria.
- WAIT FOR ALL: a review round is done only when every reviewer's file exists in the round folder. Never resume the builder mid-round.
- Spawn the builder with a name (`builder-<job-id>`) and resume that same builder with SendMessage for each new round, pointing it at the round folder.
- Maximum 2 review rounds. If round 2 still has any CHANGES, set stage `needs-human` with a note in `decision.md` (ESCALATE) and stop.
- The approver reads the spec, build notes, and all review files. It does not rebuild or re-review.
- Merging to main means a local `git merge --no-ff factory/<job-id>` into `main`, only after APPROVE. Never push.

## Commands

| Command | What it does |
|---|---|
| `/factory <feature>` | Run a new job through the loop |
| `/factory next` | Run the first unchecked item in `factory/backlog.md`, then check it off |
| `/factory approve <job-id>` | Merge a `needs-human` job into main |
| `/factory rework <job-id> <note>` | Send a job back to the builder with the note as feedback (counts as a new round) |

## Procedure for `/factory <feature>`

1. Pick the next job id: `NNN-slug` where NNN is the highest existing job number plus one (zero-padded to 3).
2. Create `factory/jobs/<id>/`, add the job to `board.json` (stage `spec`).
3. Spawn `spec-writer` with the feature text and job folder. Wait for `spec.md`. Set stage `build`.
4. Create branch `factory/<id>` from main. Spawn `builder` named `builder-<id>` with the job folder and round 0. Wait for `build.md`. Set stage `review`, round 1, reviews all `pending`.
5. Create `round-1/`. Spawn the agents `security-reviewer`, `ux-reviewer`, `ui-reviewer`, `code-reviewer` IN PARALLEL (one message, four Agent calls), each told the job folder, round folder, and branch. As each file lands, read its first line and update `reviews` on the board.
6. When all four files exist:
   - Any `CHANGES` and round < 2: increment round, reset reviews, SendMessage `builder-<id>` pointing at the round folder. Wait for it to finish, then repeat from step 5 with a new round folder.
   - Any `CHANGES` and round is 2: stage `needs-human`, write `decision.md` starting `ESCALATE` listing unresolved findings.
   - All `PASS`: stage `approve`, spawn `approver`.
7. Approver writes `decision.md`. `APPROVE`: merge locally, stage `merged`. `ESCALATE`: stage `needs-human`.
8. Finish with two sentences: outcome and where the job folder is. Mention `factory/dashboard.html` only if the human has not seen it yet.

## Starting the dashboard

`python3 -m http.server 8000 --directory factory` then open `http://localhost:8000/dashboard.html`. Start it only if the human asks.
