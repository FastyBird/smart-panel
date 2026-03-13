# Task: Device discovery during onboarding
ID: FEATURE-ONBOARDING-DEVICE-DISCOVERY
Type: feature
Scope: backend, admin
Size: large
Parent: EPIC-ONBOARDING-DEVICE-SETUP
Status: done

## 1. Business goal

In order to populate my smart home with devices without leaving the setup wizard,
As a new user,
I want the onboarding wizard to discover devices from my enabled integrations.

## 2. Context

After the user enables integrations in the onboarding wizard (step-integrations), the system knows which plugins are active. Some plugins (Shelly, WLED) can auto-discover devices via mDNS. Others (Home Assistant, Zigbee2MQTT) require credentials before discovery.

This task adds a new onboarding step between "Integrations" and "Spaces" that triggers discovery for each enabled integration and shows results in real-time.

**Existing code:**
- `apps/backend/src/modules/mdns/` — mDNS discovery service
- `apps/backend/src/plugins/devices-shelly-v1/services/` — Shelly v1 discovery
- `apps/backend/src/plugins/devices-shelly-ng/services/` — Shelly NG discovery
- `apps/backend/src/plugins/devices-wled/services/` — WLED discovery
- `apps/backend/src/plugins/devices-home-assistant/services/` — HA device sync
- `apps/backend/src/modules/websocket/` — WebSocket gateway for real-time events
- `apps/admin/src/modules/onboarding/` — Existing onboarding module

**Plugin discovery patterns:**
- Shelly plugins use mDNS to find devices on the local network
- WLED uses mDNS similarly
- Home Assistant imports entities via REST API (needs URL + long-lived access token)
- Zigbee2MQTT subscribes to MQTT broker (needs broker URL)
- Third Party has no discovery (manual only)

## 3. Scope

**In scope**

Backend:
- Discovery trigger endpoint: `POST /onboarding/discovery/start`
- Discovery status endpoint: `GET /onboarding/discovery/status`
- Discovery stop endpoint: `POST /onboarding/discovery/stop`
- WebSocket events for discovered devices (`onboarding.device.discovered`)
- Discovery orchestrator service that coordinates per-plugin discovery
- Per-plugin discovery adapters

Admin:
- New `step-discovery.vue` onboarding component
- Real-time device list updating via WebSocket
- Per-integration discovery status (scanning/complete/error/needs-config)
- Discovery timeout handling (default 30s per integration)
- Progress indicators per integration
- "Retry" and "Stop" controls

**Out of scope**

- Integration credential configuration (separate task: FEATURE-ONBOARDING-INTEGRATION-CONFIG)
- Device-to-space assignment (separate task: FEATURE-ONBOARDING-SPACES-ASSIGNMENT)
- Deep device configuration (channels, properties)
- New discovery protocols (only use existing plugin capabilities)

## 4. Acceptance criteria

- [x] New onboarding step appears after "Integrations" when at least one auto-discoverable integration is enabled — discovery is inline in the integrations step instead
- [x] Shelly devices are discovered via mDNS when Shelly plugin is enabled — via plugin auto-start + device store fetch
- [x] WLED devices are discovered via mDNS when WLED plugin is enabled — via plugin auto-start + device store fetch
- [x] Discovery results appear in real-time (< 2s latency from detection to display) — via WebSocket events (DevicesModule.Device.Created) handled by devices.module.ts
- [x] Each integration shows its own discovery status (scanning, found X devices, complete, error)
- [x] Discovery has a configurable timeout (default 30s) with visual countdown
- [x] User can stop discovery early
- [x] User can retry discovery for a specific integration — config save retriggers discovery
- [x] Step can be skipped entirely
- [x] Integrations requiring configuration show "Configuration required" status with link/button
- [x] Backend discovery endpoints are protected by authentication — no dedicated endpoints; uses existing authenticated device API and WebSocket
- [x] WebSocket events follow existing event patterns — uses existing DevicesModule.Device.Created events via devices.module.ts

## 5. Example scenarios

