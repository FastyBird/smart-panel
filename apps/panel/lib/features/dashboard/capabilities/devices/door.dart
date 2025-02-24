import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/contact.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/door.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/lock.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/motion.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/type.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:flutter/cupertino.dart';
import 'package:material_symbols_icons/symbols.dart';

class DoorDeviceType extends DeviceType
    with
        DeviceDeviceInformationMixin,
        DeviceBatteryMixin,
        DeviceContactMixin,
        DeviceLockMixin,
        DeviceMotionMixin {
  DoorDeviceType({
    required super.device,
    required super.capabilities,
  });

  @override
  IconData get icon => super.icon ?? Symbols.door_front;

  @override
  DeviceInformationChannelCapability get deviceInformationCapability =>
      capabilities.whereType<DeviceInformationChannelCapability>().first;

  DoorChannelCapability get doorCapability =>
      capabilities.whereType<DoorChannelCapability>().first;

  @override
  BatteryChannelCapability? get batteryCapability =>
      capabilities.whereType<BatteryChannelCapability>().firstOrNull;

  @override
  ContactChannelCapability? get contactCapability =>
      capabilities.whereType<ContactChannelCapability>().firstOrNull;

  @override
  LockChannelCapability? get lockCapability =>
      capabilities.whereType<LockChannelCapability>().firstOrNull;

  @override
  MotionChannelCapability? get motionCapability =>
      capabilities.whereType<MotionChannelCapability>().firstOrNull;

  bool get hasDoorObstruction => doorCapability.hasObstruction;

  bool get doorObstruction => doorCapability.obstruction;

  DoorStatusValue get doorStatus => doorCapability.status;

  bool get isDoorOpen => doorCapability.isOpen;

  bool get isDoorClosed => doorCapability.isClosed;

  bool get isDoorOpening => doorCapability.isOpening;

  bool get isDoorClosing => doorCapability.isClosing;

  bool get isDoorStopped => doorCapability.isStopped;

  List<DoorStatusValue> get doorAvailableStatuses =>
      doorCapability.availableStatuses;

  DoorTypeValue get doorType => doorCapability.type;

  DoorPositionValue? get doorCurrentAction => doorCapability.currentAction;

  bool get hasDoorPercentage => doorCapability.hasPercentage;

  int get isDoorPercentage => doorCapability.percentage;

  int get doorMinPercentage => doorCapability.minPercentage;

  int get doorMaxPercentage => doorCapability.maxPercentage;

  bool get hasDoorFault => doorCapability.hasFault;

  num? get doorFaultCode => doorCapability.faultCode;

  @override
  bool get isOn => isDoorOpen;
}
