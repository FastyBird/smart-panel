# Device Validation System

## Overview

The Device Validation System provides comprehensive validation for device structures against their specifications. It validates channels, properties, data types, permissions, and constraint relationships. Plugins can use this service to validate device structures before persisting them.

## Components

### DeviceValidationService

Located at: `src/modules/devices/services/device-validation.service.ts`

The service is exported from `DevicesModule` and can be injected into any plugin.

```typescript
import { DeviceValidationService } from '../modules/devices/services/device-validation.service';

@Injectable()
export class MyPluginService {
  constructor(
    private readonly deviceValidationService: DeviceValidationService,
  ) {}
}
```

## Constraint System

The validation system supports three types of constraints for both channel properties and device channels:

### Property Constraints (Channel → Properties)

Defined in: `spec/devices/channels.json`

| Constraint Type | Description | Example |
|-----------------|-------------|---------|
| `oneOf` | Only one property from the group can be present | `["density", "level"]` - can't have both |
| `oneOrMoreOf` | At least one property from the group must be present | `["detected", "density", "level"]` - need at least one |
| `mutuallyExclusiveGroups` | Property groups that cannot be mixed | RGB vs HSV color properties |

**Example - Ozone Channel:**
```json
{
  "ozone": {
    "category": "ozone",
    "constraints": {
      "oneOrMoreOf": [["detected", "density", "level"]],
      "oneOf": [["density", "level"]]
    },
    "properties": { ... }
  }
}
```

**Example - Light Channel (RGB vs HSV):**
```json
{
  "light": {
    "category": "light",
    "constraints": {
      "mutuallyExclusiveGroups": [
        [["color_red", "color_green", "color_blue"], ["hue", "saturation"]]
      ]
    },
    "properties": { ... }
  }
}
```

### Channel Constraints (Device → Channels)

Defined in: `spec/devices/devices.json`

Same constraint types apply for channels within devices.

**Example - Switcher Device:**
```json
{
  "switcher": {
    "category": "switcher",
    "constraints": {
      "oneOrMoreOf": [["outlet", "switcher"]],
      "mutuallyExclusiveGroups": [[["outlet"], ["switcher"]]]
    },
    "channels": {
      "outlet": { "required": false, "multiple": true, ... },
      "switcher": { "required": false, "multiple": true, ... }
    }
  }
}
```

This means a switcher device can have:
- Multiple outlet channels, OR
- Multiple switcher channels
- But NOT both at the same time

## API Reference

### Pre-Save Validation

Validate device structure before persisting (plain objects, not entities):

```typescript
const result = deviceValidationService.validateDeviceStructure({
  category: DeviceCategory.SWITCHER,
  channels: [
    {
      category: ChannelCategory.OUTLET,
      properties: [
        {
          category: PropertyCategory.ON,
          dataType: DataTypeType.BOOL,
          permissions: [PermissionType.READ_WRITE]
        }
      ]
    }
  ]
});

if (!result.isValid) {
  console.log('Validation issues:', result.issues);
}
```

### Post-Save Validation

Validate a persisted device entity:

```typescript
// By entity
const result = deviceValidationService.validateDevice(deviceEntity);

// By ID
const result = await deviceValidationService.validateDeviceById(deviceId);
```

### Helper Methods

```typescript
// Check if channel is allowed for device category
const allowed = deviceValidationService.isChannelAllowedForDevice(
  DeviceCategory.LIGHTING,
  ChannelCategory.LIGHT
);

// Get required channels for a device category
const requiredChannels = deviceValidationService.getRequiredChannelsForDevice(
  DeviceCategory.LIGHTING
);
// Returns: [ChannelCategory.LIGHT, ChannelCategory.DEVICE_INFORMATION]

// Get required properties for a channel category
const requiredProps = deviceValidationService.getRequiredPropertiesForChannel(
  ChannelCategory.LIGHT
);
// Returns: [PropertyCategory.ON]
```

## Validation Issue Types

