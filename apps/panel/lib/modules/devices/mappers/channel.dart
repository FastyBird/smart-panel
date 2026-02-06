import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channels/generic_channel.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/validation.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/air_particulate.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/air_quality.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/alarm.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/battery.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/camera.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/carbon_dioxide.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/carbon_monoxide.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/contact.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/cooler.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/dehumidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/door.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/doorbell.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/filter.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/flow.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/gas.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/generic.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/illuminance.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/leak.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/lock.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/media_input.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/media_playback.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/microphone.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/motion.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/nitrogen_dioxide.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/occupancy.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/outlet.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/ozone.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/pressure.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/robot_vacuum.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/smoke.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/speaker.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/sulphur_dioxide.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/switcher.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/projector.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/television.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/valve.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/volatile_organic_compounds.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/window_covering.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Registry of channel model builders by type
Map<String, ChannelModel Function(Map<String, dynamic>)> channelModelMappers =
    {};

/// Register a channel model mapper for a specific type
void registerChannelModelMapper(
  String type,
  ChannelModel Function(Map<String, dynamic>) mapper,
) {
  channelModelMappers[type] = mapper;
}

/// Build a channel model from JSON data
/// Falls back to GenericChannelModel for unknown types
ChannelModel buildChannelModel(String type, Map<String, dynamic> data) {
  final builder = channelModelMappers[type];

  if (builder != null) {
    return builder(data);
  } else {
    // Unknown type, use generic model
    return GenericChannelModel.fromJson(data);
  }
}

/// Helper function to create a channel view with extracted attributes
T _createChannelView<T extends ChannelView>(
  ChannelModel model,
  List<ChannelPropertyView> properties,
  bool isValid,
  List<ValidationIssue> validationIssues,
  T Function({
    required String id,
    required String type,
    DevicesModuleChannelCategory category,
    String? name,
    String? description,
    required String device,
    String? parent,
    required List<ChannelPropertyView> properties,
    bool isValid,
    List<ValidationIssue> validationIssues,
  }) constructor,
) {
  return constructor(
    id: model.id,
    type: model.type,
    category: model.category,
    name: model.name,
    description: model.description,
    device: model.device,
    parent: model.parent,
    properties: properties,
    isValid: isValid,
    validationIssues: validationIssues,
  );
}

