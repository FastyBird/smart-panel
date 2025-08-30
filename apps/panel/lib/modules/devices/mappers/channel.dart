import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channels/home_assistant_channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channels/third_party_channel.dart';
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

Map<ChannelCategory,
        ChannelView Function(ChannelModel, List<ChannelPropertyView>)>
    channelViewsMappers = {
  ChannelCategory.generic: (channel, properties) {
    return GenericChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.airParticulate: (channel, properties) {
    return AirParticulateChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.alarm: (channel, properties) {
    return AlarmChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.battery: (channel, properties) {
    return BatteryChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.camera: (channel, properties) {
    return CameraChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.carbonDioxide: (channel, properties) {
    return CarbonDioxideChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.carbonMonoxide: (channel, properties) {
    return CarbonMonoxideChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.contact: (channel, properties) {
    return ContactChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.cooler: (channel, properties) {
    return CoolerChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.deviceInformation: (channel, properties) {
    return DeviceInformationChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.door: (channel, properties) {
    return DoorChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.doorbell: (channel, properties) {
    return DoorbellChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.electricalEnergy: (channel, properties) {
    return ElectricalEnergyChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.electricalPower: (channel, properties) {
    return ElectricalPowerChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.fan: (channel, properties) {
    return FanChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.flow: (channel, properties) {
    return FlowChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.heater: (channel, properties) {
    return HeaterChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.humidity: (channel, properties) {
    return HumidityChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.illuminance: (channel, properties) {
    return IlluminanceChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.leak: (channel, properties) {
    return LeakChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.light: (channel, properties) {
    return LightChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.lock: (channel, properties) {
    return LockChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.mediaInput: (channel, properties) {
    return MediaInputChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.mediaPlayback: (channel, properties) {
    return MediaPlaybackChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.microphone: (channel, properties) {
    return MicrophoneChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.motion: (channel, properties) {
    return MotionChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.nitrogenDioxide: (channel, properties) {
    return NitrogenDioxideChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.occupancy: (channel, properties) {
    return OccupancyChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.outlet: (channel, properties) {
    return OutletChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.ozone: (channel, properties) {
    return OzoneChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.pressure: (channel, properties) {
    return PressureChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.robotVacuum: (channel, properties) {
    return RobotVacuumChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.smoke: (channel, properties) {
    return SmokeChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.speaker: (channel, properties) {
    return SpeakerChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.sulphurDioxide: (channel, properties) {
    return SulphurDioxideChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.switcher: (channel, properties) {
    return SwitcherChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.television: (channel, properties) {
    return TelevisionChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.temperature: (channel, properties) {
    return TemperatureChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.thermostat: (channel, properties) {
    return ThermostatChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.valve: (channel, properties) {
    return ValveChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.volatileOrganicCompounds: (channel, properties) {
    return VolatileOrganicCompoundsChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
  ChannelCategory.windowCovering: (channel, properties) {
    return WindowCoveringChannelView(
      channelModel: channel,
      properties: properties,
    );
  },
};

ChannelView buildChannelView(
  ChannelModel channel,
  List<ChannelPropertyView> properties,
) {
  final builder = channelViewsMappers[channel.category];

  if (builder != null) {
    return builder(channel, properties);
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
