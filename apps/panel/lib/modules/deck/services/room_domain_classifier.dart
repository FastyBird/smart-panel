import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';

/// Classifies devices into domains for room overview.
///
/// This is a pure function module with no state.
/// All functions are deterministic - same input always produces same output.

/// Climate actuator device categories - devices that can actively control temperature.
/// These are the primary climate devices that determine if the climate domain is visible.
/// Matches backend's CLIMATE_PRIMARY_DEVICE_CATEGORIES in spaces.constants.ts
const climateActuatorCategories = {
  DevicesModuleDeviceCategory.thermostat,
  DevicesModuleDeviceCategory.heatingUnit,
  DevicesModuleDeviceCategory.airConditioner,
};

/// Climate auxiliary device categories - devices that support climate but don't control temperature.
/// These devices are shown in the climate domain only when actuators are present.
const climateAuxiliaryCategories = {
  DevicesModuleDeviceCategory.fan,
  DevicesModuleDeviceCategory.airHumidifier,
  DevicesModuleDeviceCategory.airDehumidifier,
  DevicesModuleDeviceCategory.airPurifier,
};

/// Returns true if the category is a climate actuator (can control temperature).
bool isClimateActuator(DevicesModuleDeviceCategory category) {
  return climateActuatorCategories.contains(category);
}

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

    // SHADING domain
    case DevicesModuleDeviceCategory.windowCovering:
      return DomainType.shading;

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
    case DevicesModuleDeviceCategory.$unknown:
      return null;
  }
}

/// Domain counts for a room.
class DomainCounts {
  final int lights;
  final int climate;
  final int climateActuators;
  final int shading;
  final int media;
  final int sensors;

  const DomainCounts({
    this.lights = 0,
    this.climate = 0,
    this.climateActuators = 0,
    this.shading = 0,
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
      case DomainType.shading:
        return shading;
      case DomainType.media:
        return media;
      case DomainType.sensors:
        return sensors;
    }
  }

  /// Returns true if a domain has any devices that make it visible.
  /// For climate domain, requires at least one actuator device (thermostat, heater, AC).
  bool hasDomain(DomainType domain) {
    if (domain == DomainType.climate) {
      // Climate domain is only visible when there are actuators
      return climateActuators > 0;
    }
    return getCount(domain) > 0;
  }

  /// Returns all domains that have at least one device, sorted by display order.
  List<DomainType> get presentDomains {
    return DomainType.values
        .where((domain) => hasDomain(domain))
        .toList()
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
  }

  /// Returns true if any domain has devices that make it visible.
  /// Uses hasDomain logic, so climate requires actuators.
  bool get hasAnyDomain =>
      lights > 0 || climateActuators > 0 || shading > 0 || media > 0 || sensors > 0;

  /// Total device count across all domains.
  int get total => lights + climate + shading + media + sensors;

  @override
  String toString() {
    return 'DomainCounts(lights: $lights, climate: $climate, climateActuators: $climateActuators, shading: $shading, media: $media, sensors: $sensors)';
  }
}

/// Builds domain counts from a list of device categories.
///
/// Each device is classified into at most one domain.
/// Devices that don't classify into any domain are not counted.
/// For climate domain, also tracks actuators separately to determine visibility.
DomainCounts buildDomainCounts(List<DevicesModuleDeviceCategory> deviceCategories) {
  int lights = 0;
  int climate = 0;
  int climateActuators = 0;
  int shading = 0;
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
        // Track actuators separately for visibility check
        if (isClimateActuator(category)) {
          climateActuators++;
        }
        break;
      case DomainType.shading:
        shading++;
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
    climateActuators: climateActuators,
    shading: shading,
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
