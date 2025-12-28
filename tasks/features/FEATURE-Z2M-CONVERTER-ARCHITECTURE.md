# Task: Zigbee2MQTT Modular Converter Architecture
ID: FEATURE-Z2M-CONVERTER-ARCHITECTURE
Type: feature
Scope: backend
Size: large
Parent: FEATURE-PLUGIN-ZIGBEE2MQTT
Status: done
Created: 2025-12-28
Completed: 2025-12-28

## 1. Business goal

In order to have more maintainable, extensible, and accurate device mapping for Zigbee2MQTT devices
As a Smart Panel developer
I want to refactor the exposes mapping system into a modular converter architecture inspired by homebridge-z2m, where each device type has its own dedicated converter with specialized handling.

## 2. Context

### Current Implementation
- The current zigbee2mqtt plugin uses a single `Z2mExposesMapperService` with a large `COMMON_PROPERTY_MAPPINGS` constant
- All device types (lights, sensors, covers, etc.) are handled by the same generic mapping logic
- Configuration is global, not per-device-type

### Inspiration: homebridge-z2m
- Repository: https://github.com/itavero/homebridge-z2m
- Uses a modular converter architecture with:
  - `BasicServiceCreatorManager` as a factory/registry for converters
  - Dedicated converters per device type (LightCreator, CoverCreator, ThermostatCreator, etc.)
  - 16 separate sensor handlers with a base class for common functionality
  - `StatelessProgrammableSwitchHandler` for button/remote devices
  - Per-converter configuration with validation
  - Characteristic monitors for state management

### Key Benefits of Modular Architecture
1. **Maintainability**: Each device type is isolated and easier to debug
2. **Extensibility**: New device types can be added without modifying existing code
3. **Specialized Handling**: Device-specific logic (e.g., adaptive lighting, motor state tracking)
4. **Configuration**: Per-device-type configuration options
5. **Testing**: Easier to unit test individual converters

## 3. Scope

### 3.1 In scope

**Phase 1: Converter Infrastructure**
- Create converter interface and base classes
- Implement converter registry pattern
- Maintain backward compatibility with existing mapping

**Phase 2: Device Converters**
- Light converter with color mode handling
- Switch converter
- Cover converter with motor state tracking
- Climate/thermostat converter
- Lock converter
- Fan converter

**Phase 3: Sensor Converters**
- Base sensor converter with tamper/battery support
- Temperature sensor converter
- Humidity sensor converter
- Occupancy sensor converter
- Contact sensor converter
- Leak sensor converter
- Smoke sensor converter
- Illuminance sensor converter
- Pressure sensor converter
- Motion/vibration sensor converter

**Phase 4: Special Converters**
- Action/button converter for remotes with multi-press detection
- Electrical monitoring converter (power, energy, voltage, current)

### 3.2 Out of scope

- Admin UI changes (separate task)
- Panel UI changes (separate task)
- Zigbee2MQTT groups support
- Device-specific configuration UI

## 4. Acceptance criteria

### Infrastructure
- [ ] Converter interface defined with `canHandle()` and `convert()` methods
- [ ] Base converter class with common functionality
- [ ] Converter registry that auto-discovers and registers converters
- [ ] Existing `Z2mExposesMapperService` refactored to use converter registry

### Device Converters
- [ ] Light converter handles: on/off, brightness, color_temp, color_hs (skips color_xy)
- [ ] Light converter respects `color_mode` property when updating state
- [ ] Switch converter handles single and multi-endpoint switches
- [ ] Cover converter handles position, tilt, and motor state
- [ ] Cover converter supports OPEN/CLOSE/STOP commands
- [ ] Climate converter handles local_temperature, setpoint, system_mode, running_state
- [ ] Lock converter handles lock/unlock state
- [ ] Fan converter handles on/off, speed, mode

### Sensor Converters
- [ ] Base sensor converter provides tamper and low_battery support
- [ ] Each sensor type has dedicated converter with proper channel category
- [ ] Temperature converter with °C unit and range validation
- [ ] Humidity converter with 0-100% range
- [ ] Occupancy/presence converter with binary detected state
- [ ] Contact converter with binary detected state
- [ ] Leak converter with binary detected state
- [ ] Smoke converter with binary detected state
- [ ] Illuminance converter with lux unit
- [ ] Pressure converter with hPa unit

### Action/Button Converter
- [ ] Action converter detects button press patterns (single, double, hold, release)
- [ ] Multi-button remotes create separate channels per button
- [ ] Action values are parsed to identify button and press type

### Testing
- [ ] Unit tests for converter registry
- [ ] Unit tests for each converter type
- [ ] Integration tests verifying backward compatibility

### Quality
- [ ] No breaking changes to existing device mappings
- [ ] All existing tests continue to pass
- [ ] New converters follow existing code patterns

## 5. Example scenarios

### Scenario: Light with color mode

Given a Zigbee light that supports both color_temp and color_hs
When the device reports `{ "state": "ON", "brightness": 200, "color_mode": "color_temp", "color_temp": 350, "color": { "hue": 180, "saturation": 50 } }`
Then the light converter should only update the color_temperature property
And should ignore the color values because color_mode is "color_temp"

### Scenario: Cover motor state tracking

Given a Zigbee cover with motor state expose
When the cover is opening and reports `{ "position": 50, "moving": "OPENING" }`
Then the cover converter should update position to 50
And should set status to "opening"
When the cover stops and reports `{ "position": 75, "moving": "STOP" }`
Then the cover converter should update position to 75
And should set status to "stopped"

