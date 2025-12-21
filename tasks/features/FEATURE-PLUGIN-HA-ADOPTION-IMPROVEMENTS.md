# Task: Improve Home Assistant Device Adoption Process
ID: FEATURE-PLUGIN-HA-ADOPTION-IMPROVEMENTS
Type: feature
Scope: backend
Size: large
Parent: FEATURE-PLUGIN-HA-AUTO-MAP
Status: completed
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
- Related plugin location: `apps/backend/src/plugins/devices-home-assistant/`
- Plugin registration: `devices-home-assistant.plugin.ts`

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

- [x] Light device with sensor entities is correctly categorized as LIGHTING (not SENSOR)
- [x] All supported color modes are offered during light adoption (RGB, HS, color_temp, white)
- [x] Color properties are correctly mapped based on `supported_color_modes` attribute
- [x] Binary sensor mapper correctly returns `false` for off states (bug fix)
- [x] Light and switch mappers have correct warning log logic (bug fix)
- [x] Primary domain rules have higher priority than sensor rules
- [x] Unit tests pass for all modified components
- [x] Existing devices continue to work (no breaking changes)

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
- Register new services in `devices-home-assistant.plugin.ts` providers array

## 7. Implementation hints

### Phase 1: Fix Existing Bugs (LOW RISK)

#### Bug 1: Binary Sensor Mapper returns wrong value

**File**: `mappers/binary-sensor.entity.mapper.service.ts`
**Lines**: 275-278

```typescript
// CURRENT (BUG):
if (raw.toLowerCase() === 'on' || raw.toLowerCase() === 'true') {
    return true;
} else if (raw.toLowerCase() === 'off' || raw.toLowerCase() === 'false') {
    return true;  // <-- BUG: Should return false
}

// FIX:
if (raw.toLowerCase() === 'on' || raw.toLowerCase() === 'true') {
    return true;
} else if (raw.toLowerCase() === 'off' || raw.toLowerCase() === 'false') {
    return false;  // <-- FIXED
}
```

#### Bug 2: Light Mapper inverted warning logic

**File**: `mappers/light.entity.mapper.service.ts`
**Lines**: 214-218

```typescript
// CURRENT (BUG):
if (!onProp) {
    return null;
} else {
    this.logger.warn('[LIGHT ENTITY MAPPER] Missing main state property');
}

// FIX:
if (!onProp) {
    this.logger.warn('[LIGHT ENTITY MAPPER] Missing main state property');
    return null;
}
// Remove else block entirely
```

#### Bug 3: Switch Mapper inverted warning logic

**File**: `mappers/switch.entity.mapper.service.ts`
**Lines**: 71-75

```typescript
// CURRENT (BUG):
if (!onProp) {
    return null;
} else {
    this.logger.warn('[HOME ASSISTANT][SWITCH ENTITY MAPPER] Missing main state property');
}

// FIX:
if (!onProp) {
    this.logger.warn('[HOME ASSISTANT][SWITCH ENTITY MAPPER] Missing main state property');
    return null;
}
// Remove else block entirely
```

---

### Phase 2: Improve Device Category Inference

**Problem**: The `inferDeviceCategory()` function sums all rule priorities, causing sensors to outweigh primary devices.

**File**: `services/ha-entity-mapping.rules.ts`

#### Step 2.1: Add Entity Role Constants

Add after line 64 (after `HaEntityMappingRule` interface):

