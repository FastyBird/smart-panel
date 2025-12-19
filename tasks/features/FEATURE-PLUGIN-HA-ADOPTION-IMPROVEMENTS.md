# Task: Improve Home Assistant Device Adoption Process
ID: FEATURE-PLUGIN-HA-ADOPTION-IMPROVEMENTS
Type: feature
Scope: backend
Size: large
Parent: FEATURE-PLUGIN-HA-AUTO-MAP
Status: planned
Created: 2025-12-19

## 1. Business goal

In order to have accurate device categorization and complete channel mapping
As a Smart Panel user adopting Home Assistant devices
I want the adoption process to correctly identify device types and offer all available capabilities (including color controls for lights)

## 2. Context

- The Home Assistant auto-mapping feature (FEATURE-PLUGIN-HA-AUTO-MAP) is complete
- Current issues reported:
  - Light devices are incorrectly recognized as sensors when they have multiple sensor entities
  - Color channels (RGB, HS, color temp) are not offered during adoption
  - Entity mappers contain domain knowledge not utilized during adoption
- Related files:
  - `apps/backend/src/plugins/devices-home-assistant/services/ha-entity-mapping.rules.ts`
  - `apps/backend/src/plugins/devices-home-assistant/services/mapping-preview.service.ts`
  - `apps/backend/src/plugins/devices-home-assistant/mappers/*.entity.mapper.service.ts`

## 3. Scope

### In scope

- Fix device category inference to prioritize primary entities (light, switch) over secondary (sensors)
- Detect light capabilities from `supported_color_modes` attribute
- Offer all available color properties during adoption (even when light is OFF)
- Fix bugs in existing entity mappers
- Increase priority values for primary domain mapping rules
- Add capability analyzers for complex domains (light, climate, cover, fan)
- Add unit tests for modified components

### Out of scope

- Admin UI changes for adoption flow
- Panel UI changes
- New HA entity domain support (beyond improving existing)
- Migration of already-adopted devices

## 4. Acceptance criteria

- [ ] Light device with sensor entities is correctly categorized as LIGHTING (not SENSOR)
- [ ] All supported color modes are offered during light adoption (RGB, HS, color_temp, white)
- [ ] Color properties are correctly mapped based on `supported_color_modes` attribute
- [ ] Binary sensor mapper correctly returns `false` for off states (bug fix)
- [ ] Light and switch mappers have correct warning log logic (bug fix)
- [ ] Primary domain rules have higher priority than sensor rules
- [ ] Unit tests pass for all modified components
- [ ] Existing devices continue to work (no breaking changes)

## 5. Example scenarios

### Scenario: Adopting a smart bulb with power monitoring

Given I have a HA device with entities: `light.living_room`, `sensor.living_room_power`, `sensor.living_room_voltage`
When I initiate device adoption
Then the suggested device category is LIGHTING (not SENSOR)
And the light channel includes brightness, color_temperature, hue, saturation properties based on `supported_color_modes`

### Scenario: Adopting an RGB light that is currently OFF

Given I have a HA light entity with `supported_color_modes: ["rgb", "color_temp"]`
And the light is currently OFF (color attributes are null)
When I view the mapping preview
Then I see color_red, color_green, color_blue, and color_temperature properties offered

### Scenario: Adopting a sensor-only device

Given I have a HA device with only sensor entities: `sensor.outdoor_temperature`, `sensor.outdoor_humidity`
When I initiate device adoption
Then the suggested device category is SENSOR
And appropriate temperature and humidity channels are created

## 6. Technical constraints

- Follow the existing module/service structure in `apps/backend/src/plugins/devices-home-assistant/`
- Do not modify generated code in `apps/backend/src/spec/`
- Build on existing mapping rules infrastructure
- Maintain backward compatibility with existing adopted devices
- Tests are expected for new logic

## 7. Implementation hints

### Phase 1: Fix Existing Bugs

1. Fix `binary-sensor.entity.mapper.service.ts:277-278` - returns `true` instead of `false` for off state
2. Fix `light.entity.mapper.service.ts:214-218` - inverted warning logic
3. Fix `switch.entity.mapper.service.ts:71-74` - same inverted warning logic

### Phase 2: Improve Device Category Inference

