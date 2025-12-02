# Tasks

This directory contains **task specifications** for the Smart Panel project.

Tasks are written as Markdown files and represent:
- Features
- Technical refactors
- Bugs
- Chores

They are meant to be:
- Human-readable
- Easy to reference in PRs
- Usable by AI assistants (Cursor, Claude, ChatGPT, etc.) as implementation context

## Task Format

Each task file should follow the shared template, for example:

```md
# Task: <Short title>
ID: <TYPE-SOMETHING-UNIQUE>   <!-- e.g. FEATURE-SHELLY-GEN1 -->
Type: feature | technical | bug | chore
Scope: backend | admin | panel | backend, admin | backend, admin, panel
Size: tiny | small | medium | large
Parent: (none) | <ID of parent task>
Status: planned | in-progress | review | done

## 1. Business goal

In order to ...
As a ...
I want to ...
Open Preview to the Side
## 2. Context

- Existing code, modules, plugins to use as reference.
- Links to inspiration (e.g. Homebridge plugin, Shelly NG plugin).
- Any constraints or legacy behavior that must be preserved.

## 3. Scope

**In scope**

- ...

**Out of scope**

- ...

## 4. Acceptance criteria

- [ ] ...
- [ ] ...
- [ ] ...

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: ...

Given ...  
When ...  
Then ...

## 6. Technical constraints

- Follow the existing module / service structure in ...
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.

## 7. Implementation hints (optional)

- Look at ...
- Reuse ...
- Avoid ...

## 8. AI instructions (for Junie / AI)

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
```

## Naming & Organization

- Use one file per task, e.g.:
  - `FEATURE-backend-openapi-source.md`
  - `TECHNICAL-devices-module-refactor.md`
  - `BUG-auth-token-refresh.md`
  - `CHORE-cleanup-old-config.md`
- Optionally group by area:

  - `backend/FEATURE-...`
  - `admin/FEATURE-...`
  - `panel/FEATURE-...`

## Workflow

Recommended workflow:

1. Create or update a task in `/tasks/`.
2. Reference the task ID in your branch name and PR title, e.g.:
   - Branch: `feature/FEATURE-backend-openapi-source`
   - PR: `[FEATURE-backend-openapi-source] Backend as source of truth for OpenAPI`
3. In the PR description, link the task file and describe what is done vs. what remains.
4. Update `Status` in the task file as work progresses:
   - `planned` → `in-progress` → `review` → `done`.

## Intended Audience

- Maintainers and contributors planning work
- AI assistants used to implement or refactor code based on these specs

## Related Directories

- `/.architecture/` – long-lived architecture & API documentation
- `/.ai-rules/` – global rules and constraints for AI assistants
- `/docs/` – public-facing documentation / presentation website for Smart Panel
