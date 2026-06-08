# Extending Agents and Prompts

This guide shows how to create new agents and prompts for Claude Code.

## File Structure

```
.github/
├── agents/              # Custom multi-step workflow agents
│   ├── feature-manager.agent.md
│   ├── bug-resolver.agent.md
│   └── ...
├── prompts/             # Quick single-task prompts
│   ├── pr-description.prompt.md
│   ├── commit-message.prompt.md
│   └── ...
└── instructions/        # Scoped coding standards
    ├── global.instructions.md
    ├── ui.instructions.md
    ├── data-layer.instructions.md
    └── ...
```

## Creating a New Agent

Use agents for **multi-phase workflows** that guide the user through a complex task (clarify → plan → implement → review).

### Template

```yaml
---
description: 'One-line description of what this agent does. Include when to invoke it.'
tools: [read, edit, search, execute, agent]
argument-hint: 'What the user should pass (e.g., "Feature description" or "File path")'
---

You are the [Name] for work-tracker. Your job is [one sentence on your role].

## Phase 1: [Phase Name]

[Description of what happens in this phase. Ask questions, gather info, propose approaches.]

Wait for user approval before proceeding to Phase 2.

## Phase 2: [Phase Name]

[Next step in the workflow.]

## Phase 3+: [Additional Phases]

[Continue as needed — most agents are 4-6 phases.]

## Final Phase

After implementation/testing/review:

- Reference the `code-reviewer` agent if peer review is needed
- Reference the `pr-description` prompt for PR generation
- Summarize what the user should do next
```

### Agent Naming

- File: `{agent-name}.agent.md` (kebab-case)
- Invoke: `/agent-name "argument"`
- Description: 40–80 characters, action-oriented

### Example: Create a "performance-auditor" agent

```yaml
---
description: 'Profile code performance, identify bottlenecks, and propose optimizations. Use when a feature feels slow or you want to benchmark before/after. Invoke with a file path or feature area.'
tools: [read, edit, search, execute]
argument-hint: 'File path or feature area to profile'
---

You are the Performance Auditor for work-tracker. Your job is to identify slowness, measure it, and optimize.

## Phase 1: Understand

Read the code. Ask:
- What is the suspected slow operation?
- Is it reproducible? How often does it happen?
- What is the acceptable baseline (e.g., "should load in <500ms")?

## Phase 2: Measure

- Check existing performance tests in `src/__tests__/`
- Run profiling (use React DevTools or Node.js `--prof`)
- Identify the bottleneck: algorithm complexity, repeated renders, n+1 queries, etc.

Report findings before proceeding.

## Phase 3: Optimize

Implement fixes. For each fix:
- Explain why it's faster
- Add or update performance benchmarks
- Measure improvement

## Phase 4: Validate

- Run `npm test` to ensure no regressions
- Compare before/after metrics
- Document the change in commit message
```

---

## Creating a New Prompt

Use prompts for **single-task automation** that doesn't require multi-phase guidance (generate, review, extract, reformat).

### Template

```yaml
---
description: 'One-line description. Include when to invoke it.'
agent: agent
tools: [read, execute, search]
argument-hint: 'What the user should pass (optional — will be inferred from context if omitted)'
---

[One-paragraph context/instruction on what you're doing.]

## Format / Steps

[How to structure the output, or what steps to follow.]

## Rules

- [Specific constraints or rules]
- [Another rule]

[Any additional guidance.]
```

### Prompt Naming

- File: `{prompt-name}.prompt.md` (kebab-case)
- Invoke: `/prompt-name` or `/prompt-name "context"`
- No `argument-hint` if the prompt infers context from staged changes

### Example: Create a "changelog-entry" prompt

