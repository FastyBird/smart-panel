import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/air_particulate.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/alarm.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/camera.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/carbon_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/carbon_monoxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/contact.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/cooler.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/door.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/doorbell.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/fan.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/flow.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/heater.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/illuminance.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/leak.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/light.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/lock.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/media_input.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/media_playback.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/microphone.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/motion.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/nitrogen_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/occupancy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/outlet.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/ozone.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/pressure.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/robot_vacuum.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/smoke.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/sulphur_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/switcher.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/television.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/thermostat.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/valve.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/volatile_organic_compounds.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/window_covering.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/air_particulate.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/alarm.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/camera.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/carbon_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/carbon_monoxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/contact.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/cooler.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/door.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/doorbell.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/fan.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/flow.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/heater.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/illuminance.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/leak.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/light.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/lock.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/media_input.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/media_playback.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/microphone.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/motion.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/nitrogen_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/occupancy.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/outlet.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/ozone.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/pressure.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/robot_vacuum.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/smoke.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/sulphur_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/switcher.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/television.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/thermostat.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/valve.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/volatile_organic_compounds.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/window_covering.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';

class ChannelPropertiesSpecification {
  final List<PropertyCategoryType> required;
  final List<PropertyCategoryType> optional;

  const ChannelPropertiesSpecification({
    required this.required,
    required this.optional,
  });

  List<PropertyCategoryType> get all => [
        ...required,
        ...optional,
      ];
}

