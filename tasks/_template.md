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