```typescript
/**
 * Classifies HA domains by their role in multi-entity devices
 */
export enum EntityRole {
    PRIMARY = 'primary',      // Main function: light, switch, climate, etc.
    SECONDARY = 'secondary',  // Supporting sensors on multi-entity devices
    STANDALONE = 'standalone' // Can be primary alone: sensor-only devices
}

/**
 * Maps HA domains to their typical role
 */
export const DOMAIN_ROLES: Record<HomeAssistantDomain, EntityRole> = {
    // Primary domains - these define what the device IS
    [HomeAssistantDomain.LIGHT]: EntityRole.PRIMARY,
    [HomeAssistantDomain.SWITCH]: EntityRole.PRIMARY,
    [HomeAssistantDomain.CLIMATE]: EntityRole.PRIMARY,
    [HomeAssistantDomain.COVER]: EntityRole.PRIMARY,
    [HomeAssistantDomain.FAN]: EntityRole.PRIMARY,
    [HomeAssistantDomain.LOCK]: EntityRole.PRIMARY,
    [HomeAssistantDomain.VALVE]: EntityRole.PRIMARY,
    [HomeAssistantDomain.VACUUM]: EntityRole.PRIMARY,
    [HomeAssistantDomain.MEDIA_PLAYER]: EntityRole.PRIMARY,
    [HomeAssistantDomain.HUMIDIFIER]: EntityRole.PRIMARY,
    [HomeAssistantDomain.ALARM_CONTROL_PANEL]: EntityRole.PRIMARY,
    [HomeAssistantDomain.WATER_HEATER]: EntityRole.PRIMARY,
    [HomeAssistantDomain.CAMERA]: EntityRole.PRIMARY,
    [HomeAssistantDomain.SIREN]: EntityRole.PRIMARY,

    // Standalone - can be primary if no other domains present
    [HomeAssistantDomain.SENSOR]: EntityRole.STANDALONE,
    [HomeAssistantDomain.BINARY_SENSOR]: EntityRole.STANDALONE,

    // Secondary - typically supporting entities
    [HomeAssistantDomain.BUTTON]: EntityRole.SECONDARY,
    [HomeAssistantDomain.INPUT_BOOLEAN]: EntityRole.SECONDARY,
    [HomeAssistantDomain.INPUT_NUMBER]: EntityRole.SECONDARY,
    [HomeAssistantDomain.INPUT_SELECT]: EntityRole.SECONDARY,
    [HomeAssistantDomain.INPUT_TEXT]: EntityRole.SECONDARY,
    [HomeAssistantDomain.REMOTE]: EntityRole.SECONDARY,
    [HomeAssistantDomain.SCENE]: EntityRole.SECONDARY,
    [HomeAssistantDomain.SCRIPT]: EntityRole.SECONDARY,
    [HomeAssistantDomain.AUTOMATION]: EntityRole.SECONDARY,
    [HomeAssistantDomain.NUMBER]: EntityRole.SECONDARY,
    [HomeAssistantDomain.SELECT]: EntityRole.SECONDARY,
    [HomeAssistantDomain.TEXT]: EntityRole.SECONDARY,
    [HomeAssistantDomain.UPDATE]: EntityRole.SECONDARY,
    [HomeAssistantDomain.DEVICE_TRACKER]: EntityRole.SECONDARY,
    [HomeAssistantDomain.PERSON]: EntityRole.SECONDARY,
    [HomeAssistantDomain.ZONE]: EntityRole.SECONDARY,
    [HomeAssistantDomain.WEATHER]: EntityRole.SECONDARY,
    [HomeAssistantDomain.CALENDAR]: EntityRole.SECONDARY,
    [HomeAssistantDomain.EVENT]: EntityRole.SECONDARY,
    [HomeAssistantDomain.IMAGE]: EntityRole.SECONDARY,
    [HomeAssistantDomain.IMAGE_PROCESSING]: EntityRole.SECONDARY,
    [HomeAssistantDomain.INPUT_BUTTON]: EntityRole.SECONDARY,
    [HomeAssistantDomain.INPUT_DATETIME]: EntityRole.SECONDARY,
    [HomeAssistantDomain.TIMER]: EntityRole.SECONDARY,
    [HomeAssistantDomain.LAWN_MOWER]: EntityRole.PRIMARY,
};
```

#### Step 2.2: Update inferDeviceCategory function

Replace the function at lines 822-845:

```typescript
/**
 * Get device category based on mapped channels and entity domains
 * Prioritizes primary domains over sensors when both are present
 */
export function inferDeviceCategory(
    mappedChannelCategories: ChannelCategory[],
    entityDomains?: HomeAssistantDomain[]
): DeviceCategory {
    // If we have domain information, check for primary domains first
    if (entityDomains && entityDomains.length > 0) {
        const primaryDomains = entityDomains.filter(
            d => DOMAIN_ROLES[d] === EntityRole.PRIMARY
        );

        if (primaryDomains.length > 0) {
            // Find the device category hint for the first primary domain
            for (const domain of primaryDomains) {
                const rule = HA_ENTITY_MAPPING_RULES.find(r => r.domain === domain);
                if (rule && rule.device_category_hint !== DeviceCategory.GENERIC) {
                    return rule.device_category_hint;
                }
            }
        }
    }

    // Fallback to existing scoring logic for sensor-only devices
    const hints = new Map<DeviceCategory, number>();

    for (const rule of HA_ENTITY_MAPPING_RULES) {
        if (mappedChannelCategories.includes(rule.channel_category)) {
            const current = hints.get(rule.device_category_hint) ?? 0;
            hints.set(rule.device_category_hint, current + (rule.priority ?? 1));
        }
    }

    let bestCategory: DeviceCategory = DeviceCategory.GENERIC;
    let bestScore = 0;

    for (const [category, score] of hints.entries()) {
        if (score > bestScore) {
            bestScore = score;
            bestCategory = category;
        }
    }

    return bestCategory;
}
```

