import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/contact.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/lock.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/motion.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:flutter/cupertino.dart';

class LockDeviceDataModel extends DeviceDataModel
    with
        DeviceDeviceInformationMixin,
        DeviceLockMixin,
        DeviceBatteryMixin,
        DeviceContactMixin,
        DeviceMotionMixin {
  LockDeviceDataModel({
    required super.id,
    required super.name,
    super.description,
    super.icon,
    super.controls,
    super.channels,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: DeviceCategoryType.lock,
        );

  @override
  DeviceInformationChannelDataModel get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelDataModel>().first;

  @override
  LockChannelDataModel get lockChannel =>
      channels.whereType<LockChannelDataModel>().first;

  @override
  BatteryChannelDataModel? get batteryChannel =>
      channels.whereType<BatteryChannelDataModel>().firstOrNull;

  @override
  ContactChannelDataModel? get contactChannel =>
      channels.whereType<ContactChannelDataModel>().firstOrNull;

  @override
  MotionChannelDataModel? get motionChannel =>
      channels.whereType<MotionChannelDataModel>().firstOrNull;

  factory LockDeviceDataModel.fromJson(
    Map<String, dynamic> json,
    List<DeviceControlDataModel> controls,
    List<ChannelDataModel> channels,
  ) {
    return LockDeviceDataModel(
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
