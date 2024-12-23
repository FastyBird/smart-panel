import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/generic.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/lighting.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/thermostat.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:flutter/material.dart';

Map<String, Widget Function(DeviceDataModel)> deviceWidgetMappers = {
  DeviceCategoryType.lighting.value: (device) {
    return LightingDeviceDetailPage(device: device);
  },
  DeviceCategoryType.thermostat.value: (device) {
    return ThermostatDeviceDetailPage(device: device);
  },
};

Widget buildDeviceWidget(DeviceDataModel device) {
  final builder = deviceWidgetMappers[device.category.value];

  if (builder == null) {
    return GenericDeviceDetailPage(device: device);
  }

  return builder(device);
}

Map<String, IconData> deviceIconMappers = {
  DeviceCategoryType.airConditioner.value: Icons.hvac,
  DeviceCategoryType.airDehumidifier.value: Icons.water_drop,
  DeviceCategoryType.airHumidifier.value: Icons.water_drop,
  DeviceCategoryType.airPurifier.value: Icons.hvac,
  DeviceCategoryType.alarm.value: Icons.notifications,
  DeviceCategoryType.audioReceiver.value: Icons.audiotrack,
  DeviceCategoryType.camera.value: Icons.video_camera_back,
  DeviceCategoryType.doorBell.value: Icons.notifications_active,
  DeviceCategoryType.doorLock.value: Icons.door_front_door,
  DeviceCategoryType.garageDoorLock.value: Icons.garage,
  DeviceCategoryType.genericSwitcher.value: Icons.toggle_off,
  DeviceCategoryType.heater.value: Icons.heat_pump,
  DeviceCategoryType.hvac.value: Icons.hvac,
  DeviceCategoryType.lighting.value: Icons.light,
  DeviceCategoryType.media.value: Icons.perm_media,
  DeviceCategoryType.outlet.value: Icons.outlet,
  DeviceCategoryType.sensor.value: Icons.sensors,
  DeviceCategoryType.speaker.value: Icons.speaker,
  DeviceCategoryType.television.value: Icons.tv,
  DeviceCategoryType.thermostat.value: Icons.thermostat,
  DeviceCategoryType.windowCovering.value: Icons.blinds_closed,
  DeviceCategoryType.windowLock.value: Icons.window,
};

IconData buildDeviceIcon(DeviceDataModel device) {
  return device.icon != null
      ? device.icon!
      : (deviceIconMappers[device.category.value] ?? Icons.devices_other);
}