#### Step 2.3: Update MappingPreviewService

**File**: `services/mapping-preview.service.ts`

In `generatePreview()` method (around line 117), pass entity domains:

```typescript
// Collect entity domains for category inference
const entityDomains = consolidatedPreviews
    .filter(e => e.status !== 'skipped' && e.status !== 'unmapped')
    .map(e => e.domain as HomeAssistantDomain);

// Determine suggested device category
const suggestedDeviceCategory = options?.deviceCategory
    ?? inferDeviceCategory(mappedChannelCategories, entityDomains);
```

Don't forget to import `HomeAssistantDomain` if not already imported.

---

### Phase 3: Light Capability Analysis

#### Step 3.1: Add Color Mode Constants

**File**: `devices-home-assistant.constants.ts`

Add at end of file:

```typescript
/**
 * Home Assistant light color modes
 * @see https://developers.home-assistant.io/docs/core/entity/light/#color-modes
 */
export enum LightColorMode {
    UNKNOWN = 'unknown',
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

/**
 * Maps color modes to the properties they support
 */
export const COLOR_MODE_PROPERTIES: Record<LightColorMode, PropertyCategory[]> = {
    [LightColorMode.UNKNOWN]: [PropertyCategory.ON],
    [LightColorMode.ONOFF]: [PropertyCategory.ON],
    [LightColorMode.BRIGHTNESS]: [PropertyCategory.ON, PropertyCategory.BRIGHTNESS],
    [LightColorMode.COLOR_TEMP]: [
        PropertyCategory.ON,
        PropertyCategory.BRIGHTNESS,
        PropertyCategory.COLOR_TEMPERATURE,
    ],
    [LightColorMode.HS]: [
        PropertyCategory.ON,
        PropertyCategory.BRIGHTNESS,
        PropertyCategory.HUE,
        PropertyCategory.SATURATION,
    ],
    [LightColorMode.XY]: [
        PropertyCategory.ON,
        PropertyCategory.BRIGHTNESS,
        // XY is typically converted to HS internally
        PropertyCategory.HUE,
        PropertyCategory.SATURATION,
    ],
    [LightColorMode.RGB]: [
        PropertyCategory.ON,
        PropertyCategory.BRIGHTNESS,
        PropertyCategory.COLOR_RED,
        PropertyCategory.COLOR_GREEN,
        PropertyCategory.COLOR_BLUE,
    ],
    [LightColorMode.RGBW]: [
        PropertyCategory.ON,
        PropertyCategory.BRIGHTNESS,
        PropertyCategory.COLOR_RED,
        PropertyCategory.COLOR_GREEN,
        PropertyCategory.COLOR_BLUE,
        PropertyCategory.COLOR_WHITE,
    ],
    [LightColorMode.RGBWW]: [
        PropertyCategory.ON,
        PropertyCategory.BRIGHTNESS,
        PropertyCategory.COLOR_RED,
        PropertyCategory.COLOR_GREEN,
        PropertyCategory.COLOR_BLUE,
        PropertyCategory.COLOR_WHITE,
        PropertyCategory.COLOR_TEMPERATURE,
    ],
    [LightColorMode.WHITE]: [
        PropertyCategory.ON,
        PropertyCategory.BRIGHTNESS,
        PropertyCategory.COLOR_WHITE,
    ],
};
```

Import `PropertyCategory` from devices constants.

#### Step 3.2: Create Light Capability Analyzer Service

