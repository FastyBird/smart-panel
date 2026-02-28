# Task: Panel buddy module (chat drawer + suggestion cards)

ID: FEATURE-BUDDY-PANEL-MODULE
Type: feature
Scope: panel
Size: medium
Parent: EPIC-BUDDY-MODULE
Status: done

## 1. Business goal

In order to interact with the AI buddy directly on the wall panel,
As a home operator,
I want a chat drawer where I can type questions and see responses, plus dismissible suggestion cards when the buddy has recommendations.

## 2. Context

- Depends on FEATURE-BUDDY-BACKEND-CONVERSATION and FEATURE-BUDDY-BACKEND-SUGGESTIONS (backend APIs must exist).
- Follow existing panel module patterns from `apps/panel/lib/modules/` (e.g., `intents`, `scenes`, `weather`).
- Each panel module has: `module.dart` (GetIt DI setup), `constants.dart`, `export.dart`, repositories (API calls), services (business logic proxy), models (data classes), and presentation (widgets/pages).
- The panel already has a deck UI with page navigation. The buddy chat drawer should be accessible from the deck overlay or a dedicated entry point (FAB button or bottom nav icon).
- WebSocket events for `BuddyModule.Suggestion.Created` and `BuddyModule.Conversation.MessageReceived` should be handled by the buddy repository to update state reactively.

## 3. Scope

**In scope**

- Panel `buddy` module:
  - `module.dart` — GetIt dependency injection registration
  - `constants.dart` — module name, event type strings
  - `export.dart` — public API re-exports
- Models:
  - `BuddyConversationModel` — conversation data class
  - `BuddyMessageModel` — message data class (role, content, timestamp)
  - `BuddySuggestionModel` — suggestion data class (type, title, reason, spaceId)
- Repository:
  - `BuddyRepository` — API calls to backend buddy endpoints, WebSocket event handling
  - Manages conversation list, active conversation messages, active suggestions
  - Reactively updates when WebSocket events arrive
- Service:
  - `BuddyService` — proxy service as single source of truth for buddy state
- Presentation:
  - `BuddyChatDrawer` — sliding drawer with message list + input field
  - `MessageBubble` — widget for user and assistant message bubbles
  - `BuddySuggestionCard` — dismissible card for suggestions
  - `BuddySuggestionBadge` — notification badge (count of active suggestions)
- Integration with deck UI: entry point to open buddy drawer

**Out of scope**

- Voice input/output (→ Phase 3)
- Rich media in messages (images, charts)
- Suggestion action execution in panel (accept just sends feedback to backend)
- Offline chat mode

## 4. Acceptance criteria

- [x] `buddy` module registered in panel module initialisation (GetIt)
- [x] `BuddyRepository` makes API calls to all buddy backend endpoints:
  - List conversations
  - Create conversation
  - Get conversation with messages
  - Send message
  - Delete conversation
  - List suggestions
  - Submit suggestion feedback
- [x] `BuddyRepository` subscribes to WebSocket events:
  - `BuddyModule.Suggestion.Created` → adds suggestion to active list
  - `BuddyModule.Conversation.MessageReceived` → adds message to active conversation
- [x] `BuddyChatDrawer` is a sliding panel (from right edge) with:
  - Header with title ("Buddy") and close button
  - Scrollable message list (newest at bottom, auto-scroll on new message)
  - Text input field with send button
  - Loading indicator while waiting for AI response
  - Empty state when no messages ("Ask me anything about your home!")
- [x] `MessageBubble` renders user messages (right-aligned, primary color) and assistant messages (left-aligned, surface color) with timestamps
- [x] `BuddySuggestionCard` displays: title, reason, accept button, dismiss button
  - Accept calls `POST /suggestions/:id/feedback` with `applied`
  - Dismiss calls `POST /suggestions/:id/feedback` with `dismissed`
  - Card animates out on feedback
- [x] `BuddySuggestionBadge` shows count of active suggestions (0 = hidden)
- [x] Buddy drawer is accessible from the deck UI (FAB button or navigation entry)
- [x] When AI provider is not configured, chat input shows disabled state with message "AI provider not configured"
- [x] Handles API errors gracefully (network errors, timeouts) with user-friendly messages

## 5. Example scenarios

### Scenario: Chat interaction

Given the operator taps the buddy button on the deck
When the chat drawer slides open
Then it shows the empty state message
When the operator types "Are any lights on?" and taps send
Then a user message bubble appears (right-aligned)
And a loading indicator shows below it
When the backend responds
Then an assistant message bubble appears with the response
And the loading indicator disappears

### Scenario: Suggestion notification

Given the buddy detects a repeated pattern
When a `BuddyModule.Suggestion.Created` WebSocket event arrives
Then the suggestion badge count increases
And a new suggestion card appears in the suggestions section of the drawer
When the operator taps "Dismiss"
Then the card animates out and is removed from the list

## 6. Technical constraints

- Follow panel module patterns: `module.dart` for DI, repository + service + presentation separation
- Use package imports only (no relative `../` imports)
- `snake_case` file names, `PascalCase` class names
- Use existing API client patterns for HTTP calls
- Use existing WebSocket integration for event subscription
- Do not modify generated code in `apps/panel/lib/api/` or `apps/panel/lib/spec/`
- Drawer should be responsive to panel display sizes (typically 800x480 or 1024x600)
- Do not introduce new Dart/Flutter dependencies unless absolutely necessary

## 7. Implementation hints

- **Module registration**: Follow `apps/panel/lib/modules/intents/module.dart` for GetIt setup pattern
- **Repository pattern**: Follow `apps/panel/lib/modules/intents/repositories/` for API + WebSocket integration
- **Service pattern**: Follow `apps/panel/lib/modules/intents/services/` for proxy service
- **Drawer widget**: Use Flutter `Drawer` or `showModalBottomSheet` / custom `AnimatedContainer` that slides in from the right
- **Message list**: Use `ListView.builder` with `reverse: true` for bottom-anchored scrolling
- **Suggestion cards**: Use `Dismissible` widget or custom animated card
- **State management**: Repository manages state, service proxies it — listeners/ValueNotifier for UI reactivity
- **API error handling**: Show `SnackBar` or inline error message — follow existing error patterns in the panel

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to panel only.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Depends on FEATURE-BUDDY-BACKEND-CONVERSATION and FEATURE-BUDDY-BACKEND-SUGGESTIONS — backend API must be available.
