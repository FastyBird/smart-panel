# Epic: Onboarding Device Discovery & Setup
ID: EPIC-ONBOARDING-DEVICE-SETUP
Type: epic
Scope: backend, admin
Size: large
Parent: EPIC-APP-ONBOARDING
Status: planned

## 1. Business goal

In order to have a fully functional smart home after initial setup,
As a new user completing onboarding,
I want the wizard to discover my devices, let me organize them into spaces, and create a ready-to-use dashboard.

## 2. Context

The base onboarding wizard (EPIC-APP-ONBOARDING) covers account creation, location, and integration enabling. However, after enabling integrations the user still needs to:
1. Trigger device discovery for each enabled integration
2. Wait for devices to appear
3. Manually create spaces/rooms
4. Assign devices to spaces
5. Set up dashboard pages

This epic extends onboarding to automate steps 1-4 and optionally step 5, providing a HomeAssistant-like experience where the user goes from zero to a working smart home in one guided flow.

**Existing code to leverage:**
- `apps/admin/src/modules/onboarding/components/step-integrations.vue` — integration enable/disable (implemented)
- `apps/admin/src/modules/onboarding/components/step-spaces.vue` — quick room creation (implemented)
- `apps/admin/src/modules/spaces/views/view-spaces-onboarding.vue` — full spaces wizard with device assignment
- `apps/backend/src/plugins/devices-shelly-*/` — Shelly plugins with mDNS discovery
- `apps/backend/src/plugins/devices-home-assistant/` — HA plugin (requires manual configuration)
- `apps/backend/src/modules/mdns/` — mDNS discovery service

**Integration discovery capabilities:**
| Plugin | Auto-discovery | Requires Config |
|--------|---------------|-----------------|
| Shelly Gen1 (`devices-shelly-v1`) | Yes (mDNS) | No |
| Shelly Gen2+ (`devices-shelly-ng`) | Yes (mDNS) | No |
| WLED (`devices-wled`) | Yes (mDNS) | No |
| Zigbee2MQTT (`devices-zigbee2mqtt`) | Partial (MQTT broker needed) | Yes (broker URL) |
| Home Assistant (`devices-home-assistant`) | No | Yes (URL + token) |
| Third Party (`devices-third-party`) | No | Manual only |

## 3. Scope

**In scope**

- Device discovery step in onboarding after integrations are enabled
- Discovery trigger mechanism per integration type (auto vs manual)
- Real-time discovery progress/results display
- Integration configuration sub-step for integrations that require credentials
- Enhanced spaces step with device-to-space assignment
- Device heuristic grouping (suggest spaces based on device names)
- Summary step showing discovered devices, created spaces, and assignments

**Out of scope**

- Automatic dashboard/page generation (future epic)
- Deep device configuration (channel mapping, property tuning)
- Plugin installation/uninstallation (plugins are bundled)
- Panel app onboarding

## 4. Acceptance criteria

- [ ] After enabling integrations, user can trigger device discovery
- [ ] Auto-discoverable integrations (Shelly, WLED) start scanning immediately
- [ ] Integrations requiring configuration (HA, Z2M) show inline config form
- [ ] Discovery results appear in real-time (WebSocket or polling)
- [ ] User can see discovered devices grouped by integration
- [ ] Spaces step shows discovered devices for assignment to rooms
- [ ] Heuristic suggestion of spaces based on device names works
- [ ] User can manually create spaces and drag/assign devices
- [ ] Skipping discovery is always possible
- [ ] Summary shows: integrations enabled, devices found, spaces created, assignments made

## 5. Example scenarios

### Scenario: Auto-discovery with Shelly devices

Given I enabled the Shelly Gen2+ integration during onboarding
When I reach the device discovery step
Then the system automatically starts mDNS scanning
And I see Shelly devices appearing as they are found
And after 30 seconds the scan completes
And I see "3 devices found" for Shelly

### Scenario: Home Assistant requires configuration

Given I enabled Home Assistant integration during onboarding
When I reach the device discovery step
Then I see a configuration form for Home Assistant (URL, token)
And after entering valid credentials
Then HA entities are imported as devices
And I see them in the discovery results

### Scenario: Smart space suggestions

Given discovery found "Living Room Lamp", "Living Room TV", "Kitchen Light", "Bedroom Sensor"
When I reach the spaces assignment step
Then the wizard suggests spaces: "Living Room", "Kitchen", "Bedroom"
And devices are pre-assigned to their suggested spaces
And I can accept, modify, or reject the suggestions

### Scenario: Skip discovery entirely

Given I am on the device discovery step
When I click "Skip"
Then I proceed to spaces creation
And no discovery is triggered
And I can still manually create spaces

## 6. Technical constraints

- Discovery must be non-blocking and show progress
- WebSocket integration for real-time device appearance
- Each plugin's discovery mechanism is different — use adapter pattern
- Discovery timeout should be configurable (default 30s)
- Must handle plugins that fail to start gracefully
- Follow existing module/service patterns
- Do not modify generated OpenAPI code
- Backend changes require OpenAPI regeneration

## 7. Implementation hints

**Discovery adapter pattern:**
```typescript
interface IDiscoveryAdapter {
  readonly pluginType: string;
  readonly requiresConfiguration: boolean;
  canDiscover(): boolean;
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  getDiscoveredDevices(): DiscoveredDevice[];
}
```

**Space suggestion heuristic:**
- Extract common room tokens from device names (Living Room, Kitchen, Bedroom, etc.)
- Use locale-aware token matching
- Group devices by extracted room name
- Present as pre-filled suggestions with override option

**Frontend flow:**
```
[Integrations Step] → [Discovery Step] → [Spaces + Assignment Step] → [Complete]
                          ↓
                   [Config sub-forms for HA, Z2M]
                          ↓
                   [Real-time results via WebSocket]
```

## 8. Child tasks

| ID | Title | Scope | Size | Status |
|----|-------|-------|------|--------|
| FEATURE-ONBOARDING-INTEGRATIONS | Integrations discovery step (enable/disable) | backend, admin | medium | done |
| FEATURE-ONBOARDING-DEVICE-DISCOVERY | Device discovery during onboarding | backend, admin | large | planned |
| FEATURE-ONBOARDING-INTEGRATION-CONFIG | Inline integration configuration | backend, admin | medium | planned |
| FEATURE-ONBOARDING-SPACES-ASSIGNMENT | Enhanced spaces step with device assignment | admin | medium | planned |
| TECH-SPACES-ONBOARDING-WIZARD | Spaces onboarding and assignment wizard | admin, backend | medium | done |

## 9. AI instructions

- Read this file and all child task files before implementation
- Implement in order: DEVICE-DISCOVERY → INTEGRATION-CONFIG → SPACES-ASSIGNMENT
- FEATURE-ONBOARDING-INTEGRATIONS and TECH-SPACES-ONBOARDING-WIZARD are already done
- Start each task by replying with implementation plan
- Reuse existing discovery mechanisms from plugins where possible
- Use WebSocket for real-time discovery results
- Keep UI consistent with existing onboarding wizard style
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
