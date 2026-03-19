# Task: Interactive Session Protocol & WebSocket Gateway

ID: FEATURE-INTERACTIVE-SESSION-PROTOCOL
Type: feature
Scope: backend
Size: medium
Parent: EPIC-EXTENSION-ACTIONS
Status: planned

## 1. Business goal

In order to run complex, multi-step operations with real-time feedback,
As a Smart Panel administrator,
I want a WebSocket-based interactive session system where the server can send prompts, stream progress, and I can respond — like a terminal in the browser.

## 2. Context

Phase 1 (FEATURE-EXTENSION-ACTIONS-MVP) established immediate actions with flat forms. However, many operations need richer interaction:

- **Simulator scenario loading**: preview rooms/devices count → confirm truncate → show progress → report results
- **System updates**: check version → confirm update → stream download/install progress → report restart
- **Future marketplace**: resolve dependencies → confirm install → stream progress → report completion

These all follow the same pattern: **server-driven conversation with progress streaming**.

**Existing infrastructure:**
- `apps/backend/src/modules/websocket/` — WebSocket gateway with event distribution
- `apps/backend/src/modules/extensions/services/extension-action.interface.ts` — `ActionMode` already has `'interactive'`

**Inspiration:**
- Home Assistant supervisor terminal/logs
- Docker build output streaming
- SSH/terminal emulators in web UIs

## 3. Scope

**In scope**

- Interactive session protocol definition (message types, lifecycle)
- `InteractiveSessionGateway` — WebSocket handler for sessions
- `InteractiveSessionService` — Session lifecycle management (create, message, complete, timeout)
- `IInteractiveSessionHandler` interface — Extensions implement this for interactive actions
- Session state machine: `idle → running → awaiting_input → running → completed/failed`
- Progress message types: `prompt`, `progress`, `output`, `error`, `complete`
- Input message types: `response`, `cancel`
- Session timeout and cleanup
- Session reconnection support (client can reconnect to running session)

**Out of scope**

- Admin UI terminal component (separate task: FEATURE-INTERACTIVE-SESSION-ADMIN-UI)
- Specific session consumers (separate tasks per consumer)
- Persistent session history (separate task: TECH-EXTENSION-ACTION-AUDIT-LOG)
- Multi-user concurrent sessions on same action

## 4. Acceptance criteria

- [ ] `IInteractiveSessionHandler` interface defined with `onStart()`, `onInput()`, `onCancel()` methods
- [ ] `InteractiveSessionService` manages session lifecycle with unique session IDs
- [ ] WebSocket events: `session:start`, `session:prompt`, `session:progress`, `session:output`, `session:complete`, `session:error`
- [ ] Client events: `session:open`, `session:respond`, `session:cancel`
- [ ] Sessions timeout after configurable inactivity period (default: 5 minutes)
- [ ] Client can reconnect to a running session and receive buffered output
- [ ] `ExtensionActionRegistryService` updated to support interactive action handlers
- [ ] Session state tracked in memory with proper cleanup
- [ ] Proper error handling: handler crash doesn't crash the gateway
- [ ] Unit tests for session lifecycle and state transitions

## 5. Example scenarios

### Scenario: Basic interactive session

Given a simulator plugin with an interactive "Load Scenario" action
When the admin opens the session via WebSocket
Then the server sends a prompt: "Select scenario" with options
When the admin responds with "smart-house"
Then the server sends a prompt: "Truncate existing devices? (12 found)"
When the admin responds with "yes"
Then the server streams progress messages: "Creating rooms...", "Creating devices (1/15)...", etc.
Then the server sends a complete message with summary

### Scenario: Session timeout

Given a running interactive session awaiting input
When the admin does not respond for 5 minutes
Then the session is marked as timed out
And the server sends an error message: "Session timed out"
And resources are cleaned up

### Scenario: Client reconnection

Given a running interactive session streaming progress
When the admin's WebSocket disconnects and reconnects
Then the client sends `session:reconnect` with the session ID
Then the server replays buffered output since disconnect
And the session continues normally

## 6. Technical constraints

- Use existing WebSocket gateway patterns from `apps/backend/src/modules/websocket/`
- Sessions must be memory-only (no database persistence for running sessions)
- Session output buffer limited to prevent memory leaks (ring buffer, max 1000 messages)
- Handler execution must be isolated (try/catch, no unhandled promise rejections)
- Protocol must be JSON-based for easy client implementation
- Session IDs must be UUIDs

## 7. Implementation hints

**Session protocol messages:**

```typescript
// Server → Client
interface SessionPromptMessage {
  type: 'prompt';
  sessionId: string;
  promptId: string;
  promptType: 'select' | 'confirm' | 'input' | 'multi_select';
  label: string;
  description?: string;
  options?: { label: string; value: string }[];
  default?: string | boolean;
}

interface SessionProgressMessage {
  type: 'progress';
  sessionId: string;
  message: string;
  percent?: number; // 0-100
  step?: string;    // e.g., "Creating devices"
  current?: number; // e.g., 5
  total?: number;   // e.g., 15
}

interface SessionOutputMessage {
  type: 'output';
  sessionId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
}

interface SessionCompleteMessage {
  type: 'complete';
  sessionId: string;
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

// Client → Server
interface SessionOpenMessage {
  type: 'open';
  extensionType: string;
  actionId: string;
}

interface SessionRespondMessage {
  type: 'respond';
  sessionId: string;
  promptId: string;
  value: unknown;
}

interface SessionCancelMessage {
  type: 'cancel';
  sessionId: string;
}
```

**Handler interface:**

```typescript
interface IInteractiveSessionHandler {
  onStart(session: ISessionContext): Promise<void>;
  onInput(session: ISessionContext, promptId: string, value: unknown): Promise<void>;
  onCancel(session: ISessionContext): Promise<void>;
}

interface ISessionContext {
  sessionId: string;
  prompt(options: PromptOptions): Promise<unknown>;
  progress(message: string, percent?: number): void;
  output(message: string, level?: string): void;
  complete(result: ActionResult): void;
  fail(message: string): void;
}
```

## 8. AI instructions

- Read this file entirely before making any code changes
- Start by replying with a short implementation plan (max 10 steps)
- Study existing WebSocket gateway patterns in `apps/backend/src/modules/websocket/`
- Keep the protocol simple — it can be extended later
- Focus on correctness of session state machine
- Write unit tests for session lifecycle
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
