# Implementation Plan: Intents Module Integration

## Overview

Integrate the new Intents module into the lights domain view (roles) and device detail (lighting) to:
1. Consolidate multiple device commands into a single intent
2. Add context to commands based on where they were triggered
3. Use IntentOverlayService for better UI state management (no jumping sliders)

---

## Current State Analysis

### Current Flow (lights domain view - role detail)
```dart
// _setBrightnessForAll sends individual commands per device
for (final target in targets) {
  await devicesService.setPropertyValue(brightnessProp.id, brightness);
}
```

**Problems:**
- Multiple WebSocket commands sent (one per device)
- Multiple intents created on backend
- No context information (origin, spaceId, roleKey)
- UI uses local state (`_sliderBrightness`) which can become stale

### Current Flow (device detail)
```dart
// _valueHelper.setPropertyValue sends command for single property
_valueHelper.setPropertyValue(context, brightnessProp, value);
```

**Problems:**
- No context information
- UI doesn't use IntentOverlayService for state

---

## Implementation Steps

### Phase 1: Add Batch Command Support to Panel

#### 1.1 Update Channel Properties Repository
**File:** `apps/panel/lib/modules/devices/repositories/channel_properties.dart`

Add new method for batch property updates:

```dart
/// Set multiple property values in a single command
/// This creates a single intent on the backend for all properties
Future<bool> setMultipleValues({
  required List<PropertyCommandItem> properties,
  PropertyCommandContext? context,
}) async {
  // Generate single request ID for tracking
  final requestId = const Uuid().v4();

  // Build properties array for command
  final propertiesPayload = properties.map((prop) => {
    'device': prop.deviceId,
    'channel': prop.channelId,
    'property': prop.propertyId,
    'value': prop.value,
  }).toList();

  // Build context if provided
  Map<String, dynamic>? contextPayload;
  if (context != null) {
    contextPayload = {
      if (context.origin != null) 'origin': context.origin,
      if (context.displayId != null) 'display_id': context.displayId,
      if (context.spaceId != null) 'space_id': context.spaceId,
      if (context.roleKey != null) 'role_key': context.roleKey,
      if (context.extra != null) 'extra': context.extra,
    };
  }

  // Send single command with all properties
  await _socketService.sendCommand(
    DevicesModuleConstants.channelPropertySetEvent,
    {
      'request_id': requestId,
      'properties': propertiesPayload,
      if (contextPayload != null) 'context': contextPayload,
    },
    DevicesModuleEventHandlerName.internalSetProperty,
    onAck: (response) { ... },
  );
}
```

#### 1.2 Add Supporting Models
**File:** `apps/panel/lib/modules/devices/models/property_command.dart` (new)

```dart
/// Item for batch property command
class PropertyCommandItem {
  final String deviceId;
  final String channelId;
  final String propertyId;
  final dynamic value;

  const PropertyCommandItem({
    required this.deviceId,
    required this.channelId,
    required this.propertyId,
    required this.value,
  });
}

/// Context for property command
class PropertyCommandContext {
  final String? origin;      // e.g., 'panel.system.room', 'panel.device'
  final String? displayId;
  final String? spaceId;
  final String? roleKey;     // e.g., 'main', 'ambient', 'task'
  final Map<String, dynamic>? extra;

  const PropertyCommandContext({
    this.origin,
    this.displayId,
    this.spaceId,
    this.roleKey,
    this.extra,
  });
}
```

#### 1.3 Update DevicesService
**File:** `apps/panel/lib/modules/devices/service.dart`

```dart
/// Set multiple property values in a single command
Future<bool> setMultiplePropertyValues({
  required List<PropertyCommandItem> properties,
  PropertyCommandContext? context,
}) async {
  return await _channelPropertiesRepository.setMultipleValues(
    properties: properties,
    context: context,
  );
}
```

---

### Phase 2: Integrate IntentOverlayService

#### 2.1 Add IntentOverlayService to Lights Domain View
**File:** `apps/panel/lib/features/deck/presentation/domain_views/lights_domain_view.dart`

```dart
class _LightRoleDetailPageState extends State<_LightRoleDetailPage> {
  // Add intent overlay service
  IntentOverlayService? _intentOverlayService;

  @override
  void initState() {
    super.initState();
    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
    } catch (_) {}
    // ... existing code
  }

  @override
  void dispose() {
    _intentOverlayService?.removeListener(_onIntentChanged);
    // ... existing code
  }

  void _onIntentChanged() {
    if (mounted) {
      setState(() {
        // Reset local slider values when intent completes/expires
        // The overlay service will provide the correct value
        _sliderBrightness = null;
        _sliderHue = null;
        _sliderTemperature = null;
        _sliderWhite = null;
      });
    }
  }
}
```