Map<DevicesModuleChannelCategory, ChannelView Function(ChannelModel, List<ChannelPropertyView>, bool, List<ValidationIssue>)>
    channelViewsMappers = {
  DevicesModuleChannelCategory.generic: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, GenericChannelView.new);
  },
  DevicesModuleChannelCategory.airParticulate: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, AirParticulateChannelView.new);
  },
  DevicesModuleChannelCategory.airQuality: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, AirQualityChannelView.new);
  },
  DevicesModuleChannelCategory.alarm: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, AlarmChannelView.new);
  },
  DevicesModuleChannelCategory.battery: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, BatteryChannelView.new);
  },
  DevicesModuleChannelCategory.camera: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, CameraChannelView.new);
  },
  DevicesModuleChannelCategory.carbonDioxide: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, CarbonDioxideChannelView.new);
  },
  DevicesModuleChannelCategory.carbonMonoxide: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, CarbonMonoxideChannelView.new);
  },
  DevicesModuleChannelCategory.contact: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, ContactChannelView.new);
  },
  DevicesModuleChannelCategory.cooler: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, CoolerChannelView.new);
  },
  DevicesModuleChannelCategory.dehumidifier: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, DehumidifierChannelView.new);
  },
  DevicesModuleChannelCategory.deviceInformation: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, DeviceInformationChannelView.new);
  },
  DevicesModuleChannelCategory.door: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, DoorChannelView.new);
  },
  DevicesModuleChannelCategory.doorbell: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, DoorbellChannelView.new);
  },
  DevicesModuleChannelCategory.electricalEnergy: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, ElectricalEnergyChannelView.new);
  },
  DevicesModuleChannelCategory.electricalPower: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, ElectricalPowerChannelView.new);
  },
  DevicesModuleChannelCategory.fan: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, FanChannelView.new);
  },
  DevicesModuleChannelCategory.filter: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, FilterChannelView.new);
  },
  DevicesModuleChannelCategory.flow: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, FlowChannelView.new);
  },
  DevicesModuleChannelCategory.gas: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, GasChannelView.new);
  },
  DevicesModuleChannelCategory.heater: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, HeaterChannelView.new);
  },
  DevicesModuleChannelCategory.humidifier: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, HumidifierChannelView.new);
  },
  DevicesModuleChannelCategory.humidity: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, HumidityChannelView.new);
  },
  DevicesModuleChannelCategory.illuminance: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, IlluminanceChannelView.new);
  },
  DevicesModuleChannelCategory.leak: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, LeakChannelView.new);
  },
  DevicesModuleChannelCategory.light: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, LightChannelView.new);
  },
  DevicesModuleChannelCategory.lock: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, LockChannelView.new);
  },
  DevicesModuleChannelCategory.mediaInput: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, MediaInputChannelView.new);
  },
  DevicesModuleChannelCategory.mediaPlayback: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, MediaPlaybackChannelView.new);
  },
  DevicesModuleChannelCategory.microphone: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, MicrophoneChannelView.new);
  },
  DevicesModuleChannelCategory.motion: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, MotionChannelView.new);
  },
  DevicesModuleChannelCategory.nitrogenDioxide: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, NitrogenDioxideChannelView.new);
  },
  DevicesModuleChannelCategory.occupancy: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, OccupancyChannelView.new);
  },
  DevicesModuleChannelCategory.outlet: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, OutletChannelView.new);
  },
  DevicesModuleChannelCategory.ozone: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, OzoneChannelView.new);
  },
  DevicesModuleChannelCategory.pressure: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, PressureChannelView.new);
  },
  DevicesModuleChannelCategory.robotVacuum: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, RobotVacuumChannelView.new);
  },
  DevicesModuleChannelCategory.smoke: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, SmokeChannelView.new);
  },
  DevicesModuleChannelCategory.speaker: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, SpeakerChannelView.new);
  },
  DevicesModuleChannelCategory.sulphurDioxide: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, SulphurDioxideChannelView.new);
  },
  DevicesModuleChannelCategory.switcher: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, SwitcherChannelView.new);
  },
  DevicesModuleChannelCategory.television: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, TelevisionChannelView.new);
  },
  DevicesModuleChannelCategory.projector: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, ProjectorChannelView.new);
  },
  DevicesModuleChannelCategory.temperature: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, TemperatureChannelView.new);
  },
  DevicesModuleChannelCategory.thermostat: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, ThermostatChannelView.new);
  },
  DevicesModuleChannelCategory.valve: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, ValveChannelView.new);
  },
  DevicesModuleChannelCategory.volatileOrganicCompounds: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, VolatileOrganicCompoundsChannelView.new);
  },
  DevicesModuleChannelCategory.windowCovering: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, WindowCoveringChannelView.new);
  },
};

ChannelView buildChannelView(
  ChannelModel channel,
  List<ChannelPropertyView> properties, {
  bool isValid = true,
  List<ValidationIssue> validationIssues = const [],
}) {
  final builder = channelViewsMappers[channel.category];

  if (builder != null) {
    return builder(channel, properties, isValid, validationIssues);
  } else {
    // Fallback to generic view
    return _createChannelView(channel, properties, isValid, validationIssues, GenericChannelView.new);
  }
}

