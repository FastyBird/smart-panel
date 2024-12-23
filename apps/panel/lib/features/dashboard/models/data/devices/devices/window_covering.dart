import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/window_covering.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:flutter/cupertino.dart';

class WindowCoveringDeviceDataModel extends DeviceDataModel
    with
        DeviceDeviceInformationMixin,
        DeviceBatteryMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin {
  WindowCoveringDeviceDataModel({
    required super.id,
    required super.name,
    super.description,
    super.icon,
    super.controls,
    super.channels,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: DeviceCategoryType.windowCovering,
        );

  @override
  DeviceInformationChannelDataModel get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelDataModel>().first;

  WindowCoveringChannelDataModel get windowCoveringChannel =>
      channels.whereType<WindowCoveringChannelDataModel>().first;

  @override
  BatteryChannelDataModel? get batteryChannel =>
      channels.whereType<BatteryChannelDataModel>().firstOrNull;

  @override
  ElectricalEnergyChannelDataModel? get electricalEnergyChannel =>
      channels.whereType<ElectricalEnergyChannelDataModel>().firstOrNull;

  @override
  ElectricalPowerChannelDataModel? get electricalPowerChannel =>
      channels.whereType<ElectricalPowerChannelDataModel>().firstOrNull;

  bool get hasWindowCoveringObstruction => windowCoveringChannel.hasObstruction;

  bool get windowCoveringObstruction => windowCoveringChannel.obstruction;

  WindowCoveringStatusValue get windowCoveringStatus =>
      windowCoveringChannel.status;

  bool get isWindowCoveringOpen => windowCoveringChannel.isOpen;

  bool get isWindowCoveringClosed => windowCoveringChannel.isClosed;

  bool get isWindowCoveringOpening => windowCoveringChannel.isOpening;

  bool get isWindowCoveringClosing => windowCoveringChannel.isClosing;

  bool get isWindowCoveringStopped => windowCoveringChannel.isStopped;

  List<WindowCoveringStatusValue> get windowCoveringAvailableStatuses =>
      windowCoveringChannel.availableStatuses;

  WindowCoveringTypeValue get windowCoveringType => windowCoveringChannel.type;

  WindowCoveringPositionValue? get windowCoveringCurrentAction =>
      windowCoveringChannel.currentAction;

  bool get hasWindowCoveringPercentage => windowCoveringChannel.hasPercentage;

  int get isWindowCoveringPercentage => windowCoveringChannel.percentage;

  int get windowCoveringMinPercentage => windowCoveringChannel.minPercentage;

  int get windowCoveringMaxPercentage => windowCoveringChannel.maxPercentage;

  bool get hasWindowCoveringTilt => windowCoveringChannel.hasTilt;

  int get isWindowCoveringTilt => windowCoveringChannel.tilt;

  int get windowCoveringMinTilt => windowCoveringChannel.minTilt;

  int get windowCoveringMaxTilt => windowCoveringChannel.maxTilt;

  bool get hasWindowCoveringFault => windowCoveringChannel.hasFault;

  num? get windowCoveringFaultCode => windowCoveringChannel.faultCode;

  @override
  bool get isOn => isWindowCoveringOpen;

  factory WindowCoveringDeviceDataModel.fromJson(
    Map<String, dynamic> json,
    List<DeviceControlDataModel> controls,
    List<ChannelDataModel> channels,
  ) {
    return WindowCoveringDeviceDataModel(
      id: json['id'],
      name: json['name'],
      description: json['description'],
      icon: json['icon'] != null
          ? IconData(json['icon'], fontFamily: 'MaterialIcons')
          : null,
      controls: controls,
      channels: channels,
      createdAt:
          json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      updatedAt:
          json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
    );
  }
}