**New File**: `services/light-capability.analyzer.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';

import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { COLOR_MODE_PROPERTIES, LightColorMode } from '../devices-home-assistant.constants';
import { HomeAssistantStateModel } from '../models/home-assistant.model';

export interface LightCapabilities {
    supportedColorModes: LightColorMode[];
    hasBrightness: boolean;
    hasColorTemp: boolean;
    hasHS: boolean;
    hasRGB: boolean;
    hasWhite: boolean;
    minColorTempKelvin?: number;
    maxColorTempKelvin?: number;
    effectList?: string[];
}

@Injectable()
export class LightCapabilityAnalyzer {
    private readonly logger = new Logger(LightCapabilityAnalyzer.name);

    /**
     * Analyze light entity capabilities from its attributes
     */
    analyzeCapabilities(state: HomeAssistantStateModel): LightCapabilities {
        const supportedModes = (state.attributes?.supported_color_modes as string[] ?? [])
            .map(m => m as LightColorMode);

        const hasColorTemp = supportedModes.includes(LightColorMode.COLOR_TEMP) ||
                            supportedModes.includes(LightColorMode.RGBWW);

        const hasRGB = supportedModes.includes(LightColorMode.RGB) ||
                      supportedModes.includes(LightColorMode.RGBW) ||
                      supportedModes.includes(LightColorMode.RGBWW);

        const hasHS = supportedModes.includes(LightColorMode.HS) ||
                     supportedModes.includes(LightColorMode.XY);

        const hasWhite = supportedModes.includes(LightColorMode.WHITE) ||
                        supportedModes.includes(LightColorMode.RGBW) ||
                        supportedModes.includes(LightColorMode.RGBWW);

        const hasBrightness = supportedModes.length > 0 &&
            !supportedModes.every(m => m === LightColorMode.ONOFF || m === LightColorMode.UNKNOWN);

        return {
            supportedColorModes: supportedModes,
            hasBrightness,
            hasColorTemp,
            hasHS,
            hasRGB,
            hasWhite,
            minColorTempKelvin: state.attributes?.min_color_temp_kelvin as number | undefined,
            maxColorTempKelvin: state.attributes?.max_color_temp_kelvin as number | undefined,
            effectList: state.attributes?.effect_list as string[] | undefined,
        };
    }

    /**
     * Get all properties that should be offered for a light based on capabilities
     */
    getAvailableProperties(capabilities: LightCapabilities): PropertyCategory[] {
        const properties = new Set<PropertyCategory>([PropertyCategory.ON]);

        // Add properties based on each supported color mode
        for (const mode of capabilities.supportedColorModes) {
            const modeProperties = COLOR_MODE_PROPERTIES[mode] ?? [];
            for (const prop of modeProperties) {
                properties.add(prop);
            }
        }

        // If no modes specified but we have brightness attribute, add it
        if (capabilities.hasBrightness) {
            properties.add(PropertyCategory.BRIGHTNESS);
        }

        this.logger.debug(
            `[LIGHT CAPABILITY] Detected properties: ${Array.from(properties).join(', ')} ` +
            `from modes: ${capabilities.supportedColorModes.join(', ')}`
        );

        return Array.from(properties);
    }

    /**
     * Get the HA attribute name for a property category
     */
    getHaAttributeForProperty(propertyCategory: PropertyCategory): string {
        const attributeMap: Partial<Record<PropertyCategory, string>> = {
            [PropertyCategory.ON]: 'fb.main_state',
            [PropertyCategory.BRIGHTNESS]: 'brightness',
            [PropertyCategory.COLOR_TEMPERATURE]: 'color_temp_kelvin',
            [PropertyCategory.HUE]: 'hs_color',
            [PropertyCategory.SATURATION]: 'hs_color',
            [PropertyCategory.COLOR_RED]: 'rgb_color',
            [PropertyCategory.COLOR_GREEN]: 'rgb_color',
            [PropertyCategory.COLOR_BLUE]: 'rgb_color',
            [PropertyCategory.COLOR_WHITE]: 'white',
        };

        return attributeMap[propertyCategory] ?? 'fb.main_state';
    }
}
```

#### Step 3.3: Register Service in Plugin

**File**: `devices-home-assistant.plugin.ts`

Add import:
```typescript
import { LightCapabilityAnalyzer } from './services/light-capability.analyzer';
```

Add to providers array (line ~99):
```typescript
providers: [
    // ... existing providers
    LightCapabilityAnalyzer,
],
```

