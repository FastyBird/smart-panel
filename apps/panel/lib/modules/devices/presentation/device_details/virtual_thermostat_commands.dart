import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';

/// Returns one device-scoped batch, or null when a configured branch has no
/// registered writable endpoint. The backend validates and commits the batch
/// atomically, preserving the requested mode independently of output activity.
List<PropertyCommandItem>? virtualThermostatModeCommands({
  required String mode,
  required bool hasHeating,
  required bool hasCooling,
  required PropertyCommandItem? heatingEnabled,
  required PropertyCommandItem? coolingEnabled,
}) {
  if (!const {'off', 'heat', 'cool', 'auto'}.contains(mode) ||
      (mode == 'heat' && !hasHeating) ||
      (mode == 'cool' && !hasCooling) ||
      (mode == 'auto' && (!hasHeating || !hasCooling)) ||
      (hasHeating && heatingEnabled == null) ||
      (hasCooling && coolingEnabled == null)) {
    return null;
  }
  PropertyCommandItem command(PropertyCommandItem endpoint, bool enabled) =>
      PropertyCommandItem(
        deviceId: endpoint.deviceId,
        channelId: endpoint.channelId,
        propertyId: endpoint.propertyId,
        value: enabled,
      );
  return [
    if (hasHeating) command(heatingEnabled!, mode == 'heat' || mode == 'auto'),
    if (hasCooling) command(coolingEnabled!, mode == 'cool' || mode == 'auto'),
  ];
}
