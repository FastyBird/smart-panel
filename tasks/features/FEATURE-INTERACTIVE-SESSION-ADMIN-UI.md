# Task: Interactive Session Terminal UI Component

ID: FEATURE-INTERACTIVE-SESSION-ADMIN-UI
Type: feature
Scope: admin
Size: medium
Parent: EPIC-EXTENSION-ACTIONS
Status: planned

## 1. Business goal

In order to interact with long-running extension operations,
As a Smart Panel administrator,
I want a terminal-like UI component in the admin app that renders prompts, collects my input, shows streaming progress, and displays operation results.

## 2. Context

The backend interactive session protocol (FEATURE-INTERACTIVE-SESSION-PROTOCOL) provides WebSocket-based server-driven conversations. This task builds the admin UI that connects to those sessions.

**Existing patterns:**
- `apps/admin/src/modules/extensions/components/extension-logs.vue` — Live log streaming via WebSocket (pattern for WS connection management)
- `apps/admin/src/modules/extensions/components/extension-actions.vue` — Existing actions panel (will be enhanced to support interactive mode)
- Element Plus components: `el-dialog`, `el-input`, `el-select`, `el-progress`, `el-timeline`

**Design concept:**
- Actions with `mode: 'interactive'` show an "Open" button instead of a form
- Clicking opens a dialog/panel with a terminal-like interface
- Server messages render as timestamped log entries
- Prompts render as inline forms within the terminal output
- Progress shows as animated progress bars
- Completion shows a summary card

## 3. Scope

**In scope**

- `SessionTerminal` Vue component — renders session output stream
- `SessionPrompt` component — inline prompt renderer (select, confirm, input, multi_select)
- `SessionProgress` component — progress bar with step info
- `useInteractiveSession` composable — WebSocket connection, message handling, state management
- Integration with `extension-actions.vue` — interactive actions open terminal dialog
- Session reconnection handling on page reload / WebSocket disconnect
- Responsive layout (full-screen on mobile, dialog on desktop)

**Out of scope**

- Custom theming/colors for terminal output
- Copy-to-clipboard for terminal content
- Session history browser (separate task)
- Resizable terminal panel

## 4. Acceptance criteria

- [ ] `SessionTerminal` component renders a scrollable output area with timestamped messages
- [ ] Server `output` messages display with log level coloring (info=default, warn=yellow, error=red)
- [ ] Server `prompt` messages render inline form controls matching prompt type
- [ ] Server `progress` messages show animated progress bar with step info
- [ ] Server `complete` message shows success/error summary card
- [ ] User can respond to prompts via inline form controls
- [ ] User can cancel a running session
- [ ] Terminal auto-scrolls to bottom on new messages (with scroll-lock when manually scrolled up)
- [ ] `useInteractiveSession` composable manages WebSocket lifecycle
- [ ] Actions with `mode: 'interactive'` show "Open Terminal" button in actions list
- [ ] Dialog/panel properly handles WebSocket disconnect with reconnect attempt
- [ ] Responsive: dialog on desktop, full-screen on mobile
- [ ] Loading state shown while session is initializing

## 5. Example scenarios

### Scenario: Opening an interactive action

Given the simulator plugin has an interactive "Load Scenario" action
When I click "Open Terminal" next to the action
Then a dialog opens with a terminal-like interface
And the first server prompt appears: "Select scenario" with a dropdown

### Scenario: Responding to prompts and seeing progress

Given I have an open session showing a scenario selection prompt
When I select "smart-house" and submit
Then the prompt is replaced by my response as a log entry
And a new prompt appears: "Truncate existing devices?"
When I confirm
Then a progress bar appears: "Creating devices... 3/15 (20%)"
And individual output messages stream below

### Scenario: Session completion

Given a session is running with progress streaming
When the operation completes
Then the progress bar reaches 100%
And a success card shows: "Scenario loaded: 15 devices, 4 rooms, 3 scenes"
And a "Close" button appears

## 6. Technical constraints

- Use existing WebSocket connection patterns from extension logs component
- Terminal output must use virtual scrolling for large output (>500 messages)
- Prompt responses must be validated client-side before sending
- Component must be tree-shakeable (lazy-loaded when needed)
- Follow existing Element Plus component usage patterns
- No new npm dependencies (use existing element-plus, iconify)

## 7. Implementation hints

- Look at `extension-logs.vue` for WebSocket connection management patterns
- Use `el-timeline` or custom list for terminal output entries
- Use `el-dialog` for desktop, full-screen component for mobile
- Consider `<Transition>` for smooth prompt/progress animations
- Session state: `idle | connecting | running | awaiting_input | completed | error | disconnected`

## 8. AI instructions

- Read this file entirely before making any code changes
- Start by replying with a short implementation plan (max 10 steps)
- Implement FEATURE-INTERACTIVE-SESSION-PROTOCOL first (backend dependency)
- Study existing WebSocket patterns in `extension-logs.vue`
- Keep the UI simple and functional — polish later
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
