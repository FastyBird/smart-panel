# Admin UI: screens and plugins inventory

> **Current-state inventory.** This lists what each admin screen and plugin shows **today**, before the redesign.
> For how screens must look, follow [`admin-ui-design-spec.md`](admin-ui-design-spec.md). Use this inventory to
> check that a migrated screen keeps all its content, and update it when a screen gains or loses content.

This document lists **what is actually on each screen**, and **every plugin** together with the parts of the UI it
contributes.

Titles and subtitles in quotes are the current English UI copy.

---

## 1. How plugins show up in the UI (read this first)

The admin app is a **host + plugins** system. A module owns a screen and its chrome (header, list, drawer,
footer, save button). Plugins fill **slots** inside it. The user never sees a "plugin page" as such, only
a module screen whose middle part comes from a plugin.

| Slot | Host screen | What the plugin renders there |
|---|---|---|
| `pluginConfigEditForm` | Configuration → Plugins → *plugin* | Settings form for the plugin (connection, credentials, intervals) |
| `deviceAddForm` / `deviceEditForm` | Devices → Add / Edit (drawer or page) | Integration-specific device form |
| `deviceWizard` | Devices → **Wizard** picker → wizard | A tile on the wizard picker (icon, name, description, order) plus the wizard flow: discover, select, confirm, results |
| `deviceDetailTabs` | Device detail | An extra tab (icon + label) next to Overview / Logs |
| `channelPropertyAddForm` / `…EditForm` | Device → channel → property | Integration-specific property form |
| `pageAddForm` / `pageEditForm` (+ own routes) | Pages → Add / Edit / **Configure** | Page-type form, and a full configure screen for the page layout |
| `tileAddForm` / `tileEditForm` / `tilePreview` | Pages → page → tiles | Tile form and a **visual preview** of the tile as it looks on the wall display |
| `dataSourceAddForm` / `…EditForm` | Pages → page or tile → data sources | Data source form (what value to show) |
| `spaceAddForm` / `spaceEditForm` / `spaceDetail` / `spaceWizard` | Spaces | Space-type form, detail sections, setup wizard |
| `sceneActionAddForm` / `…EditForm` / `sceneActionCard` | Scenes → Add / Edit | One action row/card inside a scene ("set this light to 50 %") |
| `locationAddForm` / `…EditForm` | Weather → Locations | Provider-specific location form |
| `providerCard` | Remote access → Providers tab | A status card for the provider, often opening a setup wizard |