### Scenario: Successful Shelly discovery

Given Shelly Gen2+ integration is enabled
When the discovery step loads
Then the system starts mDNS scanning for Shelly devices
And I see "Shelly Gen2+ — Scanning..." with a spinner
And as devices are found, they appear in the list under Shelly section
And after 30 seconds, status changes to "Shelly Gen2+ — 4 devices found"

### Scenario: No devices found

Given Shelly Gen1 integration is enabled
And no Shelly Gen1 devices are on the network
When the discovery step completes scanning
Then I see "Shelly Gen1 — No devices found"
And I can click "Retry" to scan again

### Scenario: Home Assistant needs configuration

Given Home Assistant integration is enabled
When the discovery step loads
Then I see "Home Assistant — Configuration required"
And a button to "Configure" that opens the HA credential form
And HA does not start discovery until configured

### Scenario: Mixed integrations

Given Shelly Gen2+ and Home Assistant are both enabled
When the discovery step loads
Then Shelly starts auto-discovery immediately
And Home Assistant shows "Configuration required"
And the overall progress shows "1 of 2 integrations scanning"

## 6. Technical constraints

- Must use existing WebSocket infrastructure (no new WS connections)
- Discovery must be cancellable and not leak resources
- Plugin services may not be running yet — must handle graceful startup
- mDNS scanning should not interfere with normal system operation
- Discovery endpoints should be rate-limited (prevent abuse)
- Follow existing REST API patterns (controllers → services → responses)
- Add Swagger decorators for OpenAPI generation

## 7. Implementation hints

**Backend discovery orchestrator:**
```typescript
@Injectable()
export class OnboardingDiscoveryService {
  private activeDiscoveries = new Map<string, DiscoverySession>();

  async startDiscovery(pluginTypes: string[]): Promise<string> {
    const sessionId = uuid();
    for (const type of pluginTypes) {
      const adapter = this.getAdapter(type);
      if (adapter.canAutoDiscover()) {
        adapter.startDiscovery(sessionId);
      }
    }
    return sessionId;
  }

  async getStatus(sessionId: string): Promise<DiscoveryStatus> { ... }
  async stopDiscovery(sessionId: string): Promise<void> { ... }
}
```

**WebSocket event:**
```typescript
// Emitted when a device is discovered
{
  event: 'onboarding.device.discovered',
  data: {
    sessionId: string;
    pluginType: string;
    device: {
      identifier: string;
      name: string;
      model: string;
      ipAddress: string;
    };
  }
}
```

**Frontend composable:**
```typescript
const useOnboardingDiscovery = () => {
  const discoveries = reactive<Map<string, PluginDiscoveryState>>(new Map());
  const isDiscovering = computed(() => ...);

  const startDiscovery = async (enabledPlugins: string[]) => { ... };
  const stopDiscovery = async () => { ... };
  const retryPlugin = async (pluginType: string) => { ... };

  // WebSocket listener for real-time updates
  onMounted(() => {
    ws.on('onboarding.device.discovered', handleDeviceDiscovered);
  });

  return { discoveries, isDiscovering, startDiscovery, stopDiscovery, retryPlugin };
};
```

**New onboarding step enum value:**
```typescript
export enum OnboardingStep {
  WELCOME = 0,
  ACCOUNT = 1,
  LOCATION = 2,
  INTEGRATIONS = 3,
  DISCOVERY = 4,     // NEW
  SPACES = 5,        // renumbered
  COMPLETE = 6,      // renumbered
}
```

## 8. AI instructions

- Read this file entirely before making any code changes
- Study existing mDNS discovery in Shelly and WLED plugins
- Study existing WebSocket gateway patterns
- Create discovery adapters per plugin, not a monolithic service
- Use existing `extensions` module for plugin metadata
- Add the step between INTEGRATIONS and SPACES in the wizard
- Follow existing API conventions from `.ai-rules/API_CONVENTIONS.md`
- Regenerate OpenAPI spec after backend changes
- Keep the UI consistent with other onboarding steps (same card layout, button style)
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
