import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/air_particulate.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/alarm.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/camera.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/carbon_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/carbon_monoxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/contact.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/cooler.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/door.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/doorbell.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/fan.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/flow.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/heater.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/illuminance.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/leak.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/light.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/lock.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/media_input.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/media_playback.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/microphone.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/motion.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/nitrogen_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/occupancy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/outlet.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/ozone.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/pressure.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/robot_vacuum.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/smoke.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/sulphur_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/switcher.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/television.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/thermostat.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/valve.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/volatile_organic_compounds.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/window_covering.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';

class ChannelPropertiesSpecification {
  final List<PropertyCategory> required;
  final List<PropertyCategory> optional;

  const ChannelPropertiesSpecification({
    required this.required,
    required this.optional,
  });

  List<PropertyCategory> get all => [
        ...required,
        ...optional,
      ];
}

Map<String, ChannelPropertiesSpecification>
    channelPropertiesSpecificationMappers = {
  ChannelCategory.airParticulate.value: ChannelPropertiesSpecification(
    required: [],
    optional: [
      PropertyCategory.detected,
      PropertyCategory.density,
      PropertyCategory.mode,
      PropertyCategory.active,
      PropertyCategory.fault,
      PropertyCategory.tampered,
    ],
  ),
  ChannelCategory.alarm.value: ChannelPropertiesSpecification(
    required: [],
    optional: [],
  ),
  ChannelCategory.battery.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.percentage,
      PropertyCategory.status,
    ],
    optional: [
      PropertyCategory.fault,
    ],
  ),
  ChannelCategory.camera.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.status,
      PropertyCategory.source,
    ],
    optional: [
      PropertyCategory.zoom,
      PropertyCategory.pan,
      PropertyCategory.tilt,
      PropertyCategory.infrared,
      PropertyCategory.fault,
    ],
  ),
  ChannelCategory.carbonDioxide.value: ChannelPropertiesSpecification(
    required: [],
    optional: [
      PropertyCategory.detected,
      PropertyCategory.density,
      PropertyCategory.peakLevel,
      PropertyCategory.active,
      PropertyCategory.fault,
      PropertyCategory.tampered,
    ],
  ),
  ChannelCategory.carbonMonoxide.value: ChannelPropertiesSpecification(
    required: [],
    optional: [
      PropertyCategory.detected,
      PropertyCategory.density,
      PropertyCategory.peakLevel,
      PropertyCategory.active,
      PropertyCategory.fault,
      PropertyCategory.tampered,
    ],
  ),
  ChannelCategory.contact.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.detected,
    ],
    optional: [
      PropertyCategory.active,
      PropertyCategory.fault,
      PropertyCategory.tampered,
    ],
  ),
  ChannelCategory.cooler.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.temperature,
      PropertyCategory.status,
    ],
    optional: [],
  ),
  ChannelCategory.deviceInformation.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.manufacturer,
      PropertyCategory.model,
      PropertyCategory.serialNumber,
      PropertyCategory.firmwareRevision,
    ],
    optional: [
      PropertyCategory.hardwareRevision,
      PropertyCategory.linkQuality,
      PropertyCategory.connectionType,
      PropertyCategory.fault,
    ],
  ),
  ChannelCategory.door.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.obstruction,
      PropertyCategory.status,
      PropertyCategory.position,
      PropertyCategory.type,
    ],
    optional: [
      PropertyCategory.percentage,
      PropertyCategory.fault,
    ],
  ),
  ChannelCategory.doorbell.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.event,
    ],
    optional: [
      PropertyCategory.brightness,
      PropertyCategory.tampered,
    ],
  ),
  ChannelCategory.electricalEnergy.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.consumption,
      PropertyCategory.rate,
    ],
    optional: [
      PropertyCategory.active,
      PropertyCategory.fault,
    ],
  ),
  ChannelCategory.electricalPower.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.power,
      PropertyCategory.voltage,
      PropertyCategory.current,
      PropertyCategory.frequency,
    ],
    optional: [
      PropertyCategory.overVoltage,
      PropertyCategory.overCurrent,
      PropertyCategory.active,
      PropertyCategory.fault,
    ],
  ),
  ChannelCategory.fan.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.on,
    ],
    optional: [
      PropertyCategory.swing,
      PropertyCategory.speed,
      PropertyCategory.direction,
    ],
  ),
  ChannelCategory.flow.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.rate,
    ],
    optional: [
      PropertyCategory.active,
      PropertyCategory.fault,
    ],
  ),
  ChannelCategory.heater.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.temperature,
      PropertyCategory.status,
    ],
    optional: [],
  ),
  ChannelCategory.humidity.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.humidity,
    ],
    optional: [
      PropertyCategory.active,
      PropertyCategory.fault,
    ],
  ),
  ChannelCategory.illuminance.value: ChannelPropertiesSpecification(
    required: [],
    optional: [
      PropertyCategory.density,
      PropertyCategory.level,
      PropertyCategory.active,
      PropertyCategory.fault,
    ],
  ),
  ChannelCategory.leak.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.detected,
    ],
    optional: [
      PropertyCategory.active,
      PropertyCategory.fault,
      PropertyCategory.tampered,
    ],
  ),
  ChannelCategory.light.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.on,
    ],
    optional: [
      PropertyCategory.brightness,
      PropertyCategory.colorRed,
      PropertyCategory.colorGreen,
      PropertyCategory.colorBlue,
      PropertyCategory.colorWhite,
      PropertyCategory.colorTemperature,
      PropertyCategory.hue,
      PropertyCategory.saturation,
    ],
  ),
  ChannelCategory.lock.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.on,
      PropertyCategory.status,
    ],
    optional: [
      PropertyCategory.active,
      PropertyCategory.fault,
      PropertyCategory.tampered,
    ],
  ),
  ChannelCategory.microphone.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.active,
    ],
    optional: [
      PropertyCategory.volume,
    ],
  ),
  ChannelCategory.motion.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.detected,
    ],
    optional: [
      PropertyCategory.distance,
      PropertyCategory.active,
      PropertyCategory.fault,
      PropertyCategory.tampered,
    ],
  ),
  ChannelCategory.nitrogenDioxide.value: ChannelPropertiesSpecification(
    required: [],
    optional: [
      PropertyCategory.detected,
      PropertyCategory.density,
      PropertyCategory.mode,
      PropertyCategory.active,
      PropertyCategory.fault,
      PropertyCategory.tampered,
    ],
  ),
  ChannelCategory.occupancy.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.detected,
    ],
    optional: [
      PropertyCategory.distance,
      PropertyCategory.active,
      PropertyCategory.fault,
      PropertyCategory.tampered,
    ],
  ),
  ChannelCategory.outlet.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.on,
    ],
    optional: [
      PropertyCategory.inUse,
    ],
  ),
  ChannelCategory.ozone.value: ChannelPropertiesSpecification(
    required: [],
    optional: [
      PropertyCategory.detected,
      PropertyCategory.density,
      PropertyCategory.level,
      PropertyCategory.active,
      PropertyCategory.fault,
      PropertyCategory.tampered,
    ],
  ),
  ChannelCategory.pressure.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.measured,
    ],
    optional: [
      PropertyCategory.active,
      PropertyCategory.fault,
    ],
  ),
  ChannelCategory.robotVacuum.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.on,
      PropertyCategory.status,
    ],
    optional: [
      PropertyCategory.mode,
      PropertyCategory.fault,
    ],
  ),
  ChannelCategory.smoke.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.detected,
    ],
    optional: [
      PropertyCategory.active,
      PropertyCategory.fault,
      PropertyCategory.tampered,
    ],
  ),
  ChannelCategory.speaker.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.active,
    ],
    optional: [
      PropertyCategory.volume,
      PropertyCategory.mode,
    ],
  ),
  ChannelCategory.sulphurDioxide.value: ChannelPropertiesSpecification(
    required: [],
    optional: [
      PropertyCategory.detected,
      PropertyCategory.density,
      PropertyCategory.level,
      PropertyCategory.active,
      PropertyCategory.fault,
      PropertyCategory.tampered,
    ],
  ),
  ChannelCategory.switcher.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.on,
    ],
    optional: [],
  ),
  ChannelCategory.television.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.on,
      PropertyCategory.brightness,
      PropertyCategory.inputSource,
    ],
    optional: [
      PropertyCategory.remoteKey,
    ],
  ),
  ChannelCategory.temperature.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.temperature,
    ],
    optional: [
      PropertyCategory.active,
      PropertyCategory.fault,
    ],
  ),
  ChannelCategory.thermostat.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.active,
      PropertyCategory.mode,
    ],
    optional: [
      PropertyCategory.locked,
      PropertyCategory.units,
    ],
  ),
  ChannelCategory.valve.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.on,
      PropertyCategory.type,
    ],
    optional: [
      PropertyCategory.duration,
      PropertyCategory.remaining,
      PropertyCategory.mode,
      PropertyCategory.fault,
    ],
  ),
  ChannelCategory.volatileOrganicCompounds.value:
      ChannelPropertiesSpecification(
    required: [],
    optional: [
      PropertyCategory.detected,
      PropertyCategory.density,
      PropertyCategory.level,
      PropertyCategory.active,
      PropertyCategory.fault,
      PropertyCategory.tampered,
    ],
  ),
  ChannelCategory.windowCovering.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategory.obstruction,
      PropertyCategory.status,
      PropertyCategory.position,
      PropertyCategory.type,
    ],
    optional: [
      PropertyCategory.percentage,
      PropertyCategory.tilt,
      PropertyCategory.fault,
    ],
  ),
};

