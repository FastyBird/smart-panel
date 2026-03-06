# Task: Personality configuration

ID: FEATURE-BUDDY-CHANNEL-PERSONALITY
Type: feature
Scope: backend
Size: small
Parent: EPIC-BUDDY-MODULE
Status: done

## 1. Business goal

In order to make the buddy feel personal and match my preferences,
As a home operator,
I want to customise the buddy's personality — tone, style, name, and behavioral preferences — via a configuration file.

## 2. Context

- Depends on Phase 1 conversation API.
- Inspired by OpenClaw's `SOUL.md` concept — a markdown file that defines the AI agent's personality.
- The personality file is read by the backend and included in the LLM system prompt.
- This is a lightweight feature — just reading a file and injecting it into the prompt.

## 3. Scope

**In scope**

- `personality.md` file support:
  - Located at configurable path (default: `var/buddy/personality.md`)
  - Read once at startup and cached, re-read on config change
  - Injected into LLM system prompt after the home context
- Default personality if no file exists:
  ```
  You are a helpful smart home assistant. Be concise, friendly, and practical.
  Focus on actionable suggestions. Use simple language.
  ```
- Admin UI: textarea to edit personality inline (saves to the file)
- Buddy name configuration (default: "Buddy", used in greetings and UI labels)

**Out of scope**

- Per-user personalities
- Personality marketplace
- Voice tone matching (TTS voice ≠ personality)
- Multi-language personality files

## 4. Acceptance criteria

- [x] Backend reads `personality.md` from configured path at startup
- [x] Personality text is included in LLM system prompt
- [x] If file doesn't exist, uses sensible default personality
- [x] Admin settings page includes a textarea for editing personality
- [x] Saving personality in admin writes to the file and refreshes the cached version
- [x] Buddy name is configurable in buddy config and used in API responses
- [x] Changes take effect on next conversation (no restart needed)

## 5. Example scenarios

### Scenario: Custom personality

Given the admin has written a personality file:
```
You are Alfred, a dignified butler-style assistant. Address the operator as "Sir" or "Madam".
Speak formally but warmly. When making suggestions, phrase them as polite offers.
```
When the operator asks "What's the temperature?"
Then Alfred responds: "Sir, the living room is currently a comfortable 22°C. Shall I adjust the thermostat?"

## 6. Technical constraints

- File path must be configurable (for Docker deployments)
- File reading is async, cached in memory
- Personality text limited to 2000 characters (to preserve LLM context window)
- UTF-8 encoding

## 7. Implementation hints

- Use `fs.readFile` with error handling (file may not exist)
- Cache with a `FileWatcher` or simple re-read interval (60s)
- Admin: `PATCH /v1/modules/buddy/personality` with `{ content: "..." }` endpoint
- Include personality at the start of the system prompt, before home context

## 8. AI instructions

- Read this file entirely before making any code changes.
- Keep changes scoped to backend and admin.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
