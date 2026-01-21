# Shelly NG YAML Mapping Configuration

The Shelly NG plugin supports YAML-based mapping configurations that allow flexible device-to-channel mapping based on user-selected device categories. This system is similar to those used in zigbee2mqtt and Home Assistant plugins.

## Overview

The mapping system enables:
- **Flexible Device Categorization**: Configure how devices map to channel categories based on user-selected device category (e.g., configure a Shelly 1PM as LIGHTING instead of SWITCHER)
- **Value Transformation**: Transform values between Shelly format and Smart Panel format using transformers
- **Property Derivation**: Derive properties from other properties using derivation rules
- **User Customization**: Override built-in mappings with custom user mappings

## Mapping Files

Mapping files are YAML files that define how Shelly components map to Smart Panel channels. They are located in:

- **Built-in mappings**: `mappings/definitions/*.yaml`
- **User custom mappings**: `var/data/shelly-ng/mappings/` (configurable via `SHELLY_NG_MAPPINGS_PATH` env var)

### File Structure

```yaml
version: "1.0"

# Optional: Named transformers for reuse
transformers:
  boolean_state:
    type: boolean
    true_value: true
    false_value: false

# Optional: Named derivation rules for reuse
derivations:
  battery_status:
    description: "Derive battery status from percentage"
    rule:
      type: threshold
      thresholds:
        - max: 20
          value: "low"
        - value: "normal"

# Required: Mapping definitions
mappings:
  - name: switch_as_light
    description: "Shelly switch component mapped as light channel"
    priority: 100
    match:
      all_of:
        - component_type: switch
        - device_category: LIGHTING
    channels:
      - identifier: "switch:{key}"
        name: "Light: {key}"
        category: LIGHT
        properties:
          - shelly_property: output
            panel:
              identifier: ON
              data_type: BOOL
            transformer: boolean_state
```

## Match Conditions

Mappings are selected based on match conditions that evaluate:

- `component_type`: Shelly component type (switch, cover, light, rgb, etc.)
- `device_category`: User-selected device category (LIGHTING, SWITCHER, OUTLET, etc.)
- `model`: Device model ID (for device-specific mappings)
- `profile`: Device profile (switch, cover, etc.)

Conditions support:
- **Simple conditions**: Direct value matching
- **all_of**: All conditions must match
- **any_of**: At least one condition must match
- **Nested conditions**: Combine all_of and any_of

Example:
```yaml
match:
  all_of:
    - component_type: switch
    - any_of:
        - device_category: LIGHTING
        - device_category: OUTLET
```

## Transformers

Transformers convert values between Shelly format and Smart Panel format. They can be:
- **Named transformers**: Defined in the `transformers` section and referenced by name
- **Inline transforms**: Defined directly in property mappings

### Available Transformer Types

#### Scale Transformer
Linear interpolation between ranges:
```yaml
transformer:
  type: scale
  input_range: [0, 100]    # Shelly range
  output_range: [0, 255]   # Panel range
```

#### Map Transformer
Value lookup tables with separate read/write maps:
```yaml
transformer:
  type: map
  read:
    opening: "opening"
    closing: "closing"
  write:
    open: "open"
    close: "close"
```

Or bidirectional mapping:
```yaml
transformer:
  type: map
  bidirectional:
    on: true
    off: false
```

#### Boolean Transformer
Converts between boolean and other values:
```yaml
transformer:
  type: boolean
  true_value: 1
  false_value: 0
  invert: false  # Optional
```

#### Clamp Transformer
Constrains values to a range:
```yaml
transformer:
  type: clamp
  min: 0
  max: 100
```

#### Round Transformer
Rounds numeric values:
```yaml
transformer:
  type: round
  precision: 2  # Decimal places
```

#### Formula Transformer
JavaScript expressions (use with caution):
```yaml
transformer:
  type: formula
  read: "value * 2"
  write: "value / 2"
```

## Derivation Rules

Derivation rules calculate property values from other properties:

### Threshold Derivation
Maps numeric ranges to enum values:
```yaml
derivations:
  battery_status:
    rule:
      type: threshold
      thresholds:
        - max: 20
          value: "low"
        - value: "normal"
```

