import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/home_assistant_device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/shelly_ng_device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/shelly_v1_device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/third_party_device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/wled_device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/zigbee2mqtt_device.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/validation.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/ui.dart';
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
  DeviceType.devicesThirdParty.value: (data) {
    return ThirdPartyDeviceModel.fromJson(data);
  },
  DeviceType.devicesHomeAssistant.value: (data) {
    return HomeAssistantDeviceModel.fromJson(data);
  },
  DeviceType.devicesShellyNg.value: (data) {
    return ShellyNgDeviceModel.fromJson(data);
  },
  DeviceType.devicesShellyV1.value: (data) {
    return ShellyV1DeviceModel.fromJson(data);
  },
  DeviceType.devicesWled.value: (data) {
    return WledDeviceModel.fromJson(data);
  },
  DeviceType.devicesZigbee2mqtt.value: (data) {
    return Zigbee2mqttDeviceModel.fromJson(data);
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

Map<
        DeviceCategory,
        DeviceView Function(
          DeviceModel,
          List<ChannelView>,
          bool,
          List<ValidationIssue>,
        )> deviceViewsMappers = {
  DeviceCategory.generic: (device, channels, isValid, validationIssues) {
    return GenericDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.airConditioner:
      (device, channels, isValid, validationIssues) {
    return AirConditionerDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.airDehumidifier:
      (device, channels, isValid, validationIssues) {
    return AirDehumidifierDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.airHumidifier: (device, channels, isValid, validationIssues) {
    return AirHumidifierDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.airPurifier: (device, channels, isValid, validationIssues) {
    return AirPurifierDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.alarm: (device, channels, isValid, validationIssues) {
    return AlarmDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.camera: (device, channels, isValid, validationIssues) {
    return CameraDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.door: (device, channels, isValid, validationIssues) {
    return DoorDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.doorbell: (device, channels, isValid, validationIssues) {
    return DoorbellDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.fan: (device, channels, isValid, validationIssues) {
    return FanDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.heater: (device, channels, isValid, validationIssues) {
    return HeaterDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.lighting: (device, channels, isValid, validationIssues) {
    return LightingDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.lock: (device, channels, isValid, validationIssues) {
    return LockDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.media: (device, channels, isValid, validationIssues) {
    return MediaDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.outlet: (device, channels, isValid, validationIssues) {
    return OutletDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.pump: (device, channels, isValid, validationIssues) {
    return PumpDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.robotVacuum: (device, channels, isValid, validationIssues) {
    return RobotVacuumDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.sensor: (device, channels, isValid, validationIssues) {
    return SensorDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.speaker: (device, channels, isValid, validationIssues) {
    return SpeakerDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.sprinkler: (device, channels, isValid, validationIssues) {
    return SprinklerDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.switcher: (device, channels, isValid, validationIssues) {
    return SwitcherDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.television: (device, channels, isValid, validationIssues) {
    return TelevisionDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.thermostat: (device, channels, isValid, validationIssues) {
    return ThermostatDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.valve: (device, channels, isValid, validationIssues) {
    return ValveDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
  DeviceCategory.windowCovering: (device, channels, isValid, validationIssues) {
    return WindowCoveringDeviceView(
      deviceModel: device,
      channels: channels,
      isValid: isValid,
      validationIssues: validationIssues,
    );
  },
};

DeviceView buildDeviceView(
  DeviceModel device,
  List<ChannelView> channels, {
  bool isValid = true,
  List<ValidationIssue> validationIssues = const [],
}) {
  final builder = deviceViewsMappers[device.category];

  if (builder != null) {
    return builder(device, channels, isValid, validationIssues);
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
