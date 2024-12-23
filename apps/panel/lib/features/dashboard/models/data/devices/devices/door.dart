import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/contact.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/door.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/lock.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/motion.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:flutter/cupertino.dart';

class DoorDeviceDataModel extends DeviceDataModel
    with
        DeviceDeviceInformationMixin,
        DeviceBatteryMixin,
        DeviceContactMixin,
        DeviceLockMixin,
        DeviceMotionMixin {
  DoorDeviceDataModel({
    required super.id,
    required super.name,
    super.description,
    super.icon,
    super.controls,
    super.channels,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: DeviceCategoryType.door,
        );

  @override
  DeviceInformationChannelDataModel get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelDataModel>().first;

  DoorChannelDataModel get doorChannel =>
      channels.whereType<DoorChannelDataModel>().first;

  @override
  BatteryChannelDataModel? get batteryChannel =>
      channels.whereType<BatteryChannelDataModel>().firstOrNull;

  @override
  ContactChannelDataModel? get contactChannel =>
      channels.whereType<ContactChannelDataModel>().firstOrNull;

  @override
  LockChannelDataModel? get lockChannel =>
      channels.whereType<LockChannelDataModel>().firstOrNull;

  @override
  MotionChannelDataModel? get motionChannel =>
      channels.whereType<MotionChannelDataModel>().firstOrNull;

  bool get hasDoorObstruction => doorChannel.hasObstruction;

  bool get doorObstruction => doorChannel.obstruction;

  DoorStatusValue get doorStatus => doorChannel.status;

  bool get isDoorOpen => doorChannel.isOpen;

  bool get isDoorClosed => doorChannel.isClosed;

  bool get isDoorOpening => doorChannel.isOpening;

  bool get isDoorClosing => doorChannel.isClosing;

  bool get isDoorStopped => doorChannel.isStopped;

  List<DoorStatusValue> get doorAvailableStatuses =>
      doorChannel.availableStatuses;

  DoorTypeValue get doorType => doorChannel.type;

  DoorPositionValue? get doorCurrentAction => doorChannel.currentAction;

  bool get hasDoorPercentage => doorChannel.hasPercentage;

  int get isDoorPercentage => doorChannel.percentage;

  int get doorMinPercentage => doorChannel.minPercentage;

  int get doorMaxPercentage => doorChannel.maxPercentage;

  bool get hasDoorFault => doorChannel.hasFault;

  num? get doorFaultCode => doorChannel.faultCode;

  @override
  bool get isOn => isDoorOpen;

  factory DoorDeviceDataModel.fromJson(
    Map<String, dynamic> json,
    List<DeviceControlDataModel> controls,
    List<ChannelDataModel> channels,
  ) {
    return DoorDeviceDataModel(
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