### Boolean Map Derivation
Maps boolean values to enum values:
```yaml
derivations:
  lock_status:
    rule:
      type: boolean_map
      true_value: "locked"
      false_value: "unlocked"
```

### Position Status Derivation
Maps numeric position to status enum:
```yaml
derivations:
  cover_status_from_position:
    rule:
      type: position_status
      closed_value: "closed"
      opened_value: "opened"
      partial_value: "stopped"  # Optional
```

## Channel Definitions

Channels define how components map to Smart Panel channels:

```yaml
channels:
  - identifier: "switch:{key}"  # Template with {key} placeholder
    name: "Light: {key}"
    category: LIGHT
    properties:                    # Property mappings
      - shelly_property: output
        panel:
          identifier: ON
          data_type: BOOL
        transformer: boolean_state
    static_properties:            # Fixed-value properties
      - identifier: TYPE
        data_type: ENUM
        format: ["generic", "irrigation"]
        value: "generic"
    derived_properties:           # Calculated properties
      - identifier: STATUS
        data_type: ENUM
        source_property: PERCENTAGE
        derivation: battery_status
```

## Priority System

Mappings are evaluated by priority (higher = checked first):
- User mappings: 1000 (highest)
- Device-specific mappings: 500
- Generic mappings: 0-100 (lowest)

Within each priority level, mappings are checked in the order they appear in the file.

## Custom User Mappings

To create custom mappings:

1. Create YAML files in `var/data/shelly-ng/mappings/` (or path specified by `SHELLY_NG_MAPPINGS_PATH`)
2. Follow the same structure as built-in mappings
3. Files will be loaded automatically on module initialization
4. Use higher priority values to override built-in mappings

Example custom mapping:
```yaml
version: "1.0"

mappings:
  - name: custom_switch_mapping
    description: "Custom switch mapping for my use case"
    priority: 200  # Higher than built-in (100)
    match:
      component_type: switch
      device_category: CUSTOM_CATEGORY
    channels:
      - identifier: "switch:{key}"
        name: "Custom Switch: {key}"
        category: SWITCHER
        properties:
          - shelly_property: output
            panel:
              identifier: ON
              data_type: BOOL
```

## Template Interpolation

Channel identifiers and names support template interpolation:
- `{key}`: Replaced with component key/index

Example:
```yaml
identifier: "switch:{key}"  # Becomes "switch:0", "switch:1", etc.
name: "Light: {key}"        # Becomes "Light: 0", "Light: 1", etc.
```

## Error Handling

- If no mapping is found for a component, the system falls back to default channel mappings
- Invalid mappings are logged as warnings and skipped
- Missing transformers or derivations are logged as warnings
- Schema validation errors prevent mapping file loading

## Examples

See the built-in mapping files for examples:
- `definitions/switches.yaml`: Switch component mappings
- `definitions/lights.yaml`: Light component mappings
- `definitions/covers.yaml`: Cover component mappings
- `definitions/rgb.yaml`: RGB/RGBW/CCT component mappings
- `definitions/sensors.yaml`: Sensor component mappings
- `definitions/power.yaml`: Power monitoring mappings
- `definitions/derivation-rules.yaml`: Shared derivation rules

## Best Practices

1. **Use named transformers** for reusable transformations
2. **Use named derivations** for reusable derivation rules
3. **Set appropriate priorities** to control override behavior
4. **Document mappings** with descriptions
5. **Validate YAML** before deployment
6. **Test mappings** with actual devices
7. **Keep mappings simple** and focused on one component type

## Troubleshooting

**Mapping not found**: Check match conditions and ensure device category matches exactly (case-sensitive enum values)

**Transformer not working**: Verify transformer name matches exactly, or check inline transform syntax

**Derivation not working**: Ensure source property exists and derivation rule is correctly defined

**Priority issues**: Check priority values - higher priority mappings are checked first

For more details, see the TypeScript type definitions in `mapping.types.ts` and the JSON schema in `schema/mapping-schema.json`.