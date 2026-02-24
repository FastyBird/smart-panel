# Task: Admin buddy settings page

ID: FEATURE-BUDDY-ADMIN-MODULE
Type: feature
Scope: admin
Size: small
Parent: EPIC-BUDDY-MODULE
Status: planned

## 1. Business goal

In order to configure the AI buddy capabilities,
As a system administrator,
I want a settings page in the admin UI where I can enable/disable the buddy, select the AI provider, and configure API keys.

## 2. Context

- Depends on FEATURE-BUDDY-BACKEND-FOUNDATION (config DTO and model must exist).
- Follow existing admin module patterns from `apps/admin/src/modules/` (e.g., `weather`, `security`).
- Admin modules typically have: store (Pinia), pages (Vue components), and router registration.
- Configuration is managed through the backend `ConfigModule` — the admin reads config via `GET /v1/modules/config/{module}` and updates via `PATCH /v1/modules/config/{module}`.

## 3. Scope

**In scope**

- Admin `buddy` module:
  - Store (Pinia) for buddy configuration state
  - Settings page component
  - Router registration
- Settings page features:
  - Enable/disable buddy toggle
  - AI provider selector (Claude, OpenAI, Ollama, None)
  - API key input (password field, shown as masked)
  - Model name input (e.g., `claude-sonnet-4-5-20250514`, `gpt-4o`, `llama3`)
  - Ollama endpoint URL (shown only when provider = Ollama)
  - Suggestion cooldown duration setting
  - Action history buffer size setting
  - Save button with success/error feedback
- Sidebar navigation entry for "Buddy" under modules section

**Out of scope**

- Conversation management in admin (→ Phase 4: FEATURE-BUDDY-CHANNEL-ADMIN-CHAT)
- Suggestion management in admin
- Real-time status monitoring
- API key validation/testing

## 4. Acceptance criteria

- [ ] Buddy module registered in admin app router with a sidebar entry
- [ ] Settings page loads current buddy configuration from backend config API
- [ ] Enable/disable toggle updates `enabled` field in buddy config
- [ ] Provider dropdown shows: Claude, OpenAI, Ollama, None — updates `provider` field
- [ ] API key field is a password input (masked by default, with show/hide toggle) — updates `apiKey` field
- [ ] Model field is a text input — updates `model` field
- [ ] Ollama URL field appears only when provider is `ollama` — updates `ollamaUrl` field
- [ ] Save button calls `PATCH /v1/modules/config/buddy-module` with the updated config
- [ ] Success message shown on save; error message shown on failure
- [ ] Page follows existing admin UI styling and layout patterns

## 5. Example scenarios

### Scenario: Configure Claude as provider

Given the admin navigates to Buddy settings
When they select "Claude" as provider
And enter an API key "sk-ant-..."
And set model to "claude-sonnet-4-5-20250514"
And click Save
Then the config is updated in the backend
And a success toast appears

### Scenario: Switch to Ollama

Given the admin has Claude configured
When they change provider to "Ollama"
Then the Ollama URL field appears (pre-filled with `http://localhost:11434`)
And the API key field is hidden (Ollama doesn't need one)
When they click Save
Then the config is updated

## 6. Technical constraints

- Follow admin module patterns: Pinia store + Vue SFC + router
- Use existing admin API client for config read/write
- Follow existing form patterns (input components, validation, save flow)
- Do not modify generated code (`openapi.constants.ts`)
- Do not introduce new npm dependencies

## 7. Implementation hints

- **Store pattern**: Follow `apps/admin/src/modules/weather/stores/` for Pinia store with config loading
- **Page pattern**: Follow `apps/admin/src/modules/weather/pages/` or `apps/admin/src/modules/security/pages/` for settings page layout
- **Router pattern**: Add route in the admin router configuration, following existing module route entries
- **Config API**: Use the existing config module API pattern:
  - `GET /v1/modules/config/buddy-module` → returns `BuddyConfigModel`
  - `PATCH /v1/modules/config/buddy-module` → body: `UpdateBuddyConfigDto`
- **Conditional field display**: Use `v-if` or `v-show` for provider-specific fields (e.g., Ollama URL only when provider = ollama)

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to admin only.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Depends on FEATURE-BUDDY-BACKEND-FOUNDATION — config model and DTO must exist.
