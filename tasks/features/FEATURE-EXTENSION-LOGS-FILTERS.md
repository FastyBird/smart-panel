# Task: Add Level and Time Range Filters to Extension Logs
ID: FEATURE-EXTENSION-LOGS-FILTERS
Type: feature
Scope: admin
Size: small
Parent: FEATURE-UNIFIED-EXTENSION-LOGS
Status: planned

## 1. Business goal

In order to troubleshoot extension issues more efficiently
As an administrator
I want to filter extension logs by level (info, warn, error, debug) and time range

## 2. Context

- Extension logs tab was implemented in FEATURE-UNIFIED-EXTENSION-LOGS
- Current implementation shows all logs without filtering options
- Level filter and time range were deferred for basic implementation first

## 3. Scope

**In scope**

- Add log level filter dropdown (info, warn, error, debug) to extension logs tab
- Add time range or "last N entries" option
- Reuse existing filter patterns from system logs view if applicable

**Out of scope**

- Backend API changes (filtering already supported)
- Real-time log streaming

## 4. Acceptance criteria

- [ ] Level filter dropdown allows selecting: All, Info, Warn, Error, Debug
- [ ] Time range selector with presets (Last 1h, 6h, 24h, 7d) or custom
- [ ] Filters persist during the session
- [ ] Clear filters button resets to defaults
- [ ] Loading state shown while applying filters

## 5. Technical constraints

- Reuse existing admin UI patterns and components
- Follow ElementPlus component conventions
- Do not modify generated code

## 6. AI instructions

- Read this file entirely before making any code changes.
- Keep changes scoped to admin extension logs components.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