Map<String, ChannelPropertiesSpecification>
    channelPropertiesSpecificationMappers = {
  ChannelCategoryType.airParticulate.value: ChannelPropertiesSpecification(
    required: [],
    optional: [
      PropertyCategoryType.detected,
      PropertyCategoryType.density,
      PropertyCategoryType.mode,
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
      PropertyCategoryType.tampered,
    ],
  ),
  ChannelCategoryType.alarm.value: ChannelPropertiesSpecification(
    required: [],
    optional: [],
  ),
  ChannelCategoryType.battery.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.percentage,
      PropertyCategoryType.status,
    ],
    optional: [
      PropertyCategoryType.fault,
    ],
  ),
  ChannelCategoryType.camera.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.status,
      PropertyCategoryType.source,
    ],
    optional: [
      PropertyCategoryType.zoom,
      PropertyCategoryType.pan,
      PropertyCategoryType.tilt,
      PropertyCategoryType.infrared,
      PropertyCategoryType.fault,
    ],
  ),
  ChannelCategoryType.carbonDioxide.value: ChannelPropertiesSpecification(
    required: [],
    optional: [
      PropertyCategoryType.detected,
      PropertyCategoryType.density,
      PropertyCategoryType.peakLevel,
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
      PropertyCategoryType.tampered,
    ],
  ),
  ChannelCategoryType.carbonMonoxide.value: ChannelPropertiesSpecification(
    required: [],
    optional: [
      PropertyCategoryType.detected,
      PropertyCategoryType.density,
      PropertyCategoryType.peakLevel,
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
      PropertyCategoryType.tampered,
    ],
  ),
  ChannelCategoryType.contact.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.detected,
    ],
    optional: [
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
      PropertyCategoryType.tampered,
    ],
  ),
  ChannelCategoryType.cooler.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.temperature,
      PropertyCategoryType.status,
    ],
    optional: [],
  ),
  ChannelCategoryType.deviceInformation.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.manufacturer,
      PropertyCategoryType.model,
      PropertyCategoryType.serialNumber,
      PropertyCategoryType.firmwareRevision,
    ],
    optional: [
      PropertyCategoryType.hardwareRevision,
      PropertyCategoryType.linkQuality,
      PropertyCategoryType.connectionType,
      PropertyCategoryType.fault,
    ],
  ),
  ChannelCategoryType.door.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.obstruction,
      PropertyCategoryType.status,
      PropertyCategoryType.position,
      PropertyCategoryType.type,
    ],
    optional: [
      PropertyCategoryType.percentage,
      PropertyCategoryType.fault,
    ],
  ),
  ChannelCategoryType.doorbell.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.event,
    ],
    optional: [
      PropertyCategoryType.brightness,
      PropertyCategoryType.tampered,
    ],
  ),
  ChannelCategoryType.electricalEnergy.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.consumption,
      PropertyCategoryType.rate,
    ],
    optional: [
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
    ],
  ),
  ChannelCategoryType.electricalPower.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.power,
      PropertyCategoryType.voltage,
      PropertyCategoryType.current,
      PropertyCategoryType.frequency,
    ],
    optional: [
      PropertyCategoryType.overVoltage,
      PropertyCategoryType.overCurrent,
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
    ],
  ),
  ChannelCategoryType.fan.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.on,
    ],
    optional: [
      PropertyCategoryType.swing,
      PropertyCategoryType.speed,
      PropertyCategoryType.direction,
    ],
  ),
  ChannelCategoryType.flow.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.rate,
    ],
    optional: [
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
    ],
  ),
  ChannelCategoryType.heater.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.temperature,
      PropertyCategoryType.status,
    ],
    optional: [],
  ),
  ChannelCategoryType.humidity.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.humidity,
    ],
    optional: [
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
    ],
  ),
  ChannelCategoryType.illuminance.value: ChannelPropertiesSpecification(
    required: [],
    optional: [
      PropertyCategoryType.density,
      PropertyCategoryType.level,
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
    ],
  ),
  ChannelCategoryType.leak.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.detected,
    ],
    optional: [
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
      PropertyCategoryType.tampered,
    ],
  ),
  ChannelCategoryType.light.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.on,
    ],
    optional: [
      PropertyCategoryType.brightness,
      PropertyCategoryType.colorRed,
      PropertyCategoryType.colorGreen,
      PropertyCategoryType.colorBlue,
      PropertyCategoryType.colorWhite,
      PropertyCategoryType.colorTemperature,
      PropertyCategoryType.hue,
      PropertyCategoryType.saturation,
    ],
  ),
  ChannelCategoryType.lock.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.on,
      PropertyCategoryType.status,
    ],
    optional: [
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
      PropertyCategoryType.tampered,
    ],
  ),
  ChannelCategoryType.microphone.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.active,
    ],
    optional: [
      PropertyCategoryType.volume,
    ],
  ),
  ChannelCategoryType.motion.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.detected,
    ],
    optional: [
      PropertyCategoryType.distance,
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
      PropertyCategoryType.tampered,
    ],
  ),
  ChannelCategoryType.nitrogenDioxide.value: ChannelPropertiesSpecification(
    required: [],
    optional: [
      PropertyCategoryType.detected,
      PropertyCategoryType.density,
      PropertyCategoryType.mode,
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
      PropertyCategoryType.tampered,
    ],
  ),
  ChannelCategoryType.occupancy.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.detected,
    ],
    optional: [
      PropertyCategoryType.distance,
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
      PropertyCategoryType.tampered,
    ],
  ),
  ChannelCategoryType.outlet.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.on,
    ],
    optional: [
      PropertyCategoryType.inUse,
    ],
  ),
  ChannelCategoryType.ozone.value: ChannelPropertiesSpecification(
    required: [],
    optional: [
      PropertyCategoryType.detected,
      PropertyCategoryType.density,
      PropertyCategoryType.level,
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
      PropertyCategoryType.tampered,
    ],
  ),
  ChannelCategoryType.pressure.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.measured,
    ],
    optional: [
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
    ],
  ),
  ChannelCategoryType.robotVacuum.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.on,
      PropertyCategoryType.status,
    ],
    optional: [
      PropertyCategoryType.mode,
      PropertyCategoryType.fault,
    ],
  ),
  ChannelCategoryType.smoke.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.detected,
    ],
    optional: [
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
      PropertyCategoryType.tampered,
    ],
  ),
  ChannelCategoryType.speaker.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.active,
    ],
    optional: [
      PropertyCategoryType.volume,
      PropertyCategoryType.mode,
    ],
  ),
  ChannelCategoryType.sulphurDioxide.value: ChannelPropertiesSpecification(
    required: [],
    optional: [
      PropertyCategoryType.detected,
      PropertyCategoryType.density,
      PropertyCategoryType.level,
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
      PropertyCategoryType.tampered,
    ],
  ),
  ChannelCategoryType.switcher.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.on,
    ],
    optional: [],
  ),
  ChannelCategoryType.television.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.on,
      PropertyCategoryType.brightness,
      PropertyCategoryType.inputSource,
    ],
    optional: [
      PropertyCategoryType.remoteKey,
    ],
  ),
  ChannelCategoryType.temperature.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.temperature,
    ],
    optional: [
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
    ],
  ),
  ChannelCategoryType.thermostat.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.active,
      PropertyCategoryType.mode,
    ],
    optional: [
      PropertyCategoryType.locked,
      PropertyCategoryType.units,
    ],
  ),
  ChannelCategoryType.valve.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.on,
      PropertyCategoryType.type,
    ],
    optional: [
      PropertyCategoryType.duration,
      PropertyCategoryType.remaining,
      PropertyCategoryType.mode,
      PropertyCategoryType.fault,
    ],
  ),
  ChannelCategoryType.volatileOrganicCompounds.value:
      ChannelPropertiesSpecification(
    required: [],
    optional: [
      PropertyCategoryType.detected,
      PropertyCategoryType.density,
      PropertyCategoryType.level,
      PropertyCategoryType.active,
      PropertyCategoryType.fault,
      PropertyCategoryType.tampered,
    ],
  ),
  ChannelCategoryType.windowCovering.value: ChannelPropertiesSpecification(
    required: [
      PropertyCategoryType.obstruction,
      PropertyCategoryType.status,
      PropertyCategoryType.position,
      PropertyCategoryType.type,
    ],
    optional: [
      PropertyCategoryType.percentage,
      PropertyCategoryType.tilt,
      PropertyCategoryType.fault,
    ],
  ),
};

