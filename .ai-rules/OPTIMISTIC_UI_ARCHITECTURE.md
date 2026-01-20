# Optimistic UI Architecture - Device Details

This document describes the optimistic UI architecture for device control in the Smart Panel Flutter application.

## Overview

The device details screens use an optimistic UI pattern that provides immediate visual feedback when users interact with device controls. This improves perceived responsiveness by showing the expected state immediately, while the actual API call happens in the background.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Device Detail Page (UI)                        │
│                  (e.g., AirHumidifierDeviceDetails)              │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Device Controller                             │
│               (e.g., AirHumidifierDeviceController)             │
│  - Composes channel controllers                                  │
│  - Device-level getters (optimistic-aware)                       │
│  - Device-level commands (delegates to channels)                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
┌───────────────────┐ ┌─────────────────┐ ┌──────────────────────┐
│ HumidifierChannel │ │ FanChannel      │ │ Other Channel        │
│    Controller     │ │   Controller    │ │   Controllers...     │
│ - isOn            │ │ - isOn          │ │                      │
│ - humidity        │ │ - speed         │ │                      │
│ - setPower()      │ │ - setPower()    │ │                      │
│ - setHumidity()   │ │ - setSpeed()    │ │                      │
└─────────┬─────────┘ └────────┬────────┘ └──────────────────────┘
          │                    │
          └─────────┬──────────┘
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                 DeviceControlStateService                        │
│  - State machine per property                                    │
│  - Group API for coordinated updates (RGB, HSV)                  │
│  - Settling timeout management                                   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DevicesService                             │
│  - setPropertyValue() API calls                                  │
│  - Property change subscriptions                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Optimistic UI State Machine

Each property follows a 4-state machine:

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                       │
│     ┌───────┐                                                        │
│     │ IDLE  │◄──────────────────────────────────────────────┐        │
│     └───┬───┘                                               │        │
│         │                                                   │        │
│         │ User interaction                                  │        │
│         │ (command: setPower, setBrightness, etc.)         │        │
│         ▼                                                   │        │
│     ┌─────────┐                                             │        │
│     │ PENDING │ ← Shows desired value                       │        │
│     └────┬────┘                                             │        │
│          │                                                  │        │
│          ├─── API failure ──────────────────────────────────┤        │
│          │    (clear state, call onError)                   │        │
│          │                                                  │        │
│          │ API success                                      │        │
│          ▼                                                  │        │
│     ┌──────────┐                                            │        │
│     │ SETTLING │ ← Still shows desired value                │        │
│     └────┬─────┘   (waiting for actual value to match)      │        │
│          │                                                  │        │
│          │ Actual value matches OR timeout                  │        │
│          ▼                                                  │        │
│     ┌──────────┐                                            │        │
│     │  IDLE    │                                            │        │
│     └──────────┘                                            │        │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### State Details

| State | Locked | Description |
|-------|--------|-------------|
| IDLE | No | No pending command, show actual server value |
| PENDING | Yes | Command sent, show desired value until API responds |
| SETTLING | Yes | API succeeded, waiting for actual value to sync |

### Getter Behavior

```dart
bool get isOn {
  // Check if property is locked (PENDING or SETTLING)
  if (_controlState.isLocked(deviceId, channelId, prop.id)) {
    // Return the desired (optimistic) value
    final value = _controlState.getDesiredValue(deviceId, channelId, prop.id);
    if (value != null) return value as bool;
  }
  // Return actual server value
  return channel.on;
}
```

## Controller Pattern

### Channel Controllers

**Location:** `lib/modules/devices/controllers/channels/`

Each channel type has a controller that wraps its view:

| Controller | Channel | Key Properties |
|------------|---------|----------------|
| `FanChannelController` | Fan | isOn, swing, speed, mode |
| `HumidifierChannelController` | Humidifier | isOn, humidity, mode, mistLevel |
| `DehumidifierChannelController` | Dehumidifier | isOn, humidity, mode, timer |
| `HeaterChannelController` | Heater | isOn, temperature |
| `CoolerChannelController` | Cooler | isOn, temperature |
| `ThermostatChannelController` | Thermostat | isLocked |
| `LightChannelController` | Light | isOn, brightness, color (RGB/HSV) |

### Device Controllers

**Location:** `lib/modules/devices/controllers/devices/`

Device controllers compose channel controllers:

```dart
class AirHumidifierDeviceController {
  late final HumidifierChannelController _humidifierController;
  FanChannelController? _fanController;  // Optional

  // Access to channel controllers
  HumidifierChannelController get humidifier => _humidifierController;
  FanChannelController? get fan => _fanController;

  // Device-level getters (delegate to channels)
  bool get isOn => _humidifierController.isOn;

  // Device-level commands (delegate to channels)
  void setPower(bool value) => _humidifierController.setPower(value);
}
```

## Command Flow

```dart
void setPower(bool value) {
  final prop = channel.onProp;

  // 1. Set PENDING state immediately (optimistic update)
  _controlState.setPending(deviceId, channel.id, prop.id, value);

  // 2. Make API call
  _devicesService.setPropertyValue(prop.id, value).then((success) {
    if (success) {
      // 3a. On success: transition to SETTLING
      _controlState.setSettling(deviceId, channel.id, prop.id);
    } else {
      // 3b. On failure: clear state (rollback) and notify
      _controlState.clear(deviceId, channel.id, prop.id);
      _onError?.call(prop.id, Exception('Failed to set power'));
    }
  }).catchError((error) {
    // 3c. On exception: clear state (rollback) and notify
    _controlState.clear(deviceId, channel.id, prop.id);
    _onError?.call(prop.id, error);
  });
}
```

