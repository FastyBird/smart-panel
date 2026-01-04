import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/generic_device.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/air_conditioner.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/air_dehumidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/air_humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/air_purifier.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/alarm.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/camera.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/door.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/doorbell.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/generic.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/lock.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/media.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/outlet.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/pump.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/robot_vacuum.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/sensor.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/speaker.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/sprinkler.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/switcher.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/television.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/valve.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/window_covering.dart';
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

/// Registry of device widget builders by category
Map<DeviceCategory, Widget Function(DeviceView)> deviceWidgetMappers = {
  DeviceCategory.airConditioner: (device) {
    if (device is! AirConditionerDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Air conditioner device detail',
      );
    }
    return AirConditionerDeviceDetail(device: device);
  },
  DeviceCategory.airDehumidifier: (device) {
    if (device is! AirDehumidifierDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Air dehumidifier device detail',
      );
    }
    return AirDehumidifierDeviceDetail(device: device);
  },
  DeviceCategory.airHumidifier: (device) {
    if (device is! AirHumidifierDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Air humidifier device detail',
      );
    }
    return AirHumidifierDeviceDetail(device: device);
  },
  DeviceCategory.airPurifier: (device) {
    if (device is! AirPurifierDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Air purifier device detail',
      );
    }
    return AirPurifierDeviceDetail(device: device);
  },
  DeviceCategory.alarm: (device) {
    if (device is! AlarmDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Alarm device detail',
      );
    }
    return AlarmDeviceDetail(device: device);
  },
  DeviceCategory.camera: (device) {
    if (device is! CameraDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Camera device detail',
      );
    }
    return CameraDeviceDetail(device: device);
  },
  DeviceCategory.door: (device) {
    if (device is! DoorDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Door device detail',
      );
    }
    return DoorDeviceDetail(device: device);
  },
  DeviceCategory.doorbell: (device) {
    if (device is! DoorbellDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Doorbell device detail',
      );
    }
    return DoorbellDeviceDetail(device: device);
  },
  DeviceCategory.fan: (device) {
    if (device is! FanDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Fan device detail',
      );
    }
    return FanDeviceDetail(device: device);
  },
  DeviceCategory.heater: (device) {
    if (device is! HeaterDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Heater device detail',
      );
    }
    return HeaterDeviceDetail(device: device);
  },
  DeviceCategory.lighting: (device) {
    if (device is! LightingDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Lighting device detail',
      );
    }
    return LightingDeviceDetail(device: device);
  },
  DeviceCategory.lock: (device) {
    if (device is! LockDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Lock device detail',
      );
    }
    return LockDeviceDetail(device: device);
  },
  DeviceCategory.media: (device) {
    if (device is! MediaDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Media device detail',
      );
    }
    return MediaDeviceDetail(device: device);
  },
  DeviceCategory.outlet: (device) {
    if (device is! OutletDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Outlet device detail',
      );
    }
    return OutletDeviceDetail(device: device);
  },
  DeviceCategory.pump: (device) {
    if (device is! PumpDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Pump device detail',
      );
    }
    return PumpDeviceDetail(device: device);
  },
  DeviceCategory.robotVacuum: (device) {
    if (device is! RobotVacuumDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Robot vacuum device detail',
      );
    }
    return RobotVacuumDeviceDetail(device: device);
  },
  DeviceCategory.sensor: (device) {
    if (device is! SensorDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Sensor device detail',
      );
    }
    return SensorDeviceDetail(device: device);
  },
  DeviceCategory.speaker: (device) {
    if (device is! SpeakerDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Speaker device detail',
      );
    }
    return SpeakerDeviceDetail(device: device);
  },
  DeviceCategory.sprinkler: (device) {
    if (device is! SprinklerDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Sprinkler device detail',
      );
    }
    return SprinklerDeviceDetail(device: device);
  },
  DeviceCategory.switcher: (device) {
    if (device is! SwitcherDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Switcher device detail',
      );
    }
    return SwitcherDeviceDetail(device: device);
  },
  DeviceCategory.television: (device) {
    if (device is! TelevisionDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Television device detail',
      );
    }
    return TelevisionDeviceDetail(device: device);
  },
  DeviceCategory.thermostat: (device) {
    if (device is! ThermostatDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Thermostat device detail',
      );
    }
    return ThermostatDeviceDetail(device: device);
  },
  DeviceCategory.valve: (device) {
    if (device is! ValveDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Valve device detail',
      );
    }
    return ValveDeviceDetail(device: device);
  },
  DeviceCategory.windowCovering: (device) {
    if (device is! WindowCoveringDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Window covering device detail',
      );
    }
    return WindowCoveringDeviceDetail(device: device);
  },
};

/// Build a device detail widget for the given device view
Widget buildDeviceWidget(DeviceView device) {
  final builder = deviceWidgetMappers[device.category];

  if (builder == null) {
    return GenericDeviceDetail(device: device);
  }

  return builder(device);
}
