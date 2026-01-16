// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: constant_identifier_names


import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';

/// Type of property constraint
enum PropertyConstraintType {
  /// Exactly one property from each group can be present
  oneOf,
  /// At least one property from each group must be present
  oneOrMoreOf,
  /// Property groups that cannot be mixed (e.g., RGB vs HSV)
  mutuallyExclusive,
}

/// A constraint defining relationships between properties
class PropertyConstraint {
  final PropertyConstraintType type;
  final List<List<DevicesModulePropertyCategory>> groups;

  const PropertyConstraint({
    required this.type,
    required this.groups,
  });
}

class ChannelPropertiesSpecification {
  final List<DevicesModulePropertyCategory> required;
  final List<DevicesModulePropertyCategory> optional;
  final List<PropertyConstraint> constraints;

  const ChannelPropertiesSpecification({
    required this.required,
    required this.optional,
    this.constraints = const [],
  });

  List<DevicesModulePropertyCategory> get all => [
        ...required,
        ...optional,
      ];
}

const Map<DevicesModuleChannelCategory, ChannelPropertiesSpecification> channelPropertiesSpecificationMappers = {
  DevicesModuleChannelCategory.generic: ChannelPropertiesSpecification(
    required: [],
    optional: [DevicesModulePropertyCategory.generic],
  ),
  DevicesModuleChannelCategory.airQuality: ChannelPropertiesSpecification(
    required: [],
    optional: [DevicesModulePropertyCategory.aqi, DevicesModulePropertyCategory.level, DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault],
    constraints: [
      PropertyConstraint(type: PropertyConstraintType.oneOrMoreOf, groups: [[DevicesModulePropertyCategory.aqi, DevicesModulePropertyCategory.level]]),
    ],
  ),
  DevicesModuleChannelCategory.airParticulate: ChannelPropertiesSpecification(
    required: [],
    optional: [DevicesModulePropertyCategory.detected, DevicesModulePropertyCategory.density, DevicesModulePropertyCategory.mode, DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault, DevicesModulePropertyCategory.tampered],
    constraints: [
      PropertyConstraint(type: PropertyConstraintType.oneOrMoreOf, groups: [[DevicesModulePropertyCategory.detected, DevicesModulePropertyCategory.density]]),
    ],
  ),
  DevicesModuleChannelCategory.alarm: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.state],
    optional: [DevicesModulePropertyCategory.triggered, DevicesModulePropertyCategory.siren, DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault, DevicesModulePropertyCategory.tampered],
  ),
  DevicesModuleChannelCategory.battery: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.percentage, DevicesModulePropertyCategory.status],
    optional: [DevicesModulePropertyCategory.fault],
  ),
  DevicesModuleChannelCategory.camera: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.status, DevicesModulePropertyCategory.source],
    optional: [DevicesModulePropertyCategory.zoom, DevicesModulePropertyCategory.pan, DevicesModulePropertyCategory.tilt, DevicesModulePropertyCategory.infrared, DevicesModulePropertyCategory.fault],
  ),
  DevicesModuleChannelCategory.carbonDioxide: ChannelPropertiesSpecification(
    required: [],
    optional: [DevicesModulePropertyCategory.detected, DevicesModulePropertyCategory.density, DevicesModulePropertyCategory.peakLevel, DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault, DevicesModulePropertyCategory.tampered],
    constraints: [
      PropertyConstraint(type: PropertyConstraintType.oneOrMoreOf, groups: [[DevicesModulePropertyCategory.detected, DevicesModulePropertyCategory.density]]),
    ],
  ),
  DevicesModuleChannelCategory.carbonMonoxide: ChannelPropertiesSpecification(
    required: [],
    optional: [DevicesModulePropertyCategory.detected, DevicesModulePropertyCategory.density, DevicesModulePropertyCategory.peakLevel, DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault, DevicesModulePropertyCategory.tampered],
    constraints: [
      PropertyConstraint(type: PropertyConstraintType.oneOrMoreOf, groups: [[DevicesModulePropertyCategory.detected, DevicesModulePropertyCategory.density]]),
    ],
  ),
  DevicesModuleChannelCategory.contact: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.detected],
    optional: [DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault, DevicesModulePropertyCategory.tampered],
  ),
  DevicesModuleChannelCategory.cooler: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.valueOn, DevicesModulePropertyCategory.temperature, DevicesModulePropertyCategory.status],
    optional: [],
  ),
  DevicesModuleChannelCategory.deviceInformation: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.manufacturer, DevicesModulePropertyCategory.model, DevicesModulePropertyCategory.serialNumber],
    optional: [DevicesModulePropertyCategory.firmwareRevision, DevicesModulePropertyCategory.hardwareRevision, DevicesModulePropertyCategory.linkQuality, DevicesModulePropertyCategory.connectionType, DevicesModulePropertyCategory.status, DevicesModulePropertyCategory.fault],
  ),
  DevicesModuleChannelCategory.dehumidifier: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.valueOn, DevicesModulePropertyCategory.humidity],
    optional: [DevicesModulePropertyCategory.mode, DevicesModulePropertyCategory.status, DevicesModulePropertyCategory.waterTankFull, DevicesModulePropertyCategory.waterTankLevel, DevicesModulePropertyCategory.defrostActive, DevicesModulePropertyCategory.timer, DevicesModulePropertyCategory.fault],
  ),
  DevicesModuleChannelCategory.doorbell: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.event],
    optional: [DevicesModulePropertyCategory.brightness, DevicesModulePropertyCategory.tampered],
  ),
  DevicesModuleChannelCategory.door: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.obstruction, DevicesModulePropertyCategory.status, DevicesModulePropertyCategory.position, DevicesModulePropertyCategory.type],
    optional: [DevicesModulePropertyCategory.percentage, DevicesModulePropertyCategory.fault],
  ),
  DevicesModuleChannelCategory.electricalEnergy: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.consumption],
    optional: [DevicesModulePropertyCategory.rate, DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault],
  ),
  DevicesModuleChannelCategory.electricalPower: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.power],
    optional: [DevicesModulePropertyCategory.voltage, DevicesModulePropertyCategory.current, DevicesModulePropertyCategory.frequency, DevicesModulePropertyCategory.overCurrent, DevicesModulePropertyCategory.overVoltage, DevicesModulePropertyCategory.overPower, DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault],
  ),
  DevicesModuleChannelCategory.fan: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.valueOn],
    optional: [DevicesModulePropertyCategory.swing, DevicesModulePropertyCategory.speed, DevicesModulePropertyCategory.mode, DevicesModulePropertyCategory.direction, DevicesModulePropertyCategory.naturalBreeze, DevicesModulePropertyCategory.timer],
  ),
  DevicesModuleChannelCategory.filter: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.lifeRemaining, DevicesModulePropertyCategory.status],
    optional: [DevicesModulePropertyCategory.changeNeeded, DevicesModulePropertyCategory.reset, DevicesModulePropertyCategory.fault],
  ),
  DevicesModuleChannelCategory.flow: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.rate],
    optional: [DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault],
  ),
  DevicesModuleChannelCategory.gas: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.detected, DevicesModulePropertyCategory.status],
    optional: [DevicesModulePropertyCategory.density, DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault, DevicesModulePropertyCategory.tampered],
  ),
  DevicesModuleChannelCategory.heater: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.valueOn, DevicesModulePropertyCategory.temperature, DevicesModulePropertyCategory.status],
    optional: [DevicesModulePropertyCategory.position],
  ),
  DevicesModuleChannelCategory.humidity: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.humidity],
    optional: [DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault],
  ),
  DevicesModuleChannelCategory.humidifier: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.valueOn, DevicesModulePropertyCategory.humidity],
    optional: [DevicesModulePropertyCategory.mode, DevicesModulePropertyCategory.status, DevicesModulePropertyCategory.mistLevel, DevicesModulePropertyCategory.warmMist, DevicesModulePropertyCategory.waterTankEmpty, DevicesModulePropertyCategory.waterTankLevel, DevicesModulePropertyCategory.timer, DevicesModulePropertyCategory.fault],
  ),
  DevicesModuleChannelCategory.illuminance: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.density, DevicesModulePropertyCategory.level],
    optional: [DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault],
  ),
  DevicesModuleChannelCategory.leak: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.detected, DevicesModulePropertyCategory.level],
    optional: [DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault, DevicesModulePropertyCategory.tampered],
  ),
  DevicesModuleChannelCategory.light: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.valueOn],
    optional: [DevicesModulePropertyCategory.brightness, DevicesModulePropertyCategory.colorRed, DevicesModulePropertyCategory.colorGreen, DevicesModulePropertyCategory.colorBlue, DevicesModulePropertyCategory.colorWhite, DevicesModulePropertyCategory.colorTemperature, DevicesModulePropertyCategory.hue, DevicesModulePropertyCategory.saturation],
    constraints: [
      PropertyConstraint(type: PropertyConstraintType.mutuallyExclusive, groups: [[DevicesModulePropertyCategory.colorRed, DevicesModulePropertyCategory.colorGreen, DevicesModulePropertyCategory.colorBlue], [DevicesModulePropertyCategory.hue, DevicesModulePropertyCategory.saturation]]),
    ],
  ),
  DevicesModuleChannelCategory.lock: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.valueOn, DevicesModulePropertyCategory.status],
    optional: [DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault, DevicesModulePropertyCategory.tampered],
  ),
  DevicesModuleChannelCategory.mediaInput: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.source],
    optional: [DevicesModulePropertyCategory.active],
  ),
  DevicesModuleChannelCategory.mediaPlayback: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.status],
    optional: [DevicesModulePropertyCategory.track, DevicesModulePropertyCategory.duration, DevicesModulePropertyCategory.position],
  ),
  DevicesModuleChannelCategory.microphone: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.active],
    optional: [DevicesModulePropertyCategory.volume],
  ),
  DevicesModuleChannelCategory.motion: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.detected],
    optional: [DevicesModulePropertyCategory.distance, DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault, DevicesModulePropertyCategory.tampered],
  ),
  DevicesModuleChannelCategory.nitrogenDioxide: ChannelPropertiesSpecification(
    required: [],
    optional: [DevicesModulePropertyCategory.detected, DevicesModulePropertyCategory.density, DevicesModulePropertyCategory.mode, DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault, DevicesModulePropertyCategory.tampered],
    constraints: [
      PropertyConstraint(type: PropertyConstraintType.oneOrMoreOf, groups: [[DevicesModulePropertyCategory.detected, DevicesModulePropertyCategory.density]]),
    ],
  ),
  DevicesModuleChannelCategory.occupancy: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.detected],
    optional: [DevicesModulePropertyCategory.distance, DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault, DevicesModulePropertyCategory.tampered],
  ),
  DevicesModuleChannelCategory.outlet: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.valueOn],
    optional: [DevicesModulePropertyCategory.inUse],
  ),
  DevicesModuleChannelCategory.ozone: ChannelPropertiesSpecification(
    required: [],
    optional: [DevicesModulePropertyCategory.detected, DevicesModulePropertyCategory.density, DevicesModulePropertyCategory.level, DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault, DevicesModulePropertyCategory.tampered],
    constraints: [
      PropertyConstraint(type: PropertyConstraintType.oneOf, groups: [[DevicesModulePropertyCategory.density, DevicesModulePropertyCategory.level]]),
      PropertyConstraint(type: PropertyConstraintType.oneOrMoreOf, groups: [[DevicesModulePropertyCategory.detected, DevicesModulePropertyCategory.density, DevicesModulePropertyCategory.level]]),
    ],
  ),
  DevicesModuleChannelCategory.pressure: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.measured],
    optional: [DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault],
  ),
  DevicesModuleChannelCategory.robotVacuum: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.valueOn, DevicesModulePropertyCategory.status],
    optional: [DevicesModulePropertyCategory.mode, DevicesModulePropertyCategory.fault],
  ),
  DevicesModuleChannelCategory.smoke: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.detected],
    optional: [DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault, DevicesModulePropertyCategory.tampered],
  ),
  DevicesModuleChannelCategory.speaker: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.active],
    optional: [DevicesModulePropertyCategory.volume, DevicesModulePropertyCategory.mode],
  ),
  DevicesModuleChannelCategory.sulphurDioxide: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.detected, DevicesModulePropertyCategory.density, DevicesModulePropertyCategory.level],
    optional: [DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault, DevicesModulePropertyCategory.tampered],
  ),
  DevicesModuleChannelCategory.switcher: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.valueOn],
    optional: [DevicesModulePropertyCategory.childLock, DevicesModulePropertyCategory.timer],
  ),
  DevicesModuleChannelCategory.television: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.valueOn, DevicesModulePropertyCategory.brightness, DevicesModulePropertyCategory.inputSource],
    optional: [DevicesModulePropertyCategory.remoteKey],
  ),
  DevicesModuleChannelCategory.temperature: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.temperature],
    optional: [DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault],
  ),
  DevicesModuleChannelCategory.thermostat: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.mode],
    optional: [DevicesModulePropertyCategory.locked],
  ),
  DevicesModuleChannelCategory.valve: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.valueOn, DevicesModulePropertyCategory.type],
    optional: [DevicesModulePropertyCategory.duration, DevicesModulePropertyCategory.remaining, DevicesModulePropertyCategory.mode, DevicesModulePropertyCategory.position, DevicesModulePropertyCategory.fault],
  ),
  DevicesModuleChannelCategory.volatileOrganicCompounds: ChannelPropertiesSpecification(
    required: [],
    optional: [DevicesModulePropertyCategory.detected, DevicesModulePropertyCategory.density, DevicesModulePropertyCategory.level, DevicesModulePropertyCategory.active, DevicesModulePropertyCategory.fault, DevicesModulePropertyCategory.tampered],
    constraints: [
      PropertyConstraint(type: PropertyConstraintType.oneOf, groups: [[DevicesModulePropertyCategory.density, DevicesModulePropertyCategory.level]]),
      PropertyConstraint(type: PropertyConstraintType.oneOrMoreOf, groups: [[DevicesModulePropertyCategory.detected, DevicesModulePropertyCategory.density, DevicesModulePropertyCategory.level]]),
    ],
  ),
  DevicesModuleChannelCategory.windowCovering: ChannelPropertiesSpecification(
    required: [DevicesModulePropertyCategory.status, DevicesModulePropertyCategory.position, DevicesModulePropertyCategory.type, DevicesModulePropertyCategory.command],
    optional: [DevicesModulePropertyCategory.obstruction, DevicesModulePropertyCategory.tilt, DevicesModulePropertyCategory.fault],
  ),
};

ChannelPropertiesSpecification buildChannelPropertiesSpecification(
  DevicesModuleChannelCategory category,
) {
  return channelPropertiesSpecificationMappers[category] ??
      const ChannelPropertiesSpecification(
        required: [],
        optional: [],
      );
}
