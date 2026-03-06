# Task: Admin web chat interface

ID: FEATURE-BUDDY-CHANNEL-ADMIN-CHAT
Type: feature
Scope: admin
Size: small
Parent: EPIC-BUDDY-MODULE
Status: done

## 1. Business goal

In order to test and interact with the buddy from the admin interface,
As a system administrator,
I want a chat widget embedded in the admin buddy settings page where I can converse with the buddy.

## 2. Context

- Depends on Phase 1 (admin buddy module and backend conversation API).
- Reuses the same backend conversation endpoints as the panel.
- Simpler UI than the panel — a basic chat widget embedded in the admin settings page.

## 3. Scope

**In scope**

- Chat widget component (Vue) embedded in buddy admin settings page
- Conversation list sidebar (collapsible)
- Message display area with user/assistant bubbles
- Text input with send button
- Create new conversation / switch between conversations
- Delete conversation
- Real-time updates via polling (admin doesn't use WebSocket)

**Out of scope**

- Voice input in admin
- Suggestion management in admin
- WebSocket integration (admin uses REST polling)

## 4. Acceptance criteria

- [x] Chat widget visible on buddy admin settings page below the configuration form
- [x] Can create new conversations and switch between existing ones
- [x] Messages display as styled bubbles (user right, assistant left)
- [x] Send button and Enter key submit messages
- [x] Loading indicator while waiting for response
- [x] Can delete conversations
- [x] Poll for new messages every 3 seconds when a conversation is active
- [x] Follows existing admin UI styling

## 5. Example scenarios

### Scenario: Admin tests the buddy

Given the admin has configured Claude as the AI provider
When they type "List all rooms and their devices" in the admin chat
Then the buddy responds with the full room/device inventory
And the admin can verify the context is correct

## 6. Technical constraints

- Vue SFC component following admin patterns
- Use existing admin API client for buddy endpoints
- Polling (not WebSocket) for simplicity — admin sessions are short-lived
- Keep bundle size impact minimal

## 7. Implementation hints

- Embed below the settings form with a collapsible section header "Test Chat"
- Simple `setInterval` poll for messages when conversation is active
- Stop polling when component is unmounted or conversation is inactive

## 8. AI instructions

- Read this file entirely before making any code changes.
- Keep changes scoped to admin only.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
