import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/generic_device.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/validation.dart';
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

/// Registry of device model builders by type
Map<String, DeviceModel Function(Map<String, dynamic>)> deviceModelMappers = {};

/// Register a device model mapper for a specific type
void registerDeviceModelMapper(
  String type,
  DeviceModel Function(Map<String, dynamic>) mapper,
) {
  deviceModelMappers[type] = mapper;
}

/// Build a device model from JSON data
/// Falls back to GenericDeviceModel for unknown types
DeviceModel buildDeviceModel(String type, Map<String, dynamic> data) {
  final builder = deviceModelMappers[type];

  if (builder != null) {
    return builder(data);
  } else {
    // Unknown type, use generic model
    return GenericDeviceModel.fromJson(data);
  }
}

/// Helper function to create a device view with extracted attributes
T _createDeviceView<T extends DeviceView>(
  DeviceModel model,
  List<ChannelView> channels,
  bool isValid,
  List<ValidationIssue> validationIssues,
  T Function({
    required String id,
    required String type,
    DeviceCategory category,
    required String name,
    String? description,
    IconData? icon,
    String? roomId,
    List<String> zoneIds,
    required List<ChannelView> channels,
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
    icon: buildDeviceIcon(model.category),
    roomId: model.roomId,
    zoneIds: model.zoneIds,
    channels: channels,
    isValid: isValid,
    validationIssues: validationIssues,
  );
}

Map<DeviceCategory, DeviceView Function(DeviceModel, List<ChannelView>, bool, List<ValidationIssue>)>
    deviceViewsMappers = {
  DeviceCategory.generic: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, GenericDeviceView.new);
  },
  DeviceCategory.airConditioner: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, AirConditionerDeviceView.new);
  },
  DeviceCategory.airDehumidifier: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, AirDehumidifierDeviceView.new);
  },
  DeviceCategory.airHumidifier: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, AirHumidifierDeviceView.new);
  },
  DeviceCategory.airPurifier: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, AirPurifierDeviceView.new);
  },
  DeviceCategory.alarm: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, AlarmDeviceView.new);
  },
  DeviceCategory.camera: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, CameraDeviceView.new);
  },
  DeviceCategory.door: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, DoorDeviceView.new);
  },
  DeviceCategory.doorbell: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, DoorbellDeviceView.new);
  },
  DeviceCategory.fan: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, FanDeviceView.new);
  },
  DeviceCategory.heater: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, HeaterDeviceView.new);
  },
  DeviceCategory.lighting: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, LightingDeviceView.new);
  },
  DeviceCategory.lock: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, LockDeviceView.new);
  },
  DeviceCategory.media: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, MediaDeviceView.new);
  },
  DeviceCategory.outlet: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, OutletDeviceView.new);
  },
  DeviceCategory.pump: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, PumpDeviceView.new);
  },
  DeviceCategory.robotVacuum: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, RobotVacuumDeviceView.new);
  },
  DeviceCategory.sensor: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, SensorDeviceView.new);
  },
  DeviceCategory.speaker: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, SpeakerDeviceView.new);
  },
  DeviceCategory.sprinkler: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, SprinklerDeviceView.new);
  },
  DeviceCategory.switcher: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, SwitcherDeviceView.new);
  },
  DeviceCategory.television: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, TelevisionDeviceView.new);
  },
  DeviceCategory.thermostat: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, ThermostatDeviceView.new);
  },
  DeviceCategory.valve: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, ValveDeviceView.new);
  },
  DeviceCategory.windowCovering: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, WindowCoveringDeviceView.new);
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
    // Fallback to generic view
    return _createDeviceView(device, channels, isValid, validationIssues, GenericDeviceView.new);
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
    // Fallback to generic icon
    return MdiIcons.powerPlug;
  }
}