ChannelPropertiesSpecification buildChannelPropertiesSpecification(
  ChannelCategory category,
) {
  return channelPropertiesSpecificationMappers[category.value] ??
      ChannelPropertiesSpecification(
        required: [],
        optional: [],
      );
}

Map<
    String,
    Capability Function(
      ChannelModel,
      List<ChannelPropertyModel>,
    )> channelCapabilityMappers = {
  ChannelCategory.airParticulate.value: (channel, properties) {
    return AirParticulateChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.alarm.value: (channel, properties) {
    return AlarmChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.battery.value: (channel, properties) {
    return BatteryChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.camera.value: (channel, properties) {
    return CameraChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.carbonDioxide.value: (channel, properties) {
    return CarbonDioxideChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.carbonMonoxide.value: (channel, properties) {
    return CarbonMonoxideChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.contact.value: (channel, properties) {
    return ContactChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.cooler.value: (channel, properties) {
    return CoolerChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.deviceInformation.value: (channel, properties) {
    return DeviceInformationChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.door.value: (channel, properties) {
    return DoorChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.doorbell.value: (channel, properties) {
    return DoorbellChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.electricalEnergy.value: (channel, properties) {
    return ElectricalEnergyChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.electricalPower.value: (channel, properties) {
    return ElectricalPowerChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.fan.value: (channel, properties) {
    return FanChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.flow.value: (channel, properties) {
    return FlowChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.heater.value: (channel, properties) {
    return HeaterChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.humidity.value: (channel, properties) {
    return HumidityChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.illuminance.value: (channel, properties) {
    return IlluminanceChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.leak.value: (channel, properties) {
    return LeakChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.light.value: (channel, properties) {
    return LightChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.lock.value: (channel, properties) {
    return LockChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.mediaInput.value: (channel, properties) {
    return MediaInputChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.mediaPlayback.value: (channel, properties) {
    return MediaPlaybackChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.microphone.value: (channel, properties) {
    return MicrophoneChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.motion.value: (channel, properties) {
    return MotionChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.nitrogenDioxide.value: (channel, properties) {
    return NitrogenDioxideChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.occupancy.value: (channel, properties) {
    return OccupancyChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.outlet.value: (channel, properties) {
    return OutletChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.ozone.value: (channel, properties) {
    return OzoneChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.pressure.value: (channel, properties) {
    return PressureChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.robotVacuum.value: (channel, properties) {
    return RobotVacuumChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.smoke.value: (channel, properties) {
    return SmokeChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.speaker.value: (channel, properties) {
    return SpeakerChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.sulphurDioxide.value: (channel, properties) {
    return SulphurDioxideChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.switcher.value: (channel, properties) {
    return SwitcherChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.television.value: (channel, properties) {
    return TelevisionChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.temperature.value: (channel, properties) {
    return TemperatureChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.thermostat.value: (channel, properties) {
    return ThermostatChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.valve.value: (channel, properties) {
    return ValveChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.volatileOrganicCompounds.value: (channel, properties) {
    return VolatileOrganicCompoundsChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategory.windowCovering.value: (channel, properties) {
    return WindowCoveringChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
};

Capability buildChannelCapability(
  ChannelModel channel,
  List<ChannelPropertyModel> properties,
) {
  final builder = channelCapabilityMappers[channel.category.value];

  if (builder != null) {
    return builder(channel, properties);
  } else {
    throw ArgumentError(
      'Channel capability can not be created. Unsupported channel category: ${channel.category.value}',
    );
  }
}