#### Step 3.4: Update MappingPreviewService to Use Capability Analyzer

**File**: `services/mapping-preview.service.ts`

Add to constructor:
```typescript
constructor(
    private readonly homeAssistantHttpService: HomeAssistantHttpService,
    private readonly homeAssistantWsService: HomeAssistantWsService,
    private readonly lightCapabilityAnalyzer: LightCapabilityAnalyzer, // NEW
) {}
```

Add special handling for light entities in `processEntity()` method (around line 186):

```typescript
private processEntity(
    entityId: string,
    state: HomeAssistantStateModel | undefined,
    overrideChannelCategory?: ChannelCategory,
): EntityMappingPreviewModel {
    const domain = this.extractDomain(entityId);
    const deviceClass = state?.attributes?.device_class as string | null | undefined;
    const friendlyName = state?.attributes?.friendly_name as string | undefined;

    // Special handling for light entities - use capability analysis
    if (domain === HomeAssistantDomain.LIGHT && state) {
        return this.processLightEntity(entityId, state, overrideChannelCategory, friendlyName);
    }

    // ... existing logic for other domains
}

/**
 * Process light entity with capability-based property detection
 */
private processLightEntity(
    entityId: string,
    state: HomeAssistantStateModel,
    overrideChannelCategory?: ChannelCategory,
    friendlyName?: string,
): EntityMappingPreviewModel {
    const capabilities = this.lightCapabilityAnalyzer.analyzeCapabilities(state);
    const availableProperties = this.lightCapabilityAnalyzer.getAvailableProperties(capabilities);
    const channelCategory = overrideChannelCategory ?? ChannelCategory.LIGHT;

    // Generate property mappings for ALL available properties based on capabilities
    const suggestedProperties: PropertyMappingPreviewModel[] = [];

    for (const propCategory of availableProperties) {
        const propertyMetadata = getPropertyMetadata(channelCategory, propCategory);
        if (!propertyMetadata) continue;

        const haAttribute = this.lightCapabilityAnalyzer.getHaAttributeForProperty(propCategory);

        // Get current value if available
        let currentValue: unknown = null;
        if (haAttribute === 'fb.main_state') {
            currentValue = state.state;
        } else if (haAttribute === 'hs_color' && Array.isArray(state.attributes?.hs_color)) {
            const hsColor = state.attributes.hs_color as [number, number];
            currentValue = propCategory === PropertyCategory.HUE ? hsColor[0] : hsColor[1];
        } else if (haAttribute === 'rgb_color' && Array.isArray(state.attributes?.rgb_color)) {
            const rgbColor = state.attributes.rgb_color as [number, number, number];
            const index = propCategory === PropertyCategory.COLOR_RED ? 0 :
                         propCategory === PropertyCategory.COLOR_GREEN ? 1 : 2;
            currentValue = rgbColor[index];
        } else {
            currentValue = state.attributes?.[haAttribute];
        }

        // Apply brightness transform
        if (propCategory === PropertyCategory.BRIGHTNESS && typeof currentValue === 'number') {
            currentValue = Math.round((currentValue / 255) * 100);
        }

        suggestedProperties.push({
            category: propCategory,
            name: this.propertyNameFromCategory(propCategory),
            haAttribute,
            dataType: propertyMetadata.data_type,
            permissions: propertyMetadata.permissions,
            unit: propertyMetadata.unit,
            format: propertyMetadata.format,
            required: propertyMetadata.required,
            currentValue: this.normalizeValue(currentValue),
            haEntityId: entityId,
        });
    }

    return {
        entityId,
        domain: HomeAssistantDomain.LIGHT,
        deviceClass: null,
        currentState: state.state,
        attributes: state.attributes ?? {},
        status: 'mapped',
        suggestedChannel: {
            category: channelCategory,
            name: friendlyName ?? this.generateChannelName(entityId, channelCategory),
            confidence: 'high',
        },
        suggestedProperties,
        unmappedAttributes: [],
        missingRequiredProperties: [],
    };
}
```

---

### Phase 4: Increase Rule Priorities (SIMPLE)

**File**: `services/ha-entity-mapping.rules.ts`

Update priority values for primary domain rules:

