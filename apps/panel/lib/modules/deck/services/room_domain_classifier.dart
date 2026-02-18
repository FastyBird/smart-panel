import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

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

/// Channel categories that indicate energy measurement capability.
const energyChannelCategories = {
  DevicesModuleChannelCategory.electricalEnergy,
  DevicesModuleChannelCategory.electricalGeneration,
  DevicesModuleChannelCategory.electricalPower,
};

/// Counts devices that have at least one energy-related channel.
///
/// A device is considered energy-capable if any of its channels has a
/// category in [energyChannelCategories].
int countEnergyDevices(List<DeviceView> devices) {
  return devices.where((device) {
    return device.channels.any(
      (channel) => energyChannelCategories.contains(channel.category),
    );
  }).length;
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
    case DevicesModuleDeviceCategory.avReceiver:
    case DevicesModuleDeviceCategory.gameConsole:
    case DevicesModuleDeviceCategory.projector:
    case DevicesModuleDeviceCategory.setTopBox:
    case DevicesModuleDeviceCategory.streamingService:
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

  /// Number of devices with energy-related channels (electrical_energy,
  /// electrical_generation, electrical_power). Determined from channel
  /// categories rather than device categories.
  final int energy;

  /// Number of sensor readings reported by the backend (from sensor roles).
  /// When 0, the sensors domain is not shown even if sensor-category devices
  /// exist, because no roles are assigned and the page would be empty.
  final int sensorReadings;

  const DomainCounts({
    this.lights = 0,
    this.climate = 0,
    this.climateActuators = 0,
    this.shading = 0,
    this.media = 0,
    this.sensors = 0,
    this.energy = 0,
    this.sensorReadings = 0,
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
      case DomainType.energy:
        return energy;
    }
  }

  /// Returns true if a domain has any devices that make it visible.
  /// For energy domain, requires at least one device with energy-related channels.
  /// Climate and sensors are shown when any devices of that type exist (even
  /// without full configuration) so users see a "not configured" message.
  bool hasDomain(DomainType domain) {
    if (domain == DomainType.energy) {
      return energy > 0;
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
  bool get hasAnyDomain =>
      lights > 0 || climate > 0 || shading > 0 || media > 0 || sensors > 0 || energy > 0;

  /// Total device count across all domains.
  int get total => lights + climate + shading + media + sensors;

  @override
  String toString() {
    return 'DomainCounts(lights: $lights, climate: $climate, climateActuators: $climateActuators, shading: $shading, media: $media, sensors: $sensors, energy: $energy, sensorReadings: $sensorReadings)';
  }
}

/// Builds domain counts from a list of device categories.
///
/// Each device is classified into at most one domain.
/// Devices that don't classify into any domain are not counted.
/// For climate domain, also tracks actuators separately to determine visibility.
///
/// [energyDeviceCount] is the number of devices with energy-related channels
/// (electrical_energy, electrical_generation, electrical_power). This is
/// determined from channel categories and passed in separately since device
/// categories alone cannot identify energy capability.
///
/// [sensorReadingsCount] is the number of sensor readings reported by the
/// backend. When 0 (no sensor roles assigned), the sensors domain is hidden
/// even if sensor-category devices exist.
DomainCounts buildDomainCounts(
  List<DevicesModuleDeviceCategory> deviceCategories, {
  int energyDeviceCount = 0,
  int sensorReadingsCount = 0,
}) {
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
      case DomainType.energy:
        // Energy is determined by channel categories, not device categories.
        // The energy count is passed separately via energyDeviceCount parameter.
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
    energy: energyDeviceCount,
    sensorReadings: sensorReadingsCount,
  );
}