1. Add entity role classification (PRIMARY vs SECONDARY domains)
2. Update `inferDeviceCategory()` to prioritize primary domains
3. Pass entity domains to inference function from `MappingPreviewService`

### Phase 3: Light Capability Analysis

1. Create `LightCapabilityAnalyzer` service to parse `supported_color_modes`
2. Define `COLOR_MODE_PROPERTIES` mapping for each color mode
3. Update `MappingPreviewService.processEntity()` for light domain
4. Generate properties based on capabilities, not current state values

### Phase 4: Increase Rule Priorities

1. Update `HA_ENTITY_MAPPING_RULES` to give primary domains priority 50
2. Keep sensor rules at priority 20

### Phase 5: Other Domain Analyzers (optional)

1. Create capability analyzers for climate, cover, fan, media_player
2. Apply same pattern as light analyzer

### Key Constants to Add

```typescript
// In devices-home-assistant.constants.ts
export enum LightColorMode {
    ONOFF = 'onoff',
    BRIGHTNESS = 'brightness',
    COLOR_TEMP = 'color_temp',
    HS = 'hs',
    XY = 'xy',
    RGB = 'rgb',
    RGBW = 'rgbw',
    RGBWW = 'rgbww',
    WHITE = 'white',
}

export enum EntityRole {
    PRIMARY = 'primary',     // light, switch, climate, cover, etc.
    SECONDARY = 'secondary', // sensor entities on a multi-entity device
    STANDALONE = 'standalone' // sensor-only devices
}
```

### Key Files to Modify

- `apps/backend/src/plugins/devices-home-assistant/services/ha-entity-mapping.rules.ts`
- `apps/backend/src/plugins/devices-home-assistant/services/mapping-preview.service.ts`
- `apps/backend/src/plugins/devices-home-assistant/devices-home-assistant.constants.ts`
- `apps/backend/src/plugins/devices-home-assistant/mappers/binary-sensor.entity.mapper.service.ts`
- `apps/backend/src/plugins/devices-home-assistant/mappers/light.entity.mapper.service.ts`
- `apps/backend/src/plugins/devices-home-assistant/mappers/switch.entity.mapper.service.ts`

### New Files to Create

- `apps/backend/src/plugins/devices-home-assistant/services/light-capability.analyzer.ts`
- `apps/backend/src/plugins/devices-home-assistant/services/__tests__/light-capability.analyzer.spec.ts`

## 8. AI instructions

- Read this file entirely before making any code changes
- Start by replying with a short implementation plan (max 10 steps)
- Keep changes scoped to backend only
- Implement bug fixes first (Phase 1) as they are low risk
- For each acceptance criterion, either implement it or explain why it's skipped
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
- Run tests after each phase: `pnpm run test:unit`

---

## Root Cause Analysis

### Issue 1: Device Category Inference Algorithm

**Location**: `ha-entity-mapping.rules.ts:822-845`

The `inferDeviceCategory()` function sums priority values for ALL matching channel categories:

```typescript
for (const rule of HA_ENTITY_MAPPING_RULES) {
    if (mappedChannelCategories.includes(rule.channel_category)) {
        hints.set(rule.device_category_hint, current + (rule.priority ?? 1));
    }
}
```

**Problem**: A light with 4 sensor entities scores:
- LIGHTING: 10 (1 light × priority 10)
- SENSOR: 80 (4 sensors × priority 20)

Result: SENSOR wins incorrectly.

### Issue 2: Property Mapping Based on Current State Only

**Location**: `mapping-preview.service.ts:262-269`

```typescript
const hasValue = attributeValue !== undefined && attributeValue !== null;
if (hasValue || propertyMetadata.required) {
    suggestedProperties.push(...);
}
```

**Problem**: Color attributes are only present when light is ON. The `supported_color_modes` attribute (which tells capabilities) is in the skip list (line 281).

### Issue 3: Mapper Bugs

1. **Binary Sensor** (`binary-sensor.entity.mapper.service.ts:277-278`):
   ```typescript
   } else if (raw.toLowerCase() === 'off') {
       return true;  // BUG: Should be false
   }
   ```

2. **Light/Switch Mappers** - inverted warning logic:
   ```typescript
   if (!onProp) {
       return null;
   } else {
       this.logger.warn('Missing main state property'); // Warns when EXISTS
   }
   ```
