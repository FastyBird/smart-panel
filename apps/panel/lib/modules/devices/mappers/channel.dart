import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channels/generic_channel.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/validation.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/air_particulate.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/alarm.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/battery.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/camera.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/carbon_dioxide.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/carbon_monoxide.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/contact.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/cooler.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/door.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/doorbell.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/flow.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/generic.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/heater.dart';
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
    ChannelCategory category,
    String? name,
    String? description,
    required String device,
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
    properties: properties,
    isValid: isValid,
    validationIssues: validationIssues,
  );
}

Map<ChannelCategory, ChannelView Function(ChannelModel, List<ChannelPropertyView>, bool, List<ValidationIssue>)>
    channelViewsMappers = {
  ChannelCategory.generic: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, GenericChannelView.new);
  },
  ChannelCategory.airParticulate: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, AirParticulateChannelView.new);
  },
  ChannelCategory.alarm: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, AlarmChannelView.new);
  },
  ChannelCategory.battery: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, BatteryChannelView.new);
  },
  ChannelCategory.camera: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, CameraChannelView.new);
  },
  ChannelCategory.carbonDioxide: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, CarbonDioxideChannelView.new);
  },
  ChannelCategory.carbonMonoxide: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, CarbonMonoxideChannelView.new);
  },
  ChannelCategory.contact: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, ContactChannelView.new);
  },
  ChannelCategory.cooler: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, CoolerChannelView.new);
  },
  ChannelCategory.deviceInformation: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, DeviceInformationChannelView.new);
  },
  ChannelCategory.door: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, DoorChannelView.new);
  },
  ChannelCategory.doorbell: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, DoorbellChannelView.new);
  },
  ChannelCategory.electricalEnergy: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, ElectricalEnergyChannelView.new);
  },
  ChannelCategory.electricalPower: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, ElectricalPowerChannelView.new);
  },
  ChannelCategory.fan: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, FanChannelView.new);
  },
  ChannelCategory.flow: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, FlowChannelView.new);
  },
  ChannelCategory.heater: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, HeaterChannelView.new);
  },
  ChannelCategory.humidity: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, HumidityChannelView.new);
  },
  ChannelCategory.illuminance: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, IlluminanceChannelView.new);
  },
  ChannelCategory.leak: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, LeakChannelView.new);
  },
  ChannelCategory.light: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, LightChannelView.new);
  },
  ChannelCategory.lock: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, LockChannelView.new);
  },
  ChannelCategory.mediaInput: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, MediaInputChannelView.new);
  },
  ChannelCategory.mediaPlayback: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, MediaPlaybackChannelView.new);
  },
  ChannelCategory.microphone: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, MicrophoneChannelView.new);
  },
  ChannelCategory.motion: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, MotionChannelView.new);
  },
  ChannelCategory.nitrogenDioxide: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, NitrogenDioxideChannelView.new);
  },
  ChannelCategory.occupancy: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, OccupancyChannelView.new);
  },
  ChannelCategory.outlet: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, OutletChannelView.new);
  },
  ChannelCategory.ozone: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, OzoneChannelView.new);
  },
  ChannelCategory.pressure: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, PressureChannelView.new);
  },
  ChannelCategory.robotVacuum: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, RobotVacuumChannelView.new);
  },
  ChannelCategory.smoke: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, SmokeChannelView.new);
  },
  ChannelCategory.speaker: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, SpeakerChannelView.new);
  },
  ChannelCategory.sulphurDioxide: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, SulphurDioxideChannelView.new);
  },
  ChannelCategory.switcher: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, SwitcherChannelView.new);
  },
  ChannelCategory.television: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, TelevisionChannelView.new);
  },
  ChannelCategory.temperature: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, TemperatureChannelView.new);
  },
  ChannelCategory.thermostat: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, ThermostatChannelView.new);
  },
  ChannelCategory.valve: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, ValveChannelView.new);
  },
  ChannelCategory.volatileOrganicCompounds: (channel, properties, isValid, validationIssues) {
    return _createChannelView(channel, properties, isValid, validationIssues, VolatileOrganicCompoundsChannelView.new);
  },
  ChannelCategory.windowCovering: (channel, properties, isValid, validationIssues) {
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

Map<ChannelCategory, IconData Function()> channelIconMappers = {
  ChannelCategory.generic: () {
    return MdiIcons.chip;
  },
  ChannelCategory.airParticulate: () {
    return MdiIcons.chip;
  },
  ChannelCategory.alarm: () {
    return MdiIcons.chip;
  },
  ChannelCategory.battery: () {
    return MdiIcons.chip;
  },
  ChannelCategory.camera: () {
    return MdiIcons.chip;
  },
  ChannelCategory.carbonDioxide: () {
    return MdiIcons.chip;
  },
  ChannelCategory.carbonMonoxide: () {
    return MdiIcons.chip;
  },
  ChannelCategory.contact: () {
    return MdiIcons.chip;
  },
  ChannelCategory.cooler: () {
    return MdiIcons.chip;
  },
  ChannelCategory.deviceInformation: () {
    return MdiIcons.chip;
  },
  ChannelCategory.door: () {
    return MdiIcons.chip;
  },
  ChannelCategory.doorbell: () {
    return MdiIcons.chip;
  },
  ChannelCategory.electricalEnergy: () {
    return MdiIcons.chip;
  },
  ChannelCategory.electricalPower: () {
    return MdiIcons.chip;
  },
  ChannelCategory.fan: () {
    return MdiIcons.chip;
  },
  ChannelCategory.flow: () {
    return MdiIcons.chip;
  },
  ChannelCategory.heater: () {
    return MdiIcons.chip;
  },
  ChannelCategory.humidity: () {
    return MdiIcons.chip;
  },
  ChannelCategory.illuminance: () {
    return MdiIcons.chip;
  },
  ChannelCategory.leak: () {
    return MdiIcons.chip;
  },
  ChannelCategory.light: () {
    return MdiIcons.chip;
  },
  ChannelCategory.lock: () {
    return MdiIcons.chip;
  },
  ChannelCategory.mediaInput: () {
    return MdiIcons.chip;
  },
  ChannelCategory.mediaPlayback: () {
    return MdiIcons.chip;
  },
  ChannelCategory.microphone: () {
    return MdiIcons.chip;
  },
  ChannelCategory.motion: () {
    return MdiIcons.chip;
  },
  ChannelCategory.nitrogenDioxide: () {
    return MdiIcons.chip;
  },
  ChannelCategory.occupancy: () {
    return MdiIcons.chip;
  },
  ChannelCategory.outlet: () {
    return MdiIcons.chip;
  },
  ChannelCategory.ozone: () {
    return MdiIcons.chip;
  },
  ChannelCategory.pressure: () {
    return MdiIcons.chip;
  },
  ChannelCategory.robotVacuum: () {
    return MdiIcons.chip;
  },
  ChannelCategory.smoke: () {
    return MdiIcons.chip;
  },
  ChannelCategory.speaker: () {
    return MdiIcons.chip;
  },
  ChannelCategory.sulphurDioxide: () {
    return MdiIcons.chip;
  },
  ChannelCategory.switcher: () {
    return MdiIcons.chip;
  },
  ChannelCategory.television: () {
    return MdiIcons.chip;
  },
  ChannelCategory.temperature: () {
    return MdiIcons.chip;
  },
  ChannelCategory.thermostat: () {
    return MdiIcons.chip;
  },
  ChannelCategory.valve: () {
    return MdiIcons.chip;
  },
  ChannelCategory.volatileOrganicCompounds: () {
    return MdiIcons.chip;
  },
  ChannelCategory.windowCovering: () {
    return MdiIcons.chip;
  },
};

IconData buildChannelIcon(ChannelCategory category) {
  final builder = channelIconMappers[category];

  if (builder != null) {
    return builder();
  } else {
    // Fallback to generic icon
    return MdiIcons.chip;
  }
}