| Domain | Current Priority | New Priority | Line |
|--------|-----------------|--------------|------|
| LIGHT | 10 | 50 | ~82 |
| SWITCH (outlet) | 20 | 60 | ~113 |
| SWITCH (generic) | 10 | 50 | ~121 |
| CLIMATE | 10 | 50 | ~385 |
| COVER (blind/curtain) | 20 | 60 | ~400 |
| COVER (door/garage) | 20 | 60 | ~416 |
| COVER (fallback) | 5 | 45 | ~431 |
| FAN | 10 | 50 | ~446 |
| LOCK | 10 | 50 | ~462 |
| VALVE | 10 | 50 | ~475 |
| VACUUM | 10 | 50 | ~490 |
| CAMERA | 10 | 50 | ~505 |
| MEDIA_PLAYER (tv) | 20 | 60 | ~517 |
| MEDIA_PLAYER (speaker) | 20 | 60 | ~527 |
| MEDIA_PLAYER (fallback) | 5 | 45 | ~624 |
| HUMIDIFIER | 20 | 60 | ~543/555 |
| ALARM_CONTROL_PANEL | 10 | 50 | ~569 |
| SIREN | 10 | 50 | ~584 |
| WATER_HEATER | 10 | 50 | ~608 |

Keep SENSOR and BINARY_SENSOR at priority 20.

---

### Phase 5: Add Unit Tests

#### Test 1: Update ha-entity-mapping.rules.spec.ts

Add tests for domain role-based inference:

```typescript
describe('inferDeviceCategory with domain roles', () => {
    it('should return LIGHTING for device with light + multiple sensors', () => {
        const channels = [
            ChannelCategory.LIGHT,
            ChannelCategory.ELECTRICAL_POWER,
            ChannelCategory.TEMPERATURE,
            ChannelCategory.HUMIDITY
        ];
        const domains = [
            HomeAssistantDomain.LIGHT,
            HomeAssistantDomain.SENSOR,
            HomeAssistantDomain.SENSOR,
            HomeAssistantDomain.SENSOR
        ];

        const category = inferDeviceCategory(channels, domains);

        expect(category).toBe(DeviceCategory.LIGHTING);
    });

    it('should return SENSOR for sensor-only device', () => {
        const channels = [ChannelCategory.TEMPERATURE, ChannelCategory.HUMIDITY];
        const domains = [HomeAssistantDomain.SENSOR, HomeAssistantDomain.SENSOR];

        const category = inferDeviceCategory(channels, domains);

        expect(category).toBe(DeviceCategory.SENSOR);
    });

    it('should return THERMOSTAT for climate device with sensors', () => {
        const channels = [ChannelCategory.THERMOSTAT, ChannelCategory.TEMPERATURE];
        const domains = [HomeAssistantDomain.CLIMATE, HomeAssistantDomain.SENSOR];

        const category = inferDeviceCategory(channels, domains);

        expect(category).toBe(DeviceCategory.THERMOSTAT);
    });
});
```

#### Test 2: Create light-capability.analyzer.spec.ts