| Issue Type | Severity | Description |
|------------|----------|-------------|
| `MISSING_CHANNEL` | Error | Required channel is missing |
| `MISSING_PROPERTY` | Error | Required property is missing |
| `INVALID_DATA_TYPE` | Warning | Property has incorrect data type |
| `INVALID_PERMISSIONS` | Warning | Property is missing required permissions |
| `INVALID_FORMAT` | Warning | Property format doesn't match spec |
| `UNKNOWN_CHANNEL` | Warning | Channel not defined in device spec |
| `DUPLICATE_CHANNEL` | Warning | Too many instances of non-multiple channel |
| `CONSTRAINT_ONE_OF_VIOLATION` | Error | Multiple properties from oneOf group present |
| `CONSTRAINT_ONE_OR_MORE_OF_VIOLATION` | Error | No property from oneOrMoreOf group present |
| `CONSTRAINT_MUTUALLY_EXCLUSIVE_VIOLATION` | Error | Properties from exclusive groups both present |

## Schema Utilities

Located at: `src/modules/devices/utils/schema.utils.ts`

Additional utilities for working with device/channel specifications:

```typescript
import {
  getChannelConstraints,
  getDeviceConstraints,
  getPropertyMetadata,
  getAllProperties,
  getAllowedChannels,
  isChannelAllowed,
  isChannelRequired,
  isChannelMultiple,
} from '../modules/devices/utils/schema.utils';

// Get constraints for a channel
const constraints = getChannelConstraints(ChannelCategory.LIGHT);
// Returns: { mutuallyExclusiveGroups: [[...RGB...], [...HSV...]] }

// Get constraints for a device
const deviceConstraints = getDeviceConstraints(DeviceCategory.SWITCHER);
// Returns: { oneOrMoreOf: [...], mutuallyExclusiveGroups: [...] }

// Get property metadata
const metadata = getPropertyMetadata(ChannelCategory.LIGHT, PropertyCategory.ON);
// Returns: { category, required, permissions, data_type, unit, format, ... }
```

## Spec File Locations

| File | Purpose |
|------|---------|
| `spec/devices/devices.schema.json` | JSON Schema for device specifications |
| `spec/devices/devices.json` | Device category definitions with channel constraints |
| `spec/devices/channels.schema.json` | JSON Schema for channel specifications |
| `spec/devices/channels.json` | Channel definitions with property constraints |

## Plugin Usage Example

```typescript
@Injectable()
export class ThirdPartyDevicePlatform {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly deviceValidationService: DeviceValidationService,
  ) {}

  async registerDevice(externalDevice: ExternalDeviceData): Promise<DeviceEntity> {
    // Build device structure from external data
    const deviceData: DeviceDataInput = {
      category: this.mapCategory(externalDevice.type),
      channels: this.buildChannels(externalDevice),
    };

    // Validate before saving
    const validation = this.deviceValidationService.validateDeviceStructure(deviceData);

    if (!validation.isValid) {
      const errors = validation.issues.filter(i => i.severity === 'error');
      if (errors.length > 0) {
        this.logger.error('Device validation failed:', errors);
        throw new Error(`Invalid device structure: ${errors[0].message}`);
      }

      // Log warnings but continue
      const warnings = validation.issues.filter(i => i.severity === 'warning');
      warnings.forEach(w => this.logger.warn(`Validation warning: ${w.message}`));
    }

    // Create device
    return this.devicesService.create({
      name: externalDevice.name,
      category: deviceData.category,
      // ... other fields
    });
  }
}
```

## Channels with Constraints

The following channels have property constraints defined:

| Channel | Constraints |
|---------|-------------|
| `ozone` | oneOrMoreOf: [detected, density, level], oneOf: [density, level] |
| `light` | mutuallyExclusiveGroups: [RGB] vs [HSV] |
| `air_particulate` | oneOrMoreOf: [detected, density] |
| `carbon_dioxide` | oneOrMoreOf: [detected, density] |
| `carbon_monoxide` | oneOrMoreOf: [detected, density] |
| `nitrogen_dioxide` | oneOrMoreOf: [detected, density] |
| `volatile_organic_compounds` | oneOrMoreOf: [detected, density, level], oneOf: [density, level] |

## Devices with Constraints

| Device | Constraints |
|--------|-------------|
| `switcher` | oneOrMoreOf: [outlet, switcher], mutuallyExclusiveGroups: [outlet] vs [switcher] |
