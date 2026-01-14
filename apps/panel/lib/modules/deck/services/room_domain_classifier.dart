import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';

/// Classifies devices into domains for room overview.
///
/// This is a pure function module with no state.
/// All functions are deterministic - same input always produces same output.

/// Classifies a device category into a domain.
///
/// Returns null if the device category doesn't belong to any domain.
DomainType? classifyDeviceToDomain(DevicesModuleDeviceCategory category) {
  switch (category) {
    // LIGHTS domain
    case DevicesModuleDeviceCategory.lighting:
      return DomainType.lights;

    // CLIMATE domain
    case DevicesModuleDeviceCategory.thermostat:
    case DevicesModuleDeviceCategory.heatingUnit:
    case DevicesModuleDeviceCategory.airConditioner:
    case DevicesModuleDeviceCategory.fan:
    case DevicesModuleDeviceCategory.airHumidifier:
    case DevicesModuleDeviceCategory.airDehumidifier:
    case DevicesModuleDeviceCategory.airPurifier:
      return DomainType.climate;

    // MEDIA domain
    case DevicesModuleDeviceCategory.television:
    case DevicesModuleDeviceCategory.media:
    case DevicesModuleDeviceCategory.speaker:
      return DomainType.media;

    // SENSORS domain
    case DevicesModuleDeviceCategory.sensor:
    case DevicesModuleDeviceCategory.camera:
      return DomainType.sensors;

    // Not classified into any domain
    case DevicesModuleDeviceCategory.generic:
    case DevicesModuleDeviceCategory.alarm:
    case DevicesModuleDeviceCategory.door:
    case DevicesModuleDeviceCategory.doorbell:
    case DevicesModuleDeviceCategory.lock:
    case DevicesModuleDeviceCategory.outlet:
    case DevicesModuleDeviceCategory.pump:
    case DevicesModuleDeviceCategory.robotVacuum:
    case DevicesModuleDeviceCategory.sprinkler:
    case DevicesModuleDeviceCategory.switcher:
    case DevicesModuleDeviceCategory.valve:
    case DevicesModuleDeviceCategory.waterHeater:
    case DevicesModuleDeviceCategory.windowCovering:
    case DevicesModuleDeviceCategory.$unknown:
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
DomainCounts buildDomainCounts(List<DevicesModuleDeviceCategory> deviceCategories) {
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
  required DevicesModuleDeviceCategory Function(T) getCategory,
}) {
  return buildDomainCounts(items.map(getCategory).toList());
}
