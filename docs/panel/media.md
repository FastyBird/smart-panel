# Media Domain – User Guide (Panel App)

## What is the Media Domain?

The Media domain lets you control entertainment devices in a room — TVs, speakers, receivers, streaming boxes, and gaming consoles — as a single coordinated experience rather than controlling each device individually.

Instead of turning on your TV, switching the input, powering up the receiver, and setting the volume one by one, you select an **activity** (like "Watch" or "Listen") and the system handles all the steps automatically.

## Activities

The Media domain organizes entertainment into five activities:

| Activity       | What it does                                                        |
|----------------|---------------------------------------------------------------------|
| **Watch**      | Powers on display + audio, sets inputs, applies volume preset       |
| **Listen**     | Powers on audio output (and optionally a source), sets volume       |
| **Gaming**     | Powers on display + audio + console, sets console input             |
| **Background** | Powers on audio at a low volume for ambient music                   |
| **Off**        | Deactivates the current activity and stops playback                 |

Only **one activity** can be active per room at a time. Selecting a new activity replaces the current one.

## How Media Differs from Lights and Coverings

- **Lights and Coverings** control individual devices directly (turn on light, open blinds).
- **Media** is **activity-based**: you choose *what you want to do*, and the system figures out which devices to control and how.
- Media coordinates **multiple devices** together (display + audio + source) as a single action.

## Real-Time Connection

Media requires an active WebSocket connection to function properly. The panel communicates with the backend in real time to:

- Send activation commands
- Receive status updates (activating → active / failed)
- Get live feedback on partial failures or warnings

If the WebSocket connection is lost:
- The current activity status may become stale
- New activations will not work until the connection is restored
- The panel will indicate when the connection is unavailable

## What to Expect

### First Time
When you open the Media domain for a room, the system automatically detects your media devices and creates default activity configurations. You should see available activities immediately — no manual setup required.

### When Things Go Wrong
- **Partial failures** are normal — for example, volume might fail to set while the TV still turns on. The system continues with non-critical steps and reports what happened.
- **Critical failures** (e.g., TV won't power on for Watch) cause the activity to fail, with a clear error message.
- If no media devices are detected in a room, the Media domain will show a message explaining why it's unavailable.

### Activity Status
Each activity shows its current state:
- **Activating** — the system is sending commands to your devices
- **Active** — everything is running
- **Failed** — something went wrong (details are shown)
- **Deactivated** — no activity is currently active
