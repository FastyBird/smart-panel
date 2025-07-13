import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/home_assistant_device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/third_party_device.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_dehumidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_purifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/alarm.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/camera.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/door.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/doorbell.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/generic.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lock.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/media.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/outlet.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/pump.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/robot_vacuum.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/sensor.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/speaker.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/sprinkler.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/switcher.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/television.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/valve.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/window_covering.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

Map<String, DeviceModel Function(Map<String, dynamic>)> deviceModelMappers = {
  'third-party': (data) {
    return ThirdPartyDeviceModel.fromJson(data);
  },
  'home-assistant': (data) {
    return HomeAssistantDeviceModel.fromJson(data);
  },
};

DeviceModel buildDeviceModel(String type, Map<String, dynamic> data) {
  final builder = deviceModelMappers[type];

  if (builder != null) {
    return builder(data);
  } else {
    throw Exception(
      'Device model can not be created. Unsupported device type: $type',
    );
  }
}

Map<DeviceCategory, DeviceView Function(DeviceModel, List<ChannelView>)>
    deviceViewsMappers = {
  DeviceCategory.generic: (device, channels) {
    return GenericDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.airConditioner: (device, channels) {
    return AirConditionerDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.airDehumidifier: (device, channels) {
    return AirDehumidifierDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.airHumidifier: (device, channels) {
    return AirHumidifierDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.airPurifier: (device, channels) {
    return AirPurifierDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.alarm: (device, channels) {
    return AlarmDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.camera: (device, channels) {
    return CameraDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.door: (device, channels) {
    return DoorDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.doorbell: (device, channels) {
    return DoorbellDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.fan: (device, channels) {
    return FanDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.heater: (device, channels) {
    return HeaterDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.lighting: (device, channels) {
    return LightingDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.lock: (device, channels) {
    return LockDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.media: (device, channels) {
    return MediaDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.outlet: (device, channels) {
    return OutletDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.pump: (device, channels) {
    return PumpDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.robotVacuum: (device, channels) {
    return RobotVacuumDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.sensor: (device, channels) {
    return SensorDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.speaker: (device, channels) {
    return SpeakerDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.sprinkler: (device, channels) {
    return SprinklerDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.switcher: (device, channels) {
    return SwitcherDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.television: (device, channels) {
    return TelevisionDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.thermostat: (device, channels) {
    return ThermostatDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.valve: (device, channels) {
    return ValveDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
  DeviceCategory.windowCovering: (device, channels) {
    return WindowCoveringDeviceView(
      deviceModel: device,
      channels: channels,
    );
  },
};

DeviceView buildDeviceView(
  DeviceModel device,
  List<ChannelView> channels,
) {
  final builder = deviceViewsMappers[device.category];

  if (builder != null) {
    return builder(device, channels);
  } else {
    throw ArgumentError(
      'Device view can not be created. Unsupported device category: ${device.category.value}',
    );
  }
}

Map<DeviceCategory, IconData Function()> deviceIconMappers = {
  DeviceCategory.generic: () {
    return MdiIcons.powerPlug;
  },
  DeviceCategory.airConditioner: () {
    return MdiIcons.airConditioner;
  },
  DeviceCategory.airDehumidifier: () {
    return MdiIcons.airPurifier;
  },
  DeviceCategory.airHumidifier: () {
    return MdiIcons.airPurifier;
  },
  DeviceCategory.airPurifier: () {
    return MdiIcons.airPurifier;
  },
  DeviceCategory.alarm: () {
    return MdiIcons.alarmLight;
  },
  DeviceCategory.camera: () {
    return MdiIcons.cctv;
  },
  DeviceCategory.door: () {
    return MdiIcons.door;
  },
  DeviceCategory.doorbell: () {
    return MdiIcons.doorbell;
  },
  DeviceCategory.fan: () {
    return MdiIcons.fan;
  },
  DeviceCategory.heater: () {
    return MdiIcons.radiator;
  },
  DeviceCategory.lighting: () {
    return MdiIcons.lightbulb;
  },
  DeviceCategory.lock: () {
    return MdiIcons.keyVariant;
  },
  DeviceCategory.media: () {
    return MdiIcons.multimedia;
  },
  DeviceCategory.outlet: () {
    return MdiIcons.powerSocketFr;
  },
  DeviceCategory.pump: () {
    return MdiIcons.pump;
  },
  DeviceCategory.robotVacuum: () {
    return MdiIcons.robotVacuum;
  },
  DeviceCategory.sensor: () {
    return MdiIcons.accessPoint;
  },
  DeviceCategory.speaker: () {
    return MdiIcons.speaker;
  },
  DeviceCategory.sprinkler: () {
    return MdiIcons.sprinklerVariant;
  },
  DeviceCategory.switcher: () {
    return MdiIcons.lightSwitch;
  },
  DeviceCategory.television: () {
    return MdiIcons.television;
  },
  DeviceCategory.thermostat: () {
    return MdiIcons.thermostat;
  },
  DeviceCategory.valve: () {
    return MdiIcons.valve;
  },
  DeviceCategory.windowCovering: () {
    return MdiIcons.blindsHorizontal;
  },
};

IconData buildDeviceIcon(DeviceCategory category, [IconData? icon]) {
  if (icon != null) {
    return icon;
  }

  final builder = deviceIconMappers[category];

  if (builder != null) {
    return builder();
  } else {
    throw Exception(
      'Device icon can not be created. Unsupported device category: ${category.value}',
    );
  }
}