#### 2.2 Use Overlay Values in Sliders

```dart
Widget _buildBrightnessSlider(...) {
  // Check if any property is locked by an intent
  bool hasLockedProperty = false;
  double? overlayBrightness;

  for (final target in targets) {
    final device = devicesService.getDevice(target.deviceId);
    if (device is LightingDeviceView) {
      final channel = device.lightChannels.firstWhere(...);
      final brightnessProp = channel.brightnessProp;

      if (brightnessProp != null) {
        if (_intentOverlayService?.isPropertyLocked(
          target.deviceId, target.channelId, brightnessProp.id
        ) == true) {
          hasLockedProperty = true;
          // Get overlay value from intent
          final overlay = _intentOverlayService?.getOverlayValue(
            target.deviceId, target.channelId, brightnessProp.id
          );
          if (overlay is num) {
            overlayBrightness = overlay.toDouble();
          }
        }
      }
    }
  }

  // Use overlay value if available, then local slider, then actual value
  final displayValue = overlayBrightness ?? _sliderBrightness ?? currentBrightness.toDouble();

  return ColoredSlider(
    value: displayValue,
    enabled: !hasLockedProperty, // Disable during intent
    // ...
  );
}
```

---

### Phase 3: Update Role Detail Commands

#### 3.1 Consolidate Brightness Command
**File:** `apps/panel/lib/features/deck/presentation/domain_views/lights_domain_view.dart`

Replace individual commands with single batch command:

```dart
Future<void> _setBrightnessForAll(
  BuildContext context,
  List<LightTargetView> targets,
  int brightness,
  DevicesService devicesService,
) async {
  // Build list of properties to update
  final List<PropertyCommandItem> properties = [];

  for (final target in targets) {
    if (!target.hasBrightness) continue;

    final device = devicesService.getDevice(target.deviceId);
    if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
      final channel = device.lightChannels.firstWhere(
        (c) => c.id == target.channelId,
        orElse: () => device.lightChannels.first,
      );

      final brightnessProp = channel.brightnessProp;
      if (brightnessProp != null) {
        properties.add(PropertyCommandItem(
          deviceId: target.deviceId,
          channelId: target.channelId,
          propertyId: brightnessProp.id,
          value: brightness,
        ));
      }
    }
  }

  if (properties.isEmpty) return;

  // Get display ID from display service
  final displayService = locator<DisplayService>();

  // Build context
  final commandContext = PropertyCommandContext(
    origin: 'panel.system.room',
    displayId: displayService.display?.id,
    spaceId: widget.roomId,
    roleKey: widget.role.name, // e.g., 'main', 'ambient', 'task'
  );

  // Send single command for all properties
  final success = await devicesService.setMultiplePropertyValues(
    properties: properties,
    context: commandContext,
  );

  if (!success && mounted) {
    final localizations = AppLocalizations.of(context);
    AlertBar.showError(
      context,
      message: localizations?.action_failed ?? 'Failed to set brightness',
    );
  }
}
```

#### 3.2 Apply Same Pattern to Other Sliders
- `_setHueForAll` → same pattern with `hueProp`
- `_setTemperatureForAll` → same pattern with `temperatureProp`
- `_setWhiteForAll` → same pattern with `colorWhiteProp`

#### 3.3 Update Toggle All Lights
```dart
Future<void> _toggleAllLights(...) async {
  final List<PropertyCommandItem> properties = [];

  for (final target in targets) {
    // ... get on property
    properties.add(PropertyCommandItem(
      deviceId: target.deviceId,
      channelId: target.channelId,
      propertyId: onProp.id,
      value: !anyOn, // Toggle state
    ));
  }

  await devicesService.setMultiplePropertyValues(
    properties: properties,
    context: PropertyCommandContext(
      origin: 'panel.system.room',
      displayId: displayService.display?.id,
      spaceId: widget.roomId,
      roleKey: widget.role.name,
    ),
  );
}
```

---

### Phase 4: Update Device Detail (Lighting)

#### 4.1 Add Context to Device Detail Commands
**File:** `apps/panel/lib/modules/devices/presentation/device_details/lighting.dart`

