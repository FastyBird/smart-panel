import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channels/home_assistant_channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channels/shelly_ng_channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channels/shelly_v1_channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channels/third_party_channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channels/wled_channel.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/validation.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/ui.dart';
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

Map<String, ChannelModel Function(Map<String, dynamic>)> channelModelMappers = {
  DeviceType.devicesThirdParty.value: (data) {
    return ThirdPartyChannelModel.fromJson(data);
  },
  DeviceType.devicesHomeAssistant.value: (data) {
    return HomeAssistantChannelModel.fromJson(data);
  },
  DeviceType.devicesShellyNg.value: (data) {
    return ShellyNgChannelModel.fromJson(data);
  },
  DeviceType.devicesShellyV1.value: (data) {
    return ShellyV1ChannelModel.fromJson(data);
  },
  DeviceType.devicesWled.value: (data) {
    return WledChannelModel.fromJson(data);
  },
};

ChannelModel buildChannelModel(String type, Map<String, dynamic> data) {
  final builder = channelModelMappers[type];

  if (builder != null) {
    return builder(data);
  } else {
    throw Exception(
      'Channel model can not be created. Unsupported channel type: $type',
    );
  }
}

Map<
        ChannelCategory,
        ChannelView Function(
          ChannelModel,
          List<ChannelPropertyView>,
          bool,
          List<ValidationIssue>,
        )> channelViewsMappers = {
  ChannelCategory.generic: (channel, properties, isValid, validationIssues) {
    return GenericChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.airParticulate:
      (channel, properties, isValid, validationIssues) {
    return AirParticulateChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.alarm: (channel, properties, isValid, validationIssues) {
    return AlarmChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.battery: (channel, properties, isValid, validationIssues) {
    return BatteryChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.camera: (channel, properties, isValid, validationIssues) {
    return CameraChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.carbonDioxide:
      (channel, properties, isValid, validationIssues) {
    return CarbonDioxideChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.carbonMonoxide:
      (channel, properties, isValid, validationIssues) {
    return CarbonMonoxideChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.contact: (channel, properties, isValid, validationIssues) {
    return ContactChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.cooler: (channel, properties, isValid, validationIssues) {
    return CoolerChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.deviceInformation:
      (channel, properties, isValid, validationIssues) {
    return DeviceInformationChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.door: (channel, properties, isValid, validationIssues) {
    return DoorChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.doorbell: (channel, properties, isValid, validationIssues) {
    return DoorbellChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.electricalEnergy:
      (channel, properties, isValid, validationIssues) {
    return ElectricalEnergyChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.electricalPower:
      (channel, properties, isValid, validationIssues) {
    return ElectricalPowerChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.fan: (channel, properties, isValid, validationIssues) {
    return FanChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.flow: (channel, properties, isValid, validationIssues) {
    return FlowChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.heater: (channel, properties, isValid, validationIssues) {
    return HeaterChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.humidity: (channel, properties, isValid, validationIssues) {
    return HumidityChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.illuminance:
      (channel, properties, isValid, validationIssues) {
    return IlluminanceChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.leak: (channel, properties, isValid, validationIssues) {
    return LeakChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.light: (channel, properties, isValid, validationIssues) {
    return LightChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.lock: (channel, properties, isValid, validationIssues) {
    return LockChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.mediaInput:
      (channel, properties, isValid, validationIssues) {
    return MediaInputChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.mediaPlayback:
      (channel, properties, isValid, validationIssues) {
    return MediaPlaybackChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.microphone:
      (channel, properties, isValid, validationIssues) {
    return MicrophoneChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.motion: (channel, properties, isValid, validationIssues) {
    return MotionChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.nitrogenDioxide:
      (channel, properties, isValid, validationIssues) {
    return NitrogenDioxideChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.occupancy: (channel, properties, isValid, validationIssues) {
    return OccupancyChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.outlet: (channel, properties, isValid, validationIssues) {
    return OutletChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.ozone: (channel, properties, isValid, validationIssues) {
    return OzoneChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.pressure: (channel, properties, isValid, validationIssues) {
    return PressureChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.robotVacuum:
      (channel, properties, isValid, validationIssues) {
    return RobotVacuumChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.smoke: (channel, properties, isValid, validationIssues) {
    return SmokeChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.speaker: (channel, properties, isValid, validationIssues) {
    return SpeakerChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.sulphurDioxide:
      (channel, properties, isValid, validationIssues) {
    return SulphurDioxideChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.switcher: (channel, properties, isValid, validationIssues) {
    return SwitcherChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.television:
      (channel, properties, isValid, validationIssues) {
    return TelevisionChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.temperature:
      (channel, properties, isValid, validationIssues) {
    return TemperatureChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.thermostat:
      (channel, properties, isValid, validationIssues) {
    return ThermostatChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.valve: (channel, properties, isValid, validationIssues) {
    return ValveChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.volatileOrganicCompounds:
      (channel, properties, isValid, validationIssues) {
    return VolatileOrganicCompoundsChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  ChannelCategory.windowCovering:
      (channel, properties, isValid, validationIssues) {
    return WindowCoveringChannelView(
      channelModel: channel,
      properties: properties,
      isValid: isValid,
      validationIssues: validationIssues,
    );
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
    throw ArgumentError(
      'Channel view can not be created. Unsupported channel category: ${channel.category.value}',
    );
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
    throw Exception(
      'Channel icon can not be created. Unsupported channel category: ${category.value}',
    );
  }
}
