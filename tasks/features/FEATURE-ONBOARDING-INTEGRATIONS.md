# Task: Integrations discovery step
ID: FEATURE-ONBOARDING-INTEGRATIONS
Type: feature
Scope: backend, admin
Size: medium
Parent: EPIC-APP-ONBOARDING
Status: planned

## 1. Business goal

In order to quickly enable smart home integrations during setup,
As a new user,
I want to see available integrations and enable them in the onboarding wizard.

## 2. Context

During onboarding, users should be able to see what integrations are available (Home Assistant, Shelly, Zigbee2MQTT, etc.) and enable them. This provides a quick path to getting devices into the system.

**Existing code:**
- `apps/backend/src/modules/extensions/` - Extensions registry and metadata
- `apps/admin/src/modules/config/` - Plugin configuration UI
- `apps/admin/src/plugins/` - Individual plugin admin modules

**Available integrations (plugins):**
- Home Assistant (`devices-home-assistant`)
- Shelly Gen 1 (`devices-shelly-v1`)
- Shelly Gen 2+ (`devices-shelly-ng`)
- Zigbee2MQTT (`devices-zigbee2mqtt`)
- Third Party (`devices-third-party`)
- WLED (`devices-wled`)

## 3. Scope

**In scope**

- Backend endpoint to list available integrations with metadata
- Onboarding step component showing integration cards
- Toggle to enable/disable each integration
- Brief description and icon for each integration
- Save enabled integrations to plugin configuration
- Visual feedback for enabled integrations

**Out of scope**

- Full integration configuration (connection details, credentials)
- Device discovery during onboarding
- Integration-specific setup wizards
- Plugin installation/uninstallation

## 4. Acceptance criteria

- [ ] Step shows cards for each available device integration plugin
- [ ] Each card has plugin name, icon, and brief description
- [ ] User can toggle integrations on/off
- [ ] Enabled integrations are persisted to plugin config
- [ ] Step can be skipped entirely
- [ ] At least 3 integrations shown: Home Assistant, Shelly, Zigbee2MQTT
- [ ] Visual indication of which integrations are enabled

## 5. Example scenarios

### Scenario: Enable Home Assistant integration

Given I am on the integrations step of onboarding
When I see the Home Assistant integration card
And I click the enable toggle
Then the toggle shows "enabled" state
And when I complete onboarding
Then Home Assistant plugin is enabled in configuration

### Scenario: Skip integrations step

Given I am on the integrations step
When I click "Skip" or "Continue without enabling"
Then I proceed to the next step
And no integrations are enabled

### Scenario: Enable multiple integrations

Given I am on the integrations step
When I enable Home Assistant, Shelly, and Zigbee2MQTT
And I complete onboarding
Then all three plugins are enabled
And I can configure them from the admin settings

## 6. Technical constraints

- Use existing extensions registry for plugin metadata
- Store enabled state in plugin configuration
- Follow existing plugin enable/disable patterns
- Do not start plugin services during onboarding (just configure)
- Use existing plugin icons and descriptions

## 7. Implementation hints

**Backend additions:**

Add to extensions service or create dedicated endpoint:
```typescript
// GET /extensions/available
// Returns list of available device plugins with metadata
async getAvailableIntegrations(): Promise<IntegrationInfoModel[]> {
  return this.extensionsService.getPluginMetadata()
    .filter(p => p.type.startsWith('devices-'))
    .map(p => ({
      type: p.type,
      name: p.name,
      description: p.description,
      icon: p.icon,
      enabled: this.configService.isPluginEnabled(p.type),
    }));
}
```

**Frontend component (`step-integrations.vue`):**
```vue
<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <el-card
      v-for="integration in integrations"
      :key="integration.type"
      :class="{ 'border-primary': integration.enabled }"
      shadow="hover"
    >
      <div class="flex items-center gap-4">
        <icon :icon="integration.icon" class="w-12 h-12" />
        <div class="flex-1">
          <h4>{{ integration.name }}</h4>
          <p class="text-sm text-gray-500">{{ integration.description }}</p>
        </div>
        <el-switch v-model="integration.enabled" />
      </div>
    </el-card>
  </div>
</template>
```

**Integration data structure:**
```typescript
interface IntegrationInfo {
  type: string;           // e.g., 'devices-home-assistant'
  name: string;           // e.g., 'Home Assistant'
  description: string;    // Brief description
  icon: string;           // Icon identifier
  enabled: boolean;       // Current state
}
```

## 8. AI instructions

- Read this file entirely before making any code changes
- Check existing extensions service for available methods
- Coordinate with FEATURE-ONBOARDING-WIZARD for step integration
- Keep the UI simple - just enable/disable toggles
- Do not implement full plugin configuration
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
