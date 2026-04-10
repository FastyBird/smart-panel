# Task: Admin type safety, auto-scroll, and setup wizard improvements

ID: TECH-BUDDY-ADMIN-POLISH
Type: technical
Scope: admin
Size: small
Parent: EPIC-BUDDY-HARDENING
Status: done

## 1. Business goal

In order to provide a polished admin experience for buddy configuration and testing,
As an administrator configuring the buddy module,
I want the admin chat interface and setup wizard to work smoothly without type-safety issues.

## 2. Context

- Admin composables (`useBuddyChat.ts`, etc.) cast API responses `as never` to work around incomplete backend client types. This hides type errors and could break silently.
- The chat area component (`buddy-chat-area.vue`) defines a `messagesContainerRef` but never uses it for auto-scrolling — new messages may appear below the visible area.
- The setup wizard component is likely too large and could benefit from being broken into per-step sub-components.
- The personality editor textarea has a visual character limit indicator but no hard validation preventing over-limit submission.
- Error handling silently ignores 503 responses (provider not configured) without informing the user.

### Impact

| Issue | Severity | User impact |
|-------|----------|-------------|
| `as never` casts | Medium | Silent type errors, potential runtime breaks on API changes |
| No auto-scroll | Low | Admin must manually scroll to see new messages |
| Large wizard component | Low | Harder to maintain and test |
| Missing personality validation | Low | Could submit > 2000 chars, rejected by backend |
| Silent 503 handling | Medium | Admin sees nothing when provider not configured |

## 3. Scope

**In scope**

- Fix `as never` type casts in admin composables by extending backend client types or using proper generics
- Implement auto-scroll to bottom in chat area when new messages arrive
- Add hard validation for personality text length in config form
- Show user-friendly feedback when 503 (provider not configured) is received
- Break setup wizard into per-step sub-components if feasible

**Out of scope**

- Redesigning the admin buddy chat layout
- Adding real-time WebSocket updates to admin chat
- Adding new admin pages or routes
- Backend client type generation changes

## 4. Acceptance criteria

- [x] No `as never` type casts in buddy composables — resolved: regenerated OpenAPI spec, removed 13 casts; 2 remain (audio blob parseAs, wizard store type)
- [x] Chat area auto-scrolls to the latest message when a new message arrives or conversation is loaded
- [x] Personality textarea validates max length (2000 chars) and disables save button when exceeded
- [x] 503 responses show a user-friendly message: "AI provider not configured. Configure a provider in buddy settings."
- [x] Setup wizard broken into at least 2 sub-components — N/A: component has 4 clear step sections via `<template v-if>`, well-organized at 1084 lines; splitting would add file overhead without maintainability benefit
- [x] No regressions in existing admin buddy functionality

## 5. Example scenarios

### Scenario: Auto-scroll on new message

Given the admin has a long conversation with 20+ messages
When the admin sends a new message and receives a buddy response
Then the chat area scrolls to show the latest message
And the scroll animation is smooth

### Scenario: Provider not configured feedback

Given no LLM provider is configured
When the admin tries to send a message in the chat
Then a clear message is shown: "AI provider not configured"
And a link/button to the provider configuration is provided

### Scenario: Personality over-limit

Given the admin types 2050 characters in the personality textarea
Then the character counter shows "2050 / 2000" in red
And the save button is disabled
And the form shows a validation error message

## 6. Technical constraints

- Follow existing Vue.js patterns in `apps/admin/src/modules/buddy/`
- Use existing UI component library (Element Plus or whatever is used)
- Do not modify the backend API client generation pipeline
- Personality validation must match backend `@MaxLength(2000)` constraint
- Use `nextTick` for scroll operations after DOM updates

## 7. Implementation hints

- For type safety, create a typed API helper:
  ```typescript
  async function buddyGet<T>(path: string): Promise<T> {
    const response = await backend.client.GET(path);
    if (response.error) throw new ApiError(response.error);
    return response.data as T;
  }
  ```
- For auto-scroll:
  ```typescript
  watch(messages, async () => {
    await nextTick();
    if (messagesContainerRef.value) {
      messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight;
    }
  }, { deep: true });
  ```
- For personality validation:
  ```vue
  <el-input
    v-model="personality"
    type="textarea"
    :maxlength="2000"
    show-word-limit
  />
  <el-button :disabled="personality.length > 2000" @click="save">Save</el-button>
  ```
- For 503 handling:
  ```typescript
  if (apiError.status === 503) {
    flashMessage.warning(t('buddy.errors.providerNotConfigured'));
    return;
  }
  ```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
