# Task: Inline integration configuration during onboarding
ID: FEATURE-ONBOARDING-INTEGRATION-CONFIG
Type: feature
Scope: backend, admin
Size: medium
Parent: EPIC-ONBOARDING-DEVICE-SETUP
Status: planned

## 1. Business goal

In order to connect integrations that need credentials without leaving the onboarding wizard,
As a new user,
I want to configure integration connection details (URLs, tokens) inline during device discovery.

## 2. Context

Some integrations require configuration before they can discover or import devices:
- **Home Assistant**: needs HA server URL and long-lived access token
- **Zigbee2MQTT**: needs MQTT broker URL and optional credentials

Currently, these integrations can only be configured from the admin settings after onboarding is complete. This task adds inline configuration forms within the discovery step.

**Existing code:**
- `apps/admin/src/plugins/devices-home-assistant/` — HA plugin admin UI with connection settings
- `apps/admin/src/plugins/devices-zigbee2mqtt/` — Z2M plugin admin UI
- `apps/backend/src/plugins/devices-home-assistant/services/` — HA connection service
- `apps/backend/src/plugins/devices-zigbee2mqtt/services/` — Z2M MQTT service

## 3. Scope

**In scope**

- Compact configuration forms for HA and Z2M within the discovery step
- Connection test button ("Test Connection") before proceeding
- Save credentials to plugin configuration
- Trigger discovery after successful configuration
- Error handling for invalid credentials
- Visual indication of connection status (untested, testing, connected, failed)

**Out of scope**

- Full plugin settings UI (just the minimum needed for discovery)
- Adding new plugin configuration fields
- Plugin installation/removal
- OAuth flows (HA uses long-lived tokens)

## 4. Acceptance criteria

- [ ] Home Assistant shows inline form with: Server URL, Long-lived Access Token
- [ ] Zigbee2MQTT shows inline form with: MQTT Broker URL, optional username/password
- [ ] "Test Connection" button validates credentials against the backend
- [ ] Successful test saves credentials and triggers discovery
- [ ] Failed test shows error message without blocking other integrations
- [ ] Configuration can be skipped (integration remains enabled but unconfigured)
- [ ] Forms are compact and fit within the discovery step layout

## 5. Example scenarios

### Scenario: Configure Home Assistant

Given I enabled Home Assistant and I'm on the discovery step
When I click "Configure" on the Home Assistant card
Then I see a compact form with URL and token fields
When I enter valid credentials and click "Test Connection"
Then the connection is verified and discovery starts
And HA entities begin appearing in the discovery list

### Scenario: Invalid credentials

Given I entered wrong HA credentials
When I click "Test Connection"
Then I see "Connection failed: Invalid token"
And I can correct the credentials and retry

## 6. Technical constraints

- Reuse existing plugin connection test logic where available
- Store credentials using existing plugin configuration mechanism
- Do not expose credentials in API responses (write-only)
- Forms should be responsive and work within the card layout

## 7. Implementation hints

- Extract minimal connection forms from existing plugin settings components
- Use `el-dialog` or inline expandable section for the config form
- Backend endpoint: `POST /onboarding/integration/{type}/test-connection`
- Save via existing extension update mechanism

## 8. AI instructions

- Read this file entirely before making any code changes
- Study existing HA and Z2M plugin admin UI for form fields
- Keep forms minimal — only fields needed for discovery
- Reuse existing connection test logic from plugins
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