## Group API (for coordinated updates)

When multiple properties must update together (e.g., RGB color), use the group API:

```dart
void setColorRGB(int red, int green, int blue) {
  // 1. Set group PENDING state
  _controlState.setGroupPending(
    deviceId,
    colorGroupId,
    [
      PropertyConfig(channelId, redPropId, red),
      PropertyConfig(channelId, greenPropId, green),
      PropertyConfig(channelId, bluePropId, blue),
    ],
  );

  // 2. Make parallel API calls
  Future.wait([
    _devicesService.setPropertyValue(redPropId, red),
    _devicesService.setPropertyValue(greenPropId, green),
    _devicesService.setPropertyValue(bluePropId, blue),
  ]).then((results) {
    if (results.every((success) => success)) {
      // 3a. All succeeded: transition group to SETTLING
      _controlState.setGroupSettling(deviceId, colorGroupId);
    } else {
      // 3b. Any failed: clear group and notify
      _controlState.clearGroup(deviceId, colorGroupId);
      _onError?.call(redPropId, Exception('Failed to set RGB color'));
    }
  }).catchError((error) {
    _controlState.clearGroup(deviceId, colorGroupId);
    _onError?.call(redPropId, error);
  });
}
```

## Error Handling

### Error Callback

Controllers accept an optional error callback:

```dart
typedef ControllerErrorCallback = void Function(String propertyId, Object error);

final controller = FanChannelController(
  deviceId: device.id,
  channel: channel,
  controlState: controlState,
  devicesService: devicesService,
  onError: (propId, error) {
    // Handle error (e.g., show snackbar)
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Failed to update: $error')),
    );
  },
);
```

### Error Scenarios

| Scenario | Behavior |
|----------|----------|
| API returns `false` | Clear state, call `onError` |
| API throws exception | Clear state, call `onError` |
| Network timeout | Clear state (via catchError), call `onError` |

## Device Details Pages

Device detail pages use controllers directly:

```dart
class AirHumidifierDeviceDetails extends ConsumerStatefulWidget {
  late final AirHumidifierDeviceController _controller;

  @override
  void initState() {
    _controller = AirHumidifierDeviceController(
      device: widget.device,
      controlState: ref.read(deviceControlStateServiceProvider),
      devicesService: ref.read(devicesServiceProvider),
      onError: _handleError,
    );
  }

  // UI reads optimistic values from controller
  bool get _isOn => _controller.isOn;

  // Commands go through controller
  void _togglePower() => _controller.togglePower();
}
```

## Testing

### Channel Controller Tests

**Location:** `test/modules/devices/controllers/channels/`

Each controller has comprehensive tests for:
- **Optimistic-aware getters** - Return desired vs actual values
- **Passthrough getters** - Delegate to channel view
- **Commands** - State transitions (setPending → setSettling)
- **Error handling** - clear() on failure, onError callback
- **Null-safety** - Graceful handling when optional properties are null

### Device Controller Tests

**Location:** `test/modules/devices/controllers/devices/`

Device controllers are thin wrappers, so tests focus on:
- **Channel access** - Controllers are properly created
- **Delegation** - Commands delegate to correct channel controller

### Running Tests

```bash
cd apps/panel

# All controller tests
flutter test test/modules/devices/controllers/

# Specific controller
flutter test test/modules/devices/controllers/channels/fan_channel_controller_test.dart
```

## Decision: Controllers vs Direct Service Calls

### Why Controllers?

1. **Encapsulation** - State machine logic is centralized, not scattered in UI
2. **Testability** - Controllers can be unit tested without widget tests
3. **Consistency** - All device details follow the same pattern
4. **Reusability** - Channel controllers can be composed into different device controllers

### Why Not Direct Service Calls in UI?

The previous approach had `_setPropertyValue` methods directly in device detail pages:

```dart
// OLD APPROACH (in device details page)
void _togglePower() async {
  final prop = widget.device.onProp;
  _controlState.setPending(deviceId, channelId, prop.id, !_isOn);

  final success = await _devicesService.setPropertyValue(prop.id, !_isOn);
  if (success) {
    _controlState.setSettling(deviceId, channelId, prop.id);
  } else {
    _controlState.clear(deviceId, channelId, prop.id);
  }
}
```

Problems:
- Code duplication across device details
- Error handling inconsistent
- State machine logic mixed with UI logic
- Hard to test

## File Structure

```
lib/modules/devices/
├── controllers/
│   ├── channels/
│   │   ├── fan.dart
│   │   ├── humidifier.dart
│   │   ├── dehumidifier.dart
│   │   ├── heater.dart
│   │   ├── cooler.dart
│   │   ├── thermostat.dart
│   │   ├── light.dart
│   │   └── export.dart
│   ├── devices/
│   │   ├── fan.dart
│   │   ├── air_humidifier.dart
│   │   ├── air_dehumidifier.dart
│   │   ├── air_conditioner.dart
│   │   ├── air_purifier.dart
│   │   ├── heating_unit.dart
│   │   ├── thermostat.dart
│   │   ├── lighting.dart
│   │   └── export.dart
│   └── export.dart
├── services/
│   └── device_control_state.service.dart
└── models/
    └── control_state.dart
```