(This already exists, but here's the pattern):

```yaml
---
description: 'Generate a CHANGELOG entry from the current commit or PR. Follows semantic versioning and user-facing language.'
agent: agent
tools: [read, execute]
---

Review the staged or committed changes and generate a CHANGELOG entry for the next release.

## Format

```
## [Unreleased]

### Added
- [New features or capabilities]

### Fixed
- [Bug fixes]

### Changed
- [Breaking changes or significant updates]

### Removed
- [Deprecated or removed features]
```

## Rules

- Write for end users, not developers
- "Added a caching layer to invoice PDF generation" not "optimized performance"
- Group by semantic type (Added, Fixed, Changed, Removed)
- One line per item
- Mention impact if significant ("now loads 3x faster", "fixes sign-in on iOS")
```

---

## Referencing Instruction Files

Every agent should reference the relevant `.instructions.md` files in its workflow.

### Pattern

In your agent or prompt, include a line like:

```markdown
Apply the guidance in `global.instructions.md` (code style, testing, Firebase patterns).

For UI work, also read `ui.instructions.md` before writing components.
```

### Instruction files to reference

| File | When to reference |
| --- | --- |
| `global.instructions.md` | Every agent — enforces TypeScript strict, testing, naming, DRY, imports |
| `ui.instructions.md` | Building screens, components, forms, styling |
| `data-layer.instructions.md` | Firestore service layer, queries, types, React Query hooks |
| `pay-engine.instructions.md` | Anything in `src/pay/` — OT calculations, pay breakdown logic |
| `functions.instructions.md` | Cloud Functions, webhooks, async tasks, async computation |
| `testing.instructions.md` | Writing or auditing tests — test structure, fixtures, mocking |

---

## Adding a New Instruction File

If you find yourself repeating guidance for a specific code area:

1. Create `.github/instructions/{area}.instructions.md`
2. Document conventions for that area (naming, patterns, pitfalls)
3. Update any agents that touch that area to reference it
4. Update `AGENTS.md` to list the new scope

### Example: `crm.instructions.md`

If you later build a CRM module:

```markdown
# CRM Integration Instructions

## Architecture

- Client sync via `src/services/crm/` (typed, cached via React Query)
- All external calls go through `src/pay/crm/client.ts`
- No direct API calls from components

## API patterns

- Retry on 429 (rate limit) — use exponential backoff
- Timeout after 5s, return stale data if available
- Log all failures for debugging (sanitize PII)

## Testing

- Mock the CRM client in unit tests
- Use fixtures in `src/__tests__/fixtures/crm.ts`
- Integration tests hit a sandbox account (creds in `.env.test`)
```

Then in a future agent:

```markdown
Apply guidance in `crm.instructions.md` for any CRM integration work.
```

---

## Best Practices

### ✅ Do

- **Reference instruction files by name** — agents should direct users to read them
- **Keep phases to 4–6** — more phases become overwhelming
- **Make prompts composable** — `/pr-description` should work independently after any agent completes
- **State approval gates clearly** — "Wait for user confirmation before proceeding" in every phase that needs it
- **Link related agents** — "If this reveals a refactoring opportunity, invoke `refactor-guide`"

### ❌ Don't

- Create an agent for a single-task job (use a prompt instead)
- Create a prompt that needs multiple user interactions (use an agent)
- Duplicate guidance already in instruction files (reference them instead)
- Assume tool availability — always declare `tools:` in frontmatter
- Make the description longer than one line — users see this in `/` menu

---

## Testing Your New Agent/Prompt

1. **Syntax**: Ensure YAML frontmatter is valid (use a YAML linter)
2. **Invoke it**: Type `/agent-name "test argument"` in Claude Code
3. **Walk through**: Confirm each phase works as documented
4. **Verify guidance**: Ensure it references the right instruction files
5. **Check tool availability**: Confirm it only uses declared tools

---

## Examples in This Repo

Reference these for patterns:

- **Multi-phase workflow**: [`feature-manager.agent.md`](./agents/feature-manager.agent.md) — 6 phases, hands off to code-reviewer and prompts
- **Investigation + fix**: [`bug-resolver.agent.md`](./agents/bug-resolver.agent.md) — gathers info, proposes, implements, tests
- **Simple automation**: [`pr-description.prompt.md`](./prompts/pr-description.prompt.md) — reads diff, generates structured output
- **Specialized rules**: [`test-writer.agent.md`](./agents/test-writer.agent.md) — references `testing.instructions.md` and has pay-engine-specific rules

---

## Troubleshooting

**Agent doesn't appear in `/` menu**
- Check filename: must be `{name}.agent.md` or `{name}.prompt.md`
- Verify YAML frontmatter is valid (no unquoted special chars)
- Restart Claude Code

**Agent references a tool that doesn't exist**
- Verify `tools:` list only includes: `read, edit, search, execute, agent`
- If you need a tool not listed, check if it's a deferred tool (needs `ToolSearch`)

**Prompt doesn't generate output**
- Ensure `agent: agent` is in frontmatter for prompts
- Check that it has at least one tool (usually `read` or `execute`)
- Verify the task is clear in the first paragraph

**Agent asks questions but doesn't proceed**
- Confirm you have "Wait for user confirmation" or equivalent approval gate
- Check phase structure is clear
- Test with a simple yes/no response