Update `_ChannelPropertyValueHelper.setPropertyValue`:

```dart
Future<bool> setPropertyValue(
  BuildContext context,
  ChannelPropertyView property,
  dynamic value, {
  PropertyCommandContext? commandContext,
}) async {
  // Create context if not provided
  final ctx = commandContext ?? PropertyCommandContext(
    origin: 'panel.device',
    displayId: _displayService.display?.id,
  );

  // Use new method with context
  return await _service.setPropertyValueWithContext(
    propertyId: property.id,
    channelId: property.channelId,
    deviceId: _device.id,
    value: value,
    context: ctx,
  );
}
```

#### 4.2 Use IntentOverlayService in Device Detail
```dart
class _LightingChannelState extends State<LightingChannel> {
  IntentOverlayService? _intentOverlayService;

  @override
  void initState() {
    super.initState();
    _intentOverlayService = locator<IntentOverlayService>();
    _intentOverlayService?.addListener(_onIntentChanged);
  }

  // Use overlay for slider value
  Widget _buildBrightnessSlider() {
    final isLocked = _intentOverlayService?.isPropertyLocked(
      _device.id, _channel.id, _channel.brightnessProp!.id
    ) ?? false;

    final overlayValue = _intentOverlayService?.getOverlayValue(
      _device.id, _channel.id, _channel.brightnessProp!.id
    );

    final displayValue = overlayValue ?? _localBrightness ?? _channel.brightness;

    return ColoredSlider(
      value: displayValue.toDouble(),
      enabled: !isLocked,
      // ...
    );
  }
}
```

---

### Phase 5: Remove Local Slider State Management

Once IntentOverlayService is integrated, the local slider state variables become redundant:

```dart
// BEFORE (current)
double? _sliderBrightness;
// Reset in _onSpacesDataChanged

// AFTER (with intents)
// IntentOverlayService manages the optimistic state
// No need for local slider variables
// Slider value comes from: overlayValue ?? actualDeviceValue
```

However, keep debounce timers to prevent API flooding during rapid slider movement.

---

## Intent Origins Reference

| Origin | Description | When to Use |
|--------|-------------|-------------|
| `panel.system.room` | Room/space view | Role detail page, domain views |
| `panel.system.master` | Master view | Master control panel |
| `panel.system.entry` | Entry view | Entry/landing page |
| `panel.dashboard.tiles` | Dashboard tiles | Tile controls |
| `panel.dashboard.cards` | Dashboard cards | Card controls |
| `panel.device` | Device detail | Single device control page |
| `panel.scenes` | Scenes | Scene execution |
| `admin` | Admin interface | Admin panel |
| `api` | Direct API | External API calls |

---

## Files to Modify

### New Files
- `apps/panel/lib/modules/devices/models/property_command.dart`

### Modified Files
1. `apps/panel/lib/modules/devices/repositories/channel_properties.dart`
   - Add `setMultipleValues` method

2. `apps/panel/lib/modules/devices/service.dart`
   - Add `setMultiplePropertyValues` method
   - Add `setPropertyValueWithContext` method

3. `apps/panel/lib/features/deck/presentation/domain_views/lights_domain_view.dart`
   - Add IntentOverlayService integration
   - Update `_setBrightnessForAll` to use batch command
   - Update `_setHueForAll` to use batch command
   - Update `_setTemperatureForAll` to use batch command
   - Update `_setWhiteForAll` to use batch command
   - Update `_toggleAllLights` to use batch command

4. `apps/panel/lib/modules/devices/presentation/device_details/lighting.dart`
   - Add context to commands
   - Add IntentOverlayService integration

---

## Testing Checklist

- [ ] Single device brightness change creates one intent
- [ ] Multi-device role brightness change creates one intent with multiple targets
- [ ] Slider stays at set value during intent pending state
- [ ] Slider shows correct value after intent completes
- [ ] Failed intents show error and revert to previous value
- [ ] Context is correctly passed (origin, spaceId, roleKey)
- [ ] Device detail passes correct context (origin: 'panel.device')
- [ ] Role detail passes correct context (origin: 'panel.system.room', roleKey)

---

## Benefits

1. **Reduced Network Traffic**: One command instead of N commands for N devices
2. **Better UX**: No slider jumping - IntentOverlayService provides stable values
3. **Failure Handling**: Clear indication when some devices fail
4. **Traceability**: Context enables debugging and analytics
5. **Consistency**: Same command format across all control surfaces
