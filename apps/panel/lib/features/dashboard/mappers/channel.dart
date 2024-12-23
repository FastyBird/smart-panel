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
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
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

Map<
    String,
    ChannelDataModel Function(
      Map<String, dynamic>,
      List<ChannelPropertyDataModel>,
      List<ChannelControlDataModel>,
    )> channelModelMappers = {
  ChannelCategoryType.airParticulate.value: (data, properties, controls) {
    return AirParticulateChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.alarm.value: (data, properties, controls) {
    return AlarmChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.battery.value: (data, properties, controls) {
    return BatteryChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.camera.value: (data, properties, controls) {
    return CameraChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.carbonDioxide.value: (data, properties, controls) {
    return CarbonDioxideChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.carbonMonoxide.value: (data, properties, controls) {
    return CarbonMonoxideChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.contact.value: (data, properties, controls) {
    return ContactChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.cooler.value: (data, properties, controls) {
    return CoolerChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.deviceInformation.value: (data, properties, controls) {
    return DeviceInformationChannelDataModel.fromJson(
      data,
      properties,
      controls,
    );
  },
  ChannelCategoryType.door.value: (data, properties, controls) {
    return DoorChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.doorbell.value: (data, properties, controls) {
    return DoorbellChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.electricalEnergy.value: (data, properties, controls) {
    return ElectricalEnergyChannelDataModel.fromJson(
      data,
      properties,
      controls,
    );
  },
  ChannelCategoryType.electricalPower.value: (data, properties, controls) {
    return ElectricalPowerChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.fan.value: (data, properties, controls) {
    return FanChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.flow.value: (data, properties, controls) {
    return FlowChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.heater.value: (data, properties, controls) {
    return HeaterChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.humidity.value: (data, properties, controls) {
    return HumidityChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.illuminance.value: (data, properties, controls) {
    return IlluminanceChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.leak.value: (data, properties, controls) {
    return LeakChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.light.value: (data, properties, controls) {
    return LightChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.lock.value: (data, properties, controls) {
    return LockChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.mediaInput.value: (data, properties, controls) {
    return MediaInputChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.mediaPlayback.value: (data, properties, controls) {
    return MediaPlaybackChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.microphone.value: (data, properties, controls) {
    return MicrophoneChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.motion.value: (data, properties, controls) {
    return MotionChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.nitrogenDioxide.value: (data, properties, controls) {
    return NitrogenDioxideChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.occupancy.value: (data, properties, controls) {
    return OccupancyChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.outlet.value: (data, properties, controls) {
    return OutletChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.ozone.value: (data, properties, controls) {
    return OzoneChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.pressure.value: (data, properties, controls) {
    return PressureChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.robotVacuum.value: (data, properties, controls) {
    return RobotVacuumChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.smoke.value: (data, properties, controls) {
    return SmokeChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.speaker.value: (data, properties, controls) {
    return SpeakerChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.sulphurDioxide.value: (data, properties, controls) {
    return SulphurDioxideChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.switcher.value: (data, properties, controls) {
    return SwitcherChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.television.value: (data, properties, controls) {
    return TelevisionChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.temperature.value: (data, properties, controls) {
    return TemperatureChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.thermostat.value: (data, properties, controls) {
    return ThermostatChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.valve.value: (data, properties, controls) {
    return ValveChannelDataModel.fromJson(data, properties, controls);
  },
  ChannelCategoryType.volatileOrganicCompounds.value:
      (data, properties, controls) {
    return VolatileOrganicCompoundsChannelDataModel.fromJson(
      data,
      properties,
      controls,
    );
  },
  ChannelCategoryType.windowCovering.value: (data, properties, controls) {
    return WindowCoveringChannelDataModel.fromJson(data, properties, controls);
  },
};

ChannelDataModel buildChannelModel(
  Map<String, dynamic> data,
  List<ChannelPropertyDataModel> properties,
  List<ChannelControlDataModel> controls,
) {
  final builder = channelModelMappers[data['category']];

  if (builder != null) {
    return builder(data, properties, controls);
  } else {
    throw Exception(
      'Channel model can not be created. Unsupported channel category: ${data['category']}',
    );
  }
}
