# Task: Panel model validation, timer precision, and voice state

ID: TECH-BUDDY-PANEL-ROBUSTNESS
Type: technical
Scope: panel
Size: small
Parent: EPIC-BUDDY-HARDENING
Status: planned

## 1. Business goal

In order to prevent crashes and subtle bugs in the panel buddy UI,
As a home operator using the wall panel,
I want the buddy chat and voice features to handle edge cases gracefully.

## 2. Context

- Panel model factories (`fromJson`) do not null-check required fields like `id`, `role`, `content`. A malformed API response can cause unhandled cast exceptions.
- `AudioRecordingService` tracks recording duration by accumulating 100ms timer increments, which drifts over time (each tick's callback scheduling delay accumulates).
- Voice auto-play state (`_voiceModeActive`, `_lastAutoPlayedMessageId`) is managed as scattered state variables in `BuddyChatPage` rather than a dedicated state class.
- `BuddySuggestionModel.fromJson` defaults `createdAt` to `DateTime.now()` when missing, which is misleading for display purposes.
- Audio error detection in the repository relies on string matching against response messages to distinguish STT vs LLM errors.

### Impact

| Issue | Severity | User impact |
|-------|----------|-------------|
| Missing JSON field → crash | Medium | App crash on malformed API response |
| Timer drift | Low | Recording duration display slightly wrong |
| Scattered voice state | Low | Maintenance burden, potential state bugs |
| Misleading timestamps | Low | Suggestions show wrong creation time |
| String-based error detection | Medium | Wrong error type shown to user |

## 3. Scope

**In scope**

- Add null-safety guards to all model `fromJson` factories
- Replace timer-accumulation with `startTime`-based duration tracking in `AudioRecordingService`
- Extract voice auto-play state to a small dedicated class
- Fix `BuddySuggestionModel.fromJson` to throw or use a sentinel for missing timestamps
- Improve audio error detection to use HTTP status codes instead of string matching

**Out of scope**

- Redesigning the buddy chat page layout
- Adding new voice features
- Changes to the API client (generated code)
- Full unit test suite for all panel buddy widgets

## 4. Acceptance criteria

- [ ] All model `fromJson` factories handle missing required fields gracefully (default values or explicit error)
- [ ] `AudioRecordingService` duration tracking uses `DateTime.now().difference(startTime)` instead of accumulating increments
- [ ] Voice auto-play state extracted to `VoiceAutoPlayState` class used by `BuddyChatPage`
- [ ] `BuddySuggestionModel.fromJson` does not silently default `createdAt` to `DateTime.now()`
- [ ] Audio error detection uses HTTP status codes (503 for provider not configured, 504 for timeout) instead of response message string matching
- [ ] No regressions in existing buddy chat and voice functionality

## 5. Example scenarios

### Scenario: Malformed API response

Given the backend returns a message with `content: null` (due to a bug)
When the panel parses the response via `BuddyMessageModel.fromJson`
Then the message is created with `content: ''` (empty string default)
And no exception is thrown

### Scenario: Recording duration accuracy

Given the user records a 30-second voice message
When the recording timer updates the UI
Then the displayed duration is accurate to within 100ms of actual elapsed time
And does not drift due to timer callback scheduling delays

## 6. Technical constraints

- Follow existing Dart model patterns in `apps/panel/lib/modules/buddy/models/`
- Do not modify generated API client code
- Use package imports only (no relative imports)
- Follow snake_case file naming convention

## 7. Implementation hints

- For JSON safety:
  ```dart
  factory BuddyMessageModel.fromJson(Map<String, dynamic> json) {
    return BuddyMessageModel(
      id: json['id'] as String? ?? '',
      role: json['role'] as String? ?? 'assistant',
      content: json['content'] as String? ?? '',
      // ...
    );
  }
  ```
- For timer precision:
  ```dart
  DateTime? _recordingStartTime;

  Duration get recordingDuration =>
    _recordingStartTime != null
      ? DateTime.now().difference(_recordingStartTime!)
      : Duration.zero;
  ```
- For voice state extraction:
  ```dart
  class VoiceAutoPlayState {
    bool isActive = false;
    String? lastAutoPlayedMessageId;

    bool shouldAutoPlay(String messageId) {
      if (!isActive) return false;
      if (messageId == lastAutoPlayedMessageId) return false;
      lastAutoPlayedMessageId = messageId;
      return true;
    }
  }
  ```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