ChannelPropertiesSpecification buildChannelPropertiesSpecification(
  ChannelCategoryType category,
) {
  return channelPropertiesSpecificationMappers[category.value] ??
      ChannelPropertiesSpecification(
        required: [],
        optional: [],
      );
}

Map<String, ChannelDataModel Function(Map<String, dynamic>)>
    channelModelMappers = {
  ChannelCategoryType.airParticulate.value: (data) {
    return AirParticulateChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.alarm.value: (data) {
    return AlarmChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.battery.value: (data) {
    return BatteryChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.camera.value: (data) {
    return CameraChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.carbonDioxide.value: (data) {
    return CarbonDioxideChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.carbonMonoxide.value: (data) {
    return CarbonMonoxideChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.contact.value: (data) {
    return ContactChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.cooler.value: (data) {
    return CoolerChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.deviceInformation.value: (data) {
    return DeviceInformationChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.door.value: (data) {
    return DoorChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.doorbell.value: (data) {
    return DoorbellChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.electricalEnergy.value: (data) {
    return ElectricalEnergyChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.electricalPower.value: (data) {
    return ElectricalPowerChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.fan.value: (data) {
    return FanChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.flow.value: (data) {
    return FlowChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.heater.value: (data) {
    return HeaterChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.humidity.value: (data) {
    return HumidityChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.illuminance.value: (data) {
    return IlluminanceChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.leak.value: (data) {
    return LeakChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.light.value: (data) {
    return LightChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.lock.value: (data) {
    return LockChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.mediaInput.value: (data) {
    return MediaInputChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.mediaPlayback.value: (data) {
    return MediaPlaybackChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.microphone.value: (data) {
    return MicrophoneChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.motion.value: (data) {
    return MotionChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.nitrogenDioxide.value: (data) {
    return NitrogenDioxideChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.occupancy.value: (data) {
    return OccupancyChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.outlet.value: (data) {
    return OutletChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.ozone.value: (data) {
    return OzoneChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.pressure.value: (data) {
    return PressureChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.robotVacuum.value: (data) {
    return RobotVacuumChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.smoke.value: (data) {
    return SmokeChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.speaker.value: (data) {
    return SpeakerChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.sulphurDioxide.value: (data) {
    return SulphurDioxideChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.switcher.value: (data) {
    return SwitcherChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.television.value: (data) {
    return TelevisionChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.temperature.value: (data) {
    return TemperatureChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.thermostat.value: (data) {
    return ThermostatChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.valve.value: (data) {
    return ValveChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.volatileOrganicCompounds.value: (data) {
    return VolatileOrganicCompoundsChannelDataModel.fromJson(data);
  },
  ChannelCategoryType.windowCovering.value: (data) {
    return WindowCoveringChannelDataModel.fromJson(data);
  },
};

ChannelDataModel buildChannelModel(
  ChannelCategoryType category,
  Map<String, dynamic> data,
) {
  final builder = channelModelMappers[category.value];

  if (builder != null) {
    return builder(data);
  } else {
    throw ArgumentError(
      'Channel model can not be created. Unsupported channel category: ${category.value}',
    );
  }
}

Map<
    String,
    ChannelCapability Function(
      ChannelDataModel,
      List<ChannelPropertyDataModel>,
    )> channelCapabilityMappers = {
  ChannelCategoryType.airParticulate.value: (channel, properties) {
    if (channel is! AirParticulateChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Air particulate channel capability',
      );
    }

    return AirParticulateChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.alarm.value: (channel, properties) {
    if (channel is! AlarmChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Alarm channel capability',
      );
    }

    return AlarmChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.battery.value: (channel, properties) {
    if (channel is! BatteryChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Batter channel capability',
      );
    }

    return BatteryChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.camera.value: (channel, properties) {
    if (channel is! CameraChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Camera channel capability',
      );
    }

    return CameraChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.carbonDioxide.value: (channel, properties) {
    if (channel is! CarbonDioxideChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Carbon dioxide channel capability',
      );
    }

    return CarbonDioxideChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.carbonMonoxide.value: (channel, properties) {
    if (channel is! CarbonMonoxideChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Carbon monoxide channel capability',
      );
    }

    return CarbonMonoxideChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.contact.value: (channel, properties) {
    if (channel is! ContactChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Contact channel capability',
      );
    }

    return ContactChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.cooler.value: (channel, properties) {
    if (channel is! CoolerChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Cooler channel capability',
      );
    }

    return CoolerChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.deviceInformation.value: (channel, properties) {
    if (channel is! DeviceInformationChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Device information channel capability',
      );
    }

    return DeviceInformationChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.door.value: (channel, properties) {
    if (channel is! DoorChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Door channel capability',
      );
    }

    return DoorChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.doorbell.value: (channel, properties) {
    if (channel is! DoorbellChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Doorbell channel capability',
      );
    }

    return DoorbellChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.electricalEnergy.value: (channel, properties) {
    if (channel is! ElectricalEnergyChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Electrical energy channel capability',
      );
    }

    return ElectricalEnergyChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.electricalPower.value: (channel, properties) {
    if (channel is! ElectricalPowerChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Electrical power channel capability',
      );
    }

    return ElectricalPowerChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.fan.value: (channel, properties) {
    if (channel is! FanChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Fan channel capability',
      );
    }

    return FanChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.flow.value: (channel, properties) {
    if (channel is! FlowChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Flow channel capability',
      );
    }

    return FlowChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.heater.value: (channel, properties) {
    if (channel is! HeaterChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Heater channel capability',
      );
    }

    return HeaterChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.humidity.value: (channel, properties) {
    if (channel is! HumidityChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Humidity channel capability',
      );
    }

    return HumidityChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.illuminance.value: (channel, properties) {
    if (channel is! IlluminanceChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Illuminance channel capability',
      );
    }

    return IlluminanceChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.leak.value: (channel, properties) {
    if (channel is! LeakChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Leak channel capability',
      );
    }

    return LeakChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.light.value: (channel, properties) {
    if (channel is! LightChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Light channel capability',
      );
    }

    return LightChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.lock.value: (channel, properties) {
    if (channel is! LockChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Lock channel capability',
      );
    }

    return LockChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.mediaInput.value: (channel, properties) {
    if (channel is! MediaInputChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Media input channel capability',
      );
    }

    return MediaInputChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.mediaPlayback.value: (channel, properties) {
    if (channel is! MediaPlaybackChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Media playback channel capability',
      );
    }

    return MediaPlaybackChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.microphone.value: (channel, properties) {
    if (channel is! MicrophoneChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Microphone channel capability',
      );
    }

    return MicrophoneChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.motion.value: (channel, properties) {
    if (channel is! MotionChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Motion channel capability',
      );
    }

    return MotionChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.nitrogenDioxide.value: (channel, properties) {
    if (channel is! NitrogenDioxideChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Nitrogen dioxide channel capability',
      );
    }

    return NitrogenDioxideChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.occupancy.value: (channel, properties) {
    if (channel is! OccupancyChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Occupancy channel capability',
      );
    }

    return OccupancyChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.outlet.value: (channel, properties) {
    if (channel is! OutletChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Outlet channel capability',
      );
    }

    return OutletChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.ozone.value: (channel, properties) {
    if (channel is! OzoneChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Ozone channel capability',
      );
    }

    return OzoneChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.pressure.value: (channel, properties) {
    if (channel is! PressureChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Pressure channel capability',
      );
    }

    return PressureChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.robotVacuum.value: (channel, properties) {
    if (channel is! RobotVacuumChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Robot vacuum channel capability',
      );
    }

    return RobotVacuumChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.smoke.value: (channel, properties) {
    if (channel is! SmokeChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Smoke channel capability',
      );
    }

    return SmokeChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.speaker.value: (channel, properties) {
    if (channel is! SpeakerChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Speaker channel capability',
      );
    }

    return SpeakerChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.sulphurDioxide.value: (channel, properties) {
    if (channel is! SulphurDioxideChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Sulphur dioxide channel capability',
      );
    }

    return SulphurDioxideChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.switcher.value: (channel, properties) {
    if (channel is! SwitcherChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Switcher channel capability',
      );
    }

    return SwitcherChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.television.value: (channel, properties) {
    if (channel is! TelevisionChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Television channel capability',
      );
    }

    return TelevisionChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.temperature.value: (channel, properties) {
    if (channel is! TemperatureChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Temperature channel capability',
      );
    }

    return TemperatureChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.thermostat.value: (channel, properties) {
    if (channel is! ThermostatChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Thermostat channel capability',
      );
    }

    return ThermostatChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.valve.value: (channel, properties) {
    if (channel is! ValveChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Valve channel capability',
      );
    }

    return ValveChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.volatileOrganicCompounds.value: (channel, properties) {
    if (channel is! VolatileOrganicCompoundsChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Volatile organic compounds channel capability',
      );
    }

    return VolatileOrganicCompoundsChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
  ChannelCategoryType.windowCovering.value: (channel, properties) {
    if (channel is! WindowCoveringChannelDataModel) {
      throw ArgumentError(
        'Channel model is not valid for Window covering channel capability',
      );
    }

    return WindowCoveringChannelCapability(
      channel: channel,
      properties: properties,
    );
  },
};

ChannelCapability buildChannelCapability(
  ChannelDataModel channel,
  List<ChannelPropertyDataModel> properties,
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