**Design:** the frame each slot must use is the plugin slot contract in
[`admin-ui-design-spec.md`](admin-ui-design-spec.md#7-plugin-slot-contract). Several plugins also launch their own
**setup wizards** (HomeKit, Cloudflare Tunnel, Tailscale, Buddy); they use `wizard-shell`.

A selection step ("**Device plugin required**", "**Select a space type**", "**Select a weather provider**",
"**Page plugin required**", "**Tile plugin required**", "**Data source plugin required**") appears before
most add forms. It is a picker of plugin types and is currently built separately in each module; the spec replaces it with `type-picker`.

---

## 2. Modules and their screens

Ordered as in the sidebar (top to bottom). For the target layout of each screen see the page templates in
[`admin-ui-design-spec.md`](admin-ui-design-spec.md#5-page-templates).

### Stats (home)
"Application overview" / "Smart panel system statistics"
- One dashboard page, the landing screen after sign-in.
- Stat tiles: **Connected devices**, **Updates today** (device communication), **Smart Panel Spaces**,
  **Smart Panel Pages**, **CPU**, **Memory**, **Uptime**. Each shows a big number, a label, and a tooltip
  with the "last updated" time and a stale warning.
- Panels: **Smart Panel** (application overview: version, update state), **System Information**,
  **Logs** (recent application log lines), **Quick Links**.
- No charts today.

### Buddy (AI assistant)
"Buddy Chat" / "Chat with your AI buddy assistant"
- **Two-pane chat**: a left card "Chats" (conversation list, "New chat" button, per-conversation delete,
  optional space association), and a right chat area with message bubbles (user / assistant), a composer
  and loading states.
- **Setup wizard** shown when Buddy is not configured yet: pick an LLM provider, then voice (TTS / STT),
  then messaging adapters, then a summary. Every step can be skipped, and each option opens the plugin's
  config form. The options come from the Buddy plugins (§3).
- Settings: "AI Buddy Configuration" form under Configuration.

### Spaces
"Spaces" / "Organize devices and displays by rooms or zones"
- **List page** (table or list view, filter, bulk remove), **Add space** (type picker, then form),
  **Edit space** (drawer), **Setup wizard** per space type ("Setup wizard for spaces, devices and displays").
- **Space configure page** (from the Home Control plugin) is the richest screen in the app. It is a stack of
  sections:
  - Parent zone (rooms can belong to zones, e.g. floor)
  - **Domains**: Lighting, Climate, Covers, Sensors, Media. Each is a card with a role summary and a
    dialog to assign devices to roles (e.g. main light / ambient / accent, heating / cooling actuator,
    thermostat sensor). Media also has **activities** (watch, listen…), which map a display, audio,
    source and remote to each activity.
  - Devices, Displays and Scenes sections, each with an "add" dialog
  - Activity modes, occupancy, mode schedule
- Space types: **Home Control** (physical rooms and zones), **Information Panel Signage** (read-only
  full-screen signage: clock, weather, announcements, external feed), **Entry** (singleton front-door and
  security surface), **Master** (singleton whole-house overview).

### Pages (wall-display dashboards)
"Pages" / "Manage smart panel pages"
- **List page** of dashboard pages, each with a page type, icon, order and target displays.
- **Add / edit page** (type picker, then form), **page detail**, and a **configure** screen that depends on
  the page type:
  - **Tiles page**: a grid of tiles with **live previews**, add/edit tile, and data sources per tile.
  - **Cards page**: cards that group tiles, so there is one more nesting level (card, then tile, then
    data source).
  - **Device detail page**: one device shown full-screen. Only a form, no configure screen.
- **Tile** and **data source** detail and edit screens (each with a type picker).
- Design need: the tile **previews** should resemble the wall display (see `docs/display-app-design-spec.md`)
  while sitting inside admin chrome.

### Devices (reference implementation)
"Devices" / "Manage smart panel devices"
- **List page**: icon, name, category, plugin (integration), state (online/offline/…), validation
  warnings, hidden flag. Filter bar with search, category, plugin and state. Bulk enable / disable /
  delete. Header actions: **Wizard** (primary) and **Add manually**.
- **Wizard picker** ("Select a device wizard"): tiles for each integration that offers a wizard
  (Shelly, Zigbee2MQTT, Home Assistant, Homey, WLED, Modbus, Virtual, Simulator).
- **Wizard shell**: steps Discover → Select (a table of discovered devices with per-row cells) → Confirm
  (review checks) → Results (inventory summary). Supports batch adoption.
- **Device detail**: summary card (description, plugin, state, category), then tabs **Overview** (the
  channels, each with its properties table showing data type, value and permissions), **Logs**, plus plugin
  tabs (e.g. Shelly cover recovery, Modbus registers, virtual device sources). Header actions: add channel,
  edit, control, plugin controls menu.
- **Device control**: a form to set property values live.
- **Channels** and **channel properties**: their own lists, detail and add/edit forms. The property form
  covers data type, enum values, min/max/step, permissions, and invalid value.
- Device property picker (used by Automations, Scenes, Spaces): cascading device, then channel, then
  property.

### MCP clients
"MCP clients" (AI tools such as Claude or ChatGPT talking to the house through the Model Context Protocol)
- Info alert about security, **endpoint card** (read-only URL with copy), and a **client list** (name,
  status, capabilities, expires, last used) with actions edit / rotate token / revoke / delete.
- **Create/edit drawer**: name, description, enabled, **capabilities** checkboxes (limited by a configured
  ceiling, with an explanatory hint), expiry in days.
- **Token dialog**: shows the secret **once**, with copy and a warning. Shown after create and rotate.

### MCP OAuth
- Management page with tabs **Clients**, **Grants**, **Access tokens**, **Refresh families**
  (tables with filter and revoke).
- **OAuth consent** screen, standalone: an external app asks for access, the user sees the requested
  scopes and approves or denies. It needs to look trustworthy and is seen by users coming from another app.

### Displays
"Displays" / "Manage your connected display devices"
- **List page**: name, version, resolution, layout, audio, state (online/offline), current IP.
- **Display detail**: info (status, version, build, resolution, pixel ratio, MAC, current IP, registered-from
  IP), peripherals (audio input/output and volumes), settings (brightness, dark mode, …), "Manage tokens".
- **Edit** (drawer), **Access tokens** (list, revoke).

### Scenes
"Scenes" / "Manage one-tap scenes for your smart home"
- **List page** (icon, name, enabled, filter, bulk enable / disable / delete).
- **Add / edit scene**: name, icon, then a list of **action cards** ("set device property to value")
  from the Local Scenes plugin.

### Automations (newest, highest priority)
"Automations" / "Let your smart home act on its own"
- **List page**: name, space, enabled (inline switch), status (**OK / Invalid / Suspended**, each with an
  explanation), last run, and row actions: open flow, export, edit, remove. Filters, bulk actions. Extra entry points: **New from template**, **Import automation**
  (YAML), **Suggested by Buddy** (suggestions from detected routines).
- **Add**: "Name it now, draw its flow afterwards" (name, description, mode). **Edit**: same, in a drawer.
- **Flow editor** (full height): "Place blocks on the canvas and connect them"
  - Toolbar: undo/redo, remove selected, read-only tag, unsaved tag, mode tag, status tag, save, test.
  - **Palette** grouped by kind: **When** (triggers), **And** (conditions), **Then** (actions),
    **Flow** (flow control).
  - **Canvas** (vue-flow): node cards with an icon, title, one-line summary and ports. Ports can be
    yes / no / done / error / timeout. Edges, selection, minimap/controls, background grid.
  - **Inspector panel**: the form for the selected block.
  - **Problems** list (issues with severity info / warning / error / critical, click to focus a node).
  - **Runs**: history list (completed / failed / cancelled / interrupted), run summary with a step trace
    highlighted on the canvas, and a **Test** button.
  - **YAML** view/export dialog.
- Block catalogue (each block has its own inspector form):

  | Kind | Blocks |
  |---|---|
  | Trigger | Device property changed · Device button pressed · Device connection changed · Manual start · Scene was run · Time of day · Sunrise/sunset · House mode changed · Security state changed |
  | Condition | Device property compare · Time window · Daylight · House mode is · Security armed is |
  | Action | Set device property · Run scene · Send notification · Set house mode · Arm security · Enable / disable / run another automation |
  | Flow | Delay · Wait until (with timeout) · Any (first branch wins) · All (wait for every branch) |

  Run modes: **Single** (ignore new triggers while running), **Restart**, **Parallel**.

### System
"System" / "Smart panel system status information"
- **Info**: about application, software updates (check and install, with confirmation), **Manage system**
  (restart service, restart system, power off, factory reset, each with a strong confirmation).
- **Backups**: "Create, restore, and manage system backups" (list, create, restore, download, delete).
- **Logs**: "Preview all application logs" (table with level, source and time, filter drawer, log detail).
- **Maintenance screens** (outside the shell): Rebooting, Service restarting, Powered off, Factory reset in
  progress. They poll health and redirect when the system is back.
- Settings forms under Configuration: **Language & Units**, **System Settings**, **House Mode**,
  **House Location**.

### Weather
"Weather locations" / "Manage weather data locations"
- **List page** with the current weather in a column. **Add** (provider picker, then provider form), **Edit**.
- **Location detail**: current conditions, **Forecast** (daily), **Hourly forecast**. "Primary location"
  setting.

### Remote access
"Remote access" / "Reach this installation from outside the local network"
- Status banner (alert), **Access URLs** card (internal and external, with copy), tabs **Providers**
  (grid of provider cards: state tag, endpoints, setup button) and **Advisories** (security advisories
  table with a count badge).
- Providers: Cloudflare Tunnel, Tailscale. Each has a **setup wizard**.

### Extensions
"Extensions" / "Manage your application modules and plugins"
- Catalogue in **card** or **table** view: name, type (module/plugin), core/third-party, enabled,
  description. Filters, bulk enable/disable.
- **Extension detail**: info, links (docs, bugs), actions, logs, **Managed services** ("Monitor and control
  module and plugin services": start / stop / restart, status).

### Configuration
"Configuration" / "Smart panel configuration"
- Tabs **Modules** and **Plugins**. Each tab is a list of configurable items, and each item opens its
  settings form (drawer or page). Secrets use a dedicated masked input.
- Module settings that live here: System, Devices, Displays, Scenes, Weather, Buddy, MCP, Notifications,
  Remote access, Storage ("Storage Configuration"), mDNS ("Service Advertisement Settings").

### Users
"Users" / "Manage smart panel user accounts"
- **List page** (username, first name, last name, email, role). **Add**, **Edit** (with "Change username" and
  "Change password" sub-forms).

### Notifications
"Notifications" / "System conditions and events that need your attention"
- **Inbox** table: severity (info / warning / error / critical), title, source, occurrences (repeats are
  grouped), time, and actions (dismiss). "Load more" paging, filter drawer, bulk remove.
- **Detail drawer**: message, **Data** (payload), **Lifecycle** (raised, read, dismissed, resolved),
  actions mark-read / dismiss / remove.
- **Bell** in the top bar with an unread badge, and a **popover** with the latest items.
- Delivery channels are configured as plugins (§3): Discord, Slack, Telegram, Webhook.

### Outside the shell
- **Sign in / Sign up** (auth layout), **Lock screen** (unlock form).
- **Profile**: General (name, email, avatar) and Security (password, **personal access tokens** list).
- **Onboarding** (first run, full screen): Welcome → Account → Location → Integrations (each opens a
  config dialog) → Spaces → Complete.

### Cameras
The cameras module and the UniFi Protect plugin exist in the backend only; the admin has no camera screens yet.
They are specified in [`admin-ui-design-spec.md`](admin-ui-design-spec.md#8-cameras-and-unifi-protect).

### Modules with no screens of their own
Energy, Security, Intents, Storage and mDNS have no own pages. Storage and mDNS only add settings forms.
Security (alarm arming) and energy data appear inside other screens (automation blocks, spaces).

---

## 3. Plugin catalogue

Grouped by the module they extend. "Config" means the plugin has a settings form under Configuration →
Plugins.

### Device integrations (Devices module)
| Plugin | What it is | UI it contributes |
|---|---|---|
| Shelly Next Generation | Shelly Gen 2+ devices over the local network | Config · add/edit device form · discovery wizard (batch) · "Shelly" detail tab (cover calibration recovery) |
| Shelly Gen 1 | Older Shelly devices | Config · add/edit form · wizard |
| Zigbee2MQTT | Zigbee devices through a Zigbee2MQTT bridge | Config · add/edit form (including a multi-step variant) · wizard |
| Home Assistant | Import entities from an existing Home Assistant | Config · add/edit form (pick discovered device and entities) · channel property forms (map entity attributes) · wizard |
| Homey | Adopt and control Homey devices | Config · connection panel · wizard |
| WLED | Addressable LED controllers | Config · add/edit form · wizard |
| Modbus | Modbus TCP gateways, map registers to devices | Config · wizard with a **templates catalogue** · own screens: **Endpoints** list, **Points** (register map) per device · detail tab |
| Virtual Devices | Build devices by splitting or combining other devices' channels | Add/edit form · wizards for **light groups**, **measurements**, **thermostats** · detail tabs (sources, capability matrix, thermostat members, cooling policy, dew point) · remap dialog |
| Apple HomeKit Bridge | Expose Smart Panel devices to Apple Home | Config · **setup wizard** (pairing code / QR) |
| reTerminal | Hardware peripherals of the Seeed reTerminal host | Config · add/edit form |
| Third Party | Generic devices controlled through an external API | Add/edit form |
| Simulator | Fake devices, spaces and scenes for testing | Config · own wizard |
| UniFi Protect | Cameras, doorbells, sensors and floodlights from a UniFi console | Backend only today; admin settings, adoption wizard and camera screens are specified in the design spec |

### Dashboard (Pages module)
| Plugin | What it is | UI it contributes |
|---|---|---|
| Tiles Page | Grid of tiles | Page add/edit form · **configure screen** · tile and data source screens |
| Cards Page | Tiles grouped into cards | Page add/edit form · **configure screen** · card, tile and data source screens |
| Device Detail Page | One device full-screen | Page add/edit form |
| Device Preview Tile | Device status on a tile | Tile form · **preview** |
| Scene Tile | Trigger a scene | Tile form · preview |
| Clock Tile | Time and date | Preview |
| Weather Tiles | Current day / multi-day forecast | Tile form · day and forecast previews |
| Device Channel Data Source | Show one device property value | Data source form |
| Weather Data Source | Current weather or a forecast day value | Data source forms (current, forecast day) |

### Spaces
| Plugin | What it is | UI it contributes |
|---|---|---|
| Home Control Spaces | Physical rooms and zones with lighting, climate, covers, sensors, media | Add/edit form · **configure page** with domain cards, role dialogs, media activities · wizard |
| Information Panel Signage | Read-only full-screen signage (clock, weather, announcements, feed) | Add/edit form · announcements section |
| Entry Space | Singleton front-door / security surface | (no own UI) |
| Master Space | Singleton whole-house overview | (no own UI) |

### Scenes
| Local Scenes | Run scenes by setting device properties | Action add/edit form · **action card** |
|---|---|---|

### Weather providers
| Plugin | UI it contributes |
|---|---|
| Open-Meteo (free, no key) | Config · location add/edit form |
| OpenWeatherMap (API 2.5) | Config (API key) · location forms |
| OpenWeatherMap OneCall 3.0 | Config · location forms |

### Buddy (AI assistant) providers
All of these contribute only a **config form** today. They show up as options in the Buddy setup wizard.
| Role | Plugins |
|---|---|
| LLM | Claude (API key) · Claude Setup Token · OpenAI · OpenAI Codex (OAuth) · Ollama (local) |
| Text-to-speech | ElevenLabs · Voice.ai · System TTS (piper / espeak) |
| Speech-to-text | Whisper Local |
| Messaging adapters | Telegram · Discord (multi-channel space mapping) · WhatsApp |

### Notification channels
Discord · Slack · Telegram · Generic webhook. Each has a short **config form**: enabled, minimum severity, plus the webhook URL
(Discord, Slack), bot token and chat ID (Telegram), or URL and custom headers (Webhook).

### Remote access providers
| Plugin | UI it contributes |
|---|---|
| Cloudflare Tunnel | Config · **provider card** · **setup wizard** |
| Tailscale | Config · **provider card** · **setup wizard** |

### Storage and logging
| Plugin | UI it contributes |
|---|---|
| InfluxDB v1 | Config (host, database, retention policies) |
| InfluxDB v2 | Config (URL, token, org, bucket) |
| In-Memory Storage | none (default fallback) |
| Rotating File Logger | Config (directory, rotation) |

---

## 4. Counts

| What | Count |
|---|---|
| Sidebar destinations | 17 |
| Modules with own screens | 18 |
| Plugins | 52 with admin UI, plus UniFi Protect (backend only) |
| Plugin settings forms (Configuration → Plugins) | ~40 |
| Device integrations with a discovery/setup wizard | 9 (plus the planned UniFi Protect adoption wizard) |
| Plugin setup wizards outside Devices | 4 (HomeKit, Cloudflare Tunnel, Tailscale, Buddy) |
| Automation blocks (each with an inspector form) | 23 |
| Type pickers before an add form | 6 (device, space, page, tile, data source, weather provider) |
| UI languages | 6 |
