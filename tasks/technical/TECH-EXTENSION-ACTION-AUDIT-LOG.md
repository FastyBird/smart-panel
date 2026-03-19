# Task: Action Execution History & Audit Trail

ID: TECH-EXTENSION-ACTION-AUDIT-LOG
Type: technical
Scope: backend, admin
Size: small
Parent: EPIC-EXTENSION-ACTIONS
Status: planned

## 1. Business goal

In order to track what operations were performed on the system and by whom,
As a system owner,
I want a log of executed extension actions including who triggered them, when, what parameters were used, and the outcome.

## 2. Context

Extension actions can modify system state significantly (load scenarios, change device states, trigger updates). An audit trail helps with debugging, accountability, and understanding what changed.

**Existing patterns:**
- `apps/backend/src/common/logger/` — Extension logger service (ring buffer)
- `apps/backend/src/modules/extensions/` — Extensions module

## 3. Scope

**In scope**

- `ActionExecutionRecord` entity — stores: extensionType, actionId, userId, params, result, timestamp, duration
- In-memory ring buffer (last N executions) — no database dependency initially
- `GET /extensions/:type/actions/:actionId/history` — List recent executions
- Admin UI: expandable history section per action card
- Both immediate and interactive session completions are logged

**Out of scope**

- Database persistence (can be added later)
- Search/filter across all extensions
- Export/download audit logs
- Real-time audit log streaming

## 4. Acceptance criteria

- [ ] Action executions are recorded with user, params, result, and timing
- [ ] REST endpoint returns recent execution history per action (last 50)
- [ ] Admin UI shows collapsible history section on action cards
- [ ] History entries show: timestamp, user, success/failure, duration, message
- [ ] Ring buffer limits memory usage (configurable, default 1000 total entries)
- [ ] Interactive session completions are also recorded

## 5. Technical constraints

- In-memory only for v1 (no database migration required)
- Ring buffer with configurable max size
- Must not impact action execution performance
- Follow existing response model patterns

## 6. AI instructions

- Read this file entirely before making any code changes
- Keep it simple — in-memory ring buffer, no database
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