### Scenario: Multi-button remote

Given a Zigbee remote with 4 buttons
When the device definition has exposes with `action` enum: `["1_single", "1_double", "1_hold", "2_single", "2_double", "2_hold", "3_single", "4_single"]`
Then the action converter should create 4 button channels
And each channel should have an event property
When an action `"2_double"` is received
Then button 2's event property should be updated to "double"

### Scenario: Sensor with tamper detection

Given a Zigbee motion sensor with tamper support
When the device exposes include `occupancy` (binary) and `tamper` (binary)
Then the occupancy converter should create:
- An occupancy channel with `detected` property
- Include `tampered` property in the same channel

## 6. Technical constraints

- Follow existing module/service structure in `apps/backend/src/plugins/devices-zigbee2mqtt/`
- Use NestJS dependency injection patterns
- Maintain the existing `MappedChannel` and `MappedProperty` interfaces
- Do not modify generated code
- Do not introduce new dependencies unless necessary
- Converters must be stateless (no instance state between conversions)
- All converters must handle missing/undefined exposes gracefully

## 7. Implementation hints

### Directory Structure

```
apps/backend/src/plugins/devices-zigbee2mqtt/
├── converters/
│   ├── index.ts                    # Barrel export
│   ├── converter.interface.ts      # IConverter interface
│   ├── converter.registry.ts       # ConverterRegistry service
│   ├── base.converter.ts           # BaseConverter abstract class
│   ├── devices/
│   │   ├── light.converter.ts
│   │   ├── switch.converter.ts
│   │   ├── cover.converter.ts
│   │   ├── climate.converter.ts
│   │   ├── lock.converter.ts
│   │   └── fan.converter.ts
│   ├── sensors/
│   │   ├── base-sensor.converter.ts
│   │   ├── temperature.converter.ts
│   │   ├── humidity.converter.ts
│   │   ├── occupancy.converter.ts
│   │   ├── contact.converter.ts
│   │   ├── leak.converter.ts
│   │   ├── smoke.converter.ts
│   │   ├── illuminance.converter.ts
│   │   ├── pressure.converter.ts
│   │   └── motion.converter.ts
│   └── special/
│       ├── action.converter.ts
│       └── electrical.converter.ts
├── services/
│   └── exposes-mapper.service.ts   # Refactored to use registry
└── ...
```

### Converter Interface

```typescript
interface IConverter {
  // Unique identifier for this converter
  readonly type: string;

  // Check if this converter can handle the given expose
  canHandle(expose: Z2mExpose): boolean;

  // Convert the expose to mapped channels
  convert(expose: Z2mExpose, context: ConversionContext): MappedChannel[];
}
```

### Registry Pattern

```typescript
@Injectable()
class ConverterRegistry {
  private converters: IConverter[] = [];

  register(converter: IConverter): void;

  findConverter(expose: Z2mExpose): IConverter | null;

  convertAll(exposes: Z2mExpose[]): MappedChannel[];
}
```

### Homebridge-z2m Patterns to Adopt

1. **Sensor Base Class**: Common tamper/battery handling
2. **Action Helper**: Parse action strings like "1_single" → button 1, single press
3. **Value Scaling**: Consistent 0-254/255 → 0-100% conversion
4. **Color Mode Respect**: Only update active color mode properties
5. **Motor State**: Track opening/closing/stopped for covers

## 8. AI instructions

- Read this file entirely before making any code changes
- Start by implementing the converter infrastructure (interface, base class, registry)
- Implement converters in order: devices → sensors → special
- Keep the existing `Z2mExposesMapperService` working during refactoring
- Add unit tests for each new converter
- Run existing tests after each major change to ensure backward compatibility
- Follow the coding style in existing zigbee2mqtt plugin files
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`

## 9. Implementation Checklist

### Phase 1: Infrastructure
- [x] Create `converters/converter.interface.ts` with IConverter interface
- [x] Create `converters/base.converter.ts` with BaseConverter abstract class
- [x] Create `converters/converter.registry.ts` with ConverterRegistry service
- [x] Create `converters/index.ts` barrel export
- [x] Add converters module to plugin module

### Phase 2: Device Converters
- [x] Implement `converters/devices/light.converter.ts`
- [x] Implement `converters/devices/switch.converter.ts`
- [x] Implement `converters/devices/cover.converter.ts`
- [x] Implement `converters/devices/climate.converter.ts`
- [x] Implement `converters/devices/lock.converter.ts`
- [x] Implement `converters/devices/fan.converter.ts`

### Phase 3: Sensor Converters
- [x] Implement `converters/sensors/base-sensor.converter.ts`
- [x] Implement `converters/sensors/temperature.converter.ts`
- [x] Implement `converters/sensors/humidity.converter.ts`
- [x] Implement `converters/sensors/occupancy.converter.ts`
- [x] Implement `converters/sensors/contact.converter.ts`
- [x] Implement `converters/sensors/leak.converter.ts`
- [x] Implement `converters/sensors/smoke.converter.ts`
- [x] Implement `converters/sensors/illuminance.converter.ts`
- [x] Implement `converters/sensors/pressure.converter.ts`
- [x] Implement `converters/sensors/motion.converter.ts`

### Phase 4: Special Converters
- [x] Implement `converters/special/action.converter.ts`
- [x] Implement `converters/special/electrical.converter.ts`

### Phase 5: Integration
- [x] Refactor `Z2mExposesMapperService` to use ConverterRegistry
- [x] Add unit tests for all converters
- [x] Run full test suite and fix any regressions
- [x] Update plugin module to register all converters
