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
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/validation.dart';
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
    DevicesModuleDeviceCategory category,
    required String name,
    String? description,
    IconData? icon,
    String? roomId,
    List<String> zoneIds,
    required List<ChannelView> channels,
    bool enabled,
    bool isOnline,
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
    enabled: model.enabled,
    isOnline: model.isOnline,
    isValid: isValid,
    validationIssues: validationIssues,
  );
}

Map<DevicesModuleDeviceCategory, DeviceView Function(DeviceModel, List<ChannelView>, bool, List<ValidationIssue>)>
    deviceViewsMappers = {
  DevicesModuleDeviceCategory.generic: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, GenericDeviceView.new);
  },
  DevicesModuleDeviceCategory.airConditioner: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, AirConditionerDeviceView.new);
  },
  DevicesModuleDeviceCategory.airDehumidifier: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, AirDehumidifierDeviceView.new);
  },
  DevicesModuleDeviceCategory.airHumidifier: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, AirHumidifierDeviceView.new);
  },
  DevicesModuleDeviceCategory.airPurifier: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, AirPurifierDeviceView.new);
  },
  DevicesModuleDeviceCategory.alarm: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, AlarmDeviceView.new);
  },
  DevicesModuleDeviceCategory.camera: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, CameraDeviceView.new);
  },
  DevicesModuleDeviceCategory.door: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, DoorDeviceView.new);
  },
  DevicesModuleDeviceCategory.doorbell: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, DoorbellDeviceView.new);
  },
  DevicesModuleDeviceCategory.fan: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, FanDeviceView.new);
  },
  DevicesModuleDeviceCategory.heatingUnit: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, HeaterDeviceView.new);
  },
  DevicesModuleDeviceCategory.waterHeater: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, HeaterDeviceView.new);
  },
  DevicesModuleDeviceCategory.lighting: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, LightingDeviceView.new);
  },
  DevicesModuleDeviceCategory.lock: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, LockDeviceView.new);
  },
  DevicesModuleDeviceCategory.media: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, MediaDeviceView.new);
  },
  DevicesModuleDeviceCategory.outlet: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, OutletDeviceView.new);
  },
  DevicesModuleDeviceCategory.pump: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, PumpDeviceView.new);
  },
  DevicesModuleDeviceCategory.robotVacuum: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, RobotVacuumDeviceView.new);
  },
  DevicesModuleDeviceCategory.sensor: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, SensorDeviceView.new);
  },
  DevicesModuleDeviceCategory.speaker: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, SpeakerDeviceView.new);
  },
  DevicesModuleDeviceCategory.sprinkler: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, SprinklerDeviceView.new);
  },
  DevicesModuleDeviceCategory.switcher: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, SwitcherDeviceView.new);
  },
  DevicesModuleDeviceCategory.television: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, TelevisionDeviceView.new);
  },
  DevicesModuleDeviceCategory.thermostat: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, ThermostatDeviceView.new);
  },
  DevicesModuleDeviceCategory.valve: (device, channels, isValid, validationIssues) {
    return _createDeviceView(device, channels, isValid, validationIssues, ValveDeviceView.new);
  },
  DevicesModuleDeviceCategory.windowCovering: (device, channels, isValid, validationIssues) {
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

Map<DevicesModuleDeviceCategory, IconData Function()> deviceIconMappers = {
  DevicesModuleDeviceCategory.generic: () {
    return MdiIcons.powerPlug;
  },
  DevicesModuleDeviceCategory.airConditioner: () {
    return MdiIcons.airConditioner;
  },
  DevicesModuleDeviceCategory.airDehumidifier: () {
    return MdiIcons.airPurifier;
  },
  DevicesModuleDeviceCategory.airHumidifier: () {
    return MdiIcons.airPurifier;
  },
  DevicesModuleDeviceCategory.airPurifier: () {
    return MdiIcons.airPurifier;
  },
  DevicesModuleDeviceCategory.alarm: () {
    return MdiIcons.alarmLight;
  },
  DevicesModuleDeviceCategory.camera: () {
    return MdiIcons.cctv;
  },
  DevicesModuleDeviceCategory.door: () {
    return MdiIcons.door;
  },
  DevicesModuleDeviceCategory.doorbell: () {
    return MdiIcons.doorbell;
  },
  DevicesModuleDeviceCategory.fan: () {
    return MdiIcons.fan;
  },
  DevicesModuleDeviceCategory.heatingUnit: () {
    return MdiIcons.radiator;
  },
  DevicesModuleDeviceCategory.waterHeater: () {
    return MdiIcons.waterBoiler;
  },
  DevicesModuleDeviceCategory.lighting: () {
    return MdiIcons.lightbulb;
  },
  DevicesModuleDeviceCategory.lock: () {
    return MdiIcons.keyVariant;
  },
  DevicesModuleDeviceCategory.media: () {
    return MdiIcons.multimedia;
  },
  DevicesModuleDeviceCategory.outlet: () {
    return MdiIcons.powerSocketFr;
  },
  DevicesModuleDeviceCategory.pump: () {
    return MdiIcons.pump;
  },
  DevicesModuleDeviceCategory.robotVacuum: () {
    return MdiIcons.robotVacuum;
  },
  DevicesModuleDeviceCategory.sensor: () {
    return MdiIcons.accessPoint;
  },
  DevicesModuleDeviceCategory.speaker: () {
    return MdiIcons.speaker;
  },
  DevicesModuleDeviceCategory.sprinkler: () {
    return MdiIcons.sprinklerVariant;
  },
  DevicesModuleDeviceCategory.switcher: () {
    return MdiIcons.lightSwitch;
  },
  DevicesModuleDeviceCategory.television: () {
    return MdiIcons.television;
  },
  DevicesModuleDeviceCategory.thermostat: () {
    return MdiIcons.thermostat;
  },
  DevicesModuleDeviceCategory.valve: () {
    return MdiIcons.valve;
  },
  DevicesModuleDeviceCategory.windowCovering: () {
    return MdiIcons.blindsHorizontal;
  },
};

IconData buildDeviceIcon(DevicesModuleDeviceCategory category, [IconData? icon]) {
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
Map<DevicesModuleDeviceCategory, Widget Function(DeviceView)> deviceWidgetMappers = {
  DevicesModuleDeviceCategory.airConditioner: (device) {
    if (device is! AirConditionerDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Air conditioner device detail',
      );
    }
    return AirConditionerDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.airDehumidifier: (device) {
    if (device is! AirDehumidifierDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Air dehumidifier device detail',
      );
    }
    return AirDehumidifierDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.airHumidifier: (device) {
    if (device is! AirHumidifierDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Air humidifier device detail',
      );
    }
    return AirHumidifierDeviceDetail(
      name: device.name,
      initialState: const HumidifierDeviceState(),
    );
  },
  DevicesModuleDeviceCategory.airPurifier: (device) {
    if (device is! AirPurifierDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Air purifier device detail',
      );
    }
    return AirPurifierDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.alarm: (device) {
    if (device is! AlarmDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Alarm device detail',
      );
    }
    return AlarmDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.camera: (device) {
    if (device is! CameraDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Camera device detail',
      );
    }
    return CameraDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.door: (device) {
    if (device is! DoorDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Door device detail',
      );
    }
    return DoorDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.doorbell: (device) {
    if (device is! DoorbellDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Doorbell device detail',
      );
    }
    return DoorbellDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.fan: (device) {
    if (device is! FanDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Fan device detail',
      );
    }
    return FanDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.heatingUnit: (device) {
    if (device is! HeaterDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Heating Unit device detail',
      );
    }
    return HeaterDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.waterHeater: (device) {
    if (device is! HeaterDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Water Heater device detail',
      );
    }
    return HeaterDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.lighting: (device) {
    if (device is! LightingDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Lighting device detail',
      );
    }
    return LightingDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.lock: (device) {
    if (device is! LockDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Lock device detail',
      );
    }
    return LockDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.media: (device) {
    if (device is! MediaDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Media device detail',
      );
    }
    return MediaDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.outlet: (device) {
    if (device is! OutletDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Outlet device detail',
      );
    }
    return OutletDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.pump: (device) {
    if (device is! PumpDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Pump device detail',
      );
    }
    return PumpDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.robotVacuum: (device) {
    if (device is! RobotVacuumDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Robot vacuum device detail',
      );
    }
    return RobotVacuumDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.sensor: (device) {
    if (device is! SensorDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Sensor device detail',
      );
    }
    return SensorDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.speaker: (device) {
    if (device is! SpeakerDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Speaker device detail',
      );
    }
    return SpeakerDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.sprinkler: (device) {
    if (device is! SprinklerDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Sprinkler device detail',
      );
    }
    return SprinklerDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.switcher: (device) {
    if (device is! SwitcherDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Switcher device detail',
      );
    }
    return SwitcherDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.television: (device) {
    if (device is! TelevisionDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Television device detail',
      );
    }
    return TelevisionDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.thermostat: (device) {
    if (device is! ThermostatDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Thermostat device detail',
      );
    }
    return ThermostatDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.valve: (device) {
    if (device is! ValveDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Valve device detail',
      );
    }
    return ValveDeviceDetail(device: device);
  },
  DevicesModuleDeviceCategory.windowCovering: (device) {
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