/// Returns the canonical icon for a channel category.
///
/// This is the single source of truth for channel/sensor icons.
/// Use this instead of hardcoding [MdiIcons] for sensor types.
IconData buildChannelIcon(DevicesModuleChannelCategory category) {
  switch (category) {
    // Environmental sensors
    case DevicesModuleChannelCategory.temperature:
      return MdiIcons.thermometer;
    case DevicesModuleChannelCategory.humidity:
      return MdiIcons.waterPercent;
    case DevicesModuleChannelCategory.pressure:
      return MdiIcons.gauge;
    case DevicesModuleChannelCategory.illuminance:
      return MdiIcons.brightness6;

    // Air quality sensors
    case DevicesModuleChannelCategory.airParticulate:
      return MdiIcons.blur;
    case DevicesModuleChannelCategory.airQuality:
      return MdiIcons.airFilter;
    case DevicesModuleChannelCategory.carbonDioxide:
      return MdiIcons.moleculeCo2;
    case DevicesModuleChannelCategory.carbonMonoxide:
      return MdiIcons.moleculeCo;
    case DevicesModuleChannelCategory.volatileOrganicCompounds:
      return MdiIcons.molecule;
    case DevicesModuleChannelCategory.ozone:
      return MdiIcons.weatherSunny;
    case DevicesModuleChannelCategory.nitrogenDioxide:
      return MdiIcons.molecule;
    case DevicesModuleChannelCategory.sulphurDioxide:
      return MdiIcons.molecule;

    // Safety & detection sensors
    case DevicesModuleChannelCategory.contact:
      return MdiIcons.doorOpen;
    case DevicesModuleChannelCategory.leak:
      return MdiIcons.pipeLeak;
    case DevicesModuleChannelCategory.motion:
      return MdiIcons.motionSensor;
    case DevicesModuleChannelCategory.occupancy:
      return MdiIcons.accountCheck;
    case DevicesModuleChannelCategory.smoke:
      return MdiIcons.smokeDetector;
    case DevicesModuleChannelCategory.alarm:
      return MdiIcons.bellAlert;
    case DevicesModuleChannelCategory.gas:
      return MdiIcons.gasCylinder;

    // Actuators & controls
    case DevicesModuleChannelCategory.fan:
      return MdiIcons.fan;
    case DevicesModuleChannelCategory.cooler:
      return MdiIcons.snowflake;
    case DevicesModuleChannelCategory.heater:
      return MdiIcons.radiator;
    case DevicesModuleChannelCategory.dehumidifier:
      return MdiIcons.waterOff;
    case DevicesModuleChannelCategory.humidifier:
      return MdiIcons.waterPlus;
    case DevicesModuleChannelCategory.thermostat:
      return MdiIcons.thermostat;
    case DevicesModuleChannelCategory.valve:
      return MdiIcons.valve;
    case DevicesModuleChannelCategory.filter:
      return MdiIcons.airFilter;
    case DevicesModuleChannelCategory.light:
      return MdiIcons.lightbulbOutline;
    case DevicesModuleChannelCategory.outlet:
      return MdiIcons.powerPlugOutline;
    case DevicesModuleChannelCategory.switcher:
      return MdiIcons.toggleSwitch;
    case DevicesModuleChannelCategory.windowCovering:
      return MdiIcons.blindsHorizontal;
    case DevicesModuleChannelCategory.robotVacuum:
      return MdiIcons.robotVacuum;
    case DevicesModuleChannelCategory.lock:
      return MdiIcons.lock;
    case DevicesModuleChannelCategory.door:
      return MdiIcons.door;
    case DevicesModuleChannelCategory.doorbell:
      return MdiIcons.doorbell;
    case DevicesModuleChannelCategory.flow:
      return MdiIcons.waves;

    // Media
    case DevicesModuleChannelCategory.television:
      return MdiIcons.television;
    case DevicesModuleChannelCategory.projector:
      return MdiIcons.projector;
    case DevicesModuleChannelCategory.speaker:
      return MdiIcons.speaker;
    case DevicesModuleChannelCategory.mediaInput:
      return MdiIcons.videoInputHdmi;
    case DevicesModuleChannelCategory.mediaPlayback:
      return MdiIcons.play;
    case DevicesModuleChannelCategory.microphone:
      return MdiIcons.microphone;
    case DevicesModuleChannelCategory.camera:
      return MdiIcons.cctv;

    // System
    case DevicesModuleChannelCategory.battery:
      return MdiIcons.battery;
    case DevicesModuleChannelCategory.deviceInformation:
      return MdiIcons.informationOutline;
    case DevicesModuleChannelCategory.electricalEnergy:
      return MdiIcons.flashTriangle;
    case DevicesModuleChannelCategory.electricalPower:
      return MdiIcons.flash;

    default:
      return MdiIcons.chip;
  }
}