**New File**: `services/__tests__/light-capability.analyzer.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';

import { PropertyCategory } from '../../../../modules/devices/devices.constants';
import { LightColorMode } from '../../devices-home-assistant.constants';

import { LightCapabilityAnalyzer } from '../light-capability.analyzer';

describe('LightCapabilityAnalyzer', () => {
    let analyzer: LightCapabilityAnalyzer;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [LightCapabilityAnalyzer],
        }).compile();

        analyzer = module.get(LightCapabilityAnalyzer);
    });

    describe('analyzeCapabilities', () => {
        it('should detect RGB capability from supported_color_modes', () => {
            const state = {
                entityId: 'light.test',
                state: 'off',
                attributes: {
                    supported_color_modes: ['rgb', 'color_temp'],
                },
                lastChanged: new Date(),
                lastReported: new Date(),
                lastUpdated: new Date(),
            };

            const capabilities = analyzer.analyzeCapabilities(state);

            expect(capabilities.hasRGB).toBe(true);
            expect(capabilities.hasColorTemp).toBe(true);
            expect(capabilities.hasBrightness).toBe(true);
        });

        it('should detect RGBW capability', () => {
            const state = {
                entityId: 'light.test',
                state: 'off',
                attributes: {
                    supported_color_modes: ['rgbw'],
                },
                lastChanged: new Date(),
                lastReported: new Date(),
                lastUpdated: new Date(),
            };

            const capabilities = analyzer.analyzeCapabilities(state);

            expect(capabilities.hasRGB).toBe(true);
            expect(capabilities.hasWhite).toBe(true);
        });

        it('should handle brightness-only lights', () => {
            const state = {
                entityId: 'light.test',
                state: 'on',
                attributes: {
                    supported_color_modes: ['brightness'],
                },
                lastChanged: new Date(),
                lastReported: new Date(),
                lastUpdated: new Date(),
            };

            const capabilities = analyzer.analyzeCapabilities(state);

            expect(capabilities.hasBrightness).toBe(true);
            expect(capabilities.hasRGB).toBe(false);
            expect(capabilities.hasColorTemp).toBe(false);
        });
    });

    describe('getAvailableProperties', () => {
        it('should return all color properties for RGBW light', () => {
            const capabilities = {
                supportedColorModes: [LightColorMode.RGBW],
                hasBrightness: true,
                hasColorTemp: false,
                hasHS: false,
                hasRGB: true,
                hasWhite: true,
            };

            const properties = analyzer.getAvailableProperties(capabilities);

            expect(properties).toContain(PropertyCategory.ON);
            expect(properties).toContain(PropertyCategory.BRIGHTNESS);
            expect(properties).toContain(PropertyCategory.COLOR_RED);
            expect(properties).toContain(PropertyCategory.COLOR_GREEN);
            expect(properties).toContain(PropertyCategory.COLOR_BLUE);
            expect(properties).toContain(PropertyCategory.COLOR_WHITE);
        });

        it('should return HS properties for hs mode', () => {
            const capabilities = {
                supportedColorModes: [LightColorMode.HS],
                hasBrightness: true,
                hasColorTemp: false,
                hasHS: true,
                hasRGB: false,
                hasWhite: false,
            };

            const properties = analyzer.getAvailableProperties(capabilities);

            expect(properties).toContain(PropertyCategory.HUE);
            expect(properties).toContain(PropertyCategory.SATURATION);
        });
    });
});
```

---

## 8. AI instructions

- Read this file entirely before making any code changes
- Start by replying with a short implementation plan (max 10 steps)
- Keep changes scoped to backend only
- **Implement Phase 1 (bug fixes) first** as they are low risk and high impact
- For each acceptance criterion, either implement it or explain why it's skipped
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
- Run tests after each phase: `pnpm run test:unit`
- When creating new services, register them in `devices-home-assistant.plugin.ts`

---

## Appendix: Root Cause Analysis

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

**Existing test acknowledges this** (ha-entity-mapping.rules.spec.ts:197-204):
```typescript
it('should prioritize higher priority device hints', () => {
    const category = inferDeviceCategory([ChannelCategory.LIGHT, ChannelCategory.TEMPERATURE]);
    // Light has priority 10, temperature sensor has priority 20
    expect([DeviceCategory.LIGHTING, DeviceCategory.SENSOR]).toContain(category);
    // ^^^ Test accepts BOTH outcomes as valid!
});
```

### Issue 2: Property Mapping Based on Current State Only

**Location**: `mapping-preview.service.ts:262-269`

```typescript
const hasValue = attributeValue !== undefined && attributeValue !== null;
if (hasValue || propertyMetadata.required) {
    suggestedProperties.push(...);
}
```

**Problem**: Color attributes are only present when light is ON and in that color mode. The `supported_color_modes` attribute (which tells us capabilities) is explicitly skipped in `internalAttributes` list (line 281).

### Issue 3: Mapper Bugs (Verified)

1. **Binary Sensor** (`binary-sensor.entity.mapper.service.ts:277-278`):
   ```typescript
   } else if (raw.toLowerCase() === 'off' || raw.toLowerCase() === 'false') {
       return true;  // BUG: Should return false
   }
   ```

2. **Light Mapper** (`light.entity.mapper.service.ts:214-218`) - inverted logic:
   ```typescript
   if (!onProp) {
       return null;
   } else {
       this.logger.warn('Missing main state property'); // Warns when EXISTS
   }
   ```

3. **Switch Mapper** (`switch.entity.mapper.service.ts:71-75`) - same issue:
   ```typescript
   if (!onProp) {
       return null;
   } else {
       this.logger.warn('Missing main state property'); // Warns when EXISTS
   }
   ```
