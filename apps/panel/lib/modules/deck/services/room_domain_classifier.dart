import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';

/// Classifies devices into domains for room overview.
///
/// This is a pure function module with no state.
/// All functions are deterministic - same input always produces same output.

/// Classifies a device category into a domain.
///
/// Returns null if the device category doesn't belong to any domain.
DomainType? classifyDeviceToDomain(DeviceCategory category) {
  switch (category) {
    // LIGHTS domain
    case DeviceCategory.lighting:
      return DomainType.lights;

    // CLIMATE domain
    case DeviceCategory.thermostat:
    case DeviceCategory.heater:
    case DeviceCategory.airConditioner:
    case DeviceCategory.fan:
    case DeviceCategory.airHumidifier:
    case DeviceCategory.airDehumidifier:
    case DeviceCategory.airPurifier:
      return DomainType.climate;

    // MEDIA domain
    case DeviceCategory.television:
    case DeviceCategory.media:
    case DeviceCategory.speaker:
      return DomainType.media;

    // SENSORS domain
    case DeviceCategory.sensor:
    case DeviceCategory.camera:
      return DomainType.sensors;

    // Not classified into any domain
    case DeviceCategory.generic:
    case DeviceCategory.alarm:
    case DeviceCategory.door:
    case DeviceCategory.doorbell:
    case DeviceCategory.lock:
    case DeviceCategory.outlet:
    case DeviceCategory.pump:
    case DeviceCategory.robotVacuum:
    case DeviceCategory.sprinkler:
    case DeviceCategory.switcher:
    case DeviceCategory.valve:
    case DeviceCategory.windowCovering:
      return null;
  }
}

/// Domain counts for a room.
class DomainCounts {
  final int lights;
  final int climate;
  final int media;
  final int sensors;

  const DomainCounts({
    this.lights = 0,
    this.climate = 0,
    this.media = 0,
    this.sensors = 0,
  });

  /// Get count for a specific domain.
  int getCount(DomainType domain) {
    switch (domain) {
      case DomainType.lights:
        return lights;
      case DomainType.climate:
        return climate;
      case DomainType.media:
        return media;
      case DomainType.sensors:
        return sensors;
    }
  }

  /// Returns true if a domain has any devices.
  bool hasDomain(DomainType domain) => getCount(domain) > 0;

  /// Returns all domains that have at least one device, sorted by display order.
  List<DomainType> get presentDomains {
    return DomainType.values
        .where((domain) => hasDomain(domain))
        .toList()
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
  }

  /// Returns true if any domain has devices.
  bool get hasAnyDomain => lights > 0 || climate > 0 || media > 0 || sensors > 0;

  /// Total device count across all domains.
  int get total => lights + climate + media + sensors;

  @override
  String toString() {
    return 'DomainCounts(lights: $lights, climate: $climate, media: $media, sensors: $sensors)';
  }
}

/// Builds domain counts from a list of device categories.
///
/// Each device is classified into at most one domain.
/// Devices that don't classify into any domain are not counted.
DomainCounts buildDomainCounts(List<DeviceCategory> deviceCategories) {
  int lights = 0;
  int climate = 0;
  int media = 0;
  int sensors = 0;

  for (final category in deviceCategories) {
    final domain = classifyDeviceToDomain(category);
    if (domain == null) continue;

    switch (domain) {
      case DomainType.lights:
        lights++;
        break;
      case DomainType.climate:
        climate++;
        break;
      case DomainType.media:
        media++;
        break;
      case DomainType.sensors:
        sensors++;
        break;
    }
  }

  return DomainCounts(
    lights: lights,
    climate: climate,
    media: media,
    sensors: sensors,
  );
}

/// Builds domain counts from device views using their categories.
DomainCounts buildDomainCountsFromCategories<T>({
  required List<T> items,
  required DeviceCategory Function(T) getCategory,
}) {
  return buildDomainCounts(items.map(getCategory).toList());
}
