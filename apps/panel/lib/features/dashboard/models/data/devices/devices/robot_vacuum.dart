import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/leak.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/robot_vacuum.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:flutter/cupertino.dart';

class RobotVacuumDeviceDataModel extends DeviceDataModel
    with
        DeviceBatteryMixin,
        DeviceDeviceInformationMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceLeakMixin {
  RobotVacuumDeviceDataModel({
    required super.id,
    required super.name,
    super.description,
    super.icon,
    super.controls,
    super.channels,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: DeviceCategoryType.robotVacuum,
        );

  @override
  BatteryChannelDataModel get batteryChannel =>
      channels.whereType<BatteryChannelDataModel>().first;

  @override
  DeviceInformationChannelDataModel get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelDataModel>().first;

  RobotVacuumChannelDataModel get robotVacuumChannel =>
      channels.whereType<RobotVacuumChannelDataModel>().first;

  @override
  ElectricalEnergyChannelDataModel? get electricalEnergyChannel =>
      channels.whereType<ElectricalEnergyChannelDataModel>().firstOrNull;

  @override
  ElectricalPowerChannelDataModel? get electricalPowerChannel =>
      channels.whereType<ElectricalPowerChannelDataModel>().firstOrNull;

  @override
  LeakChannelDataModel? get leakChannel =>
      channels.whereType<LeakChannelDataModel>().firstOrNull;

  bool get isRobotVacuumOn => robotVacuumChannel.on;

  RobotVacuumStatusValue get robotVacuumStatus => robotVacuumChannel.status;

  List<RobotVacuumStatusValue> get robotVacuumAvailableStatuses =>
      robotVacuumChannel.availableStatuses;

  bool get hasRobotVacuumMode => robotVacuumChannel.hasMode;

  RobotVacuumModeValue? get robotVacuumMode => robotVacuumChannel.mode;

  bool get hasRobotVacuumFault => robotVacuumChannel.hasFault;

  num? get robotVacuumFaultCode => robotVacuumChannel.faultCode;

  List<RobotVacuumModeValue> get robotVacuumAvailableModes =>
      robotVacuumChannel.availableModes;

  @override
  bool get isOn => isRobotVacuumOn;

  factory RobotVacuumDeviceDataModel.fromJson(
    Map<String, dynamic> json,
    List<DeviceControlDataModel> controls,
    List<ChannelDataModel> channels,
  ) {
    return RobotVacuumDeviceDataModel(
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
