import 'package:fastybird_smart_panel/modules/devices/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/battery.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/contact.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/door.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/lock.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/motion.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class DoorDeviceView extends DeviceView
    with
        DeviceDeviceInformationMixin,
        DeviceBatteryMixin,
        DeviceContactMixin,
        DeviceLockMixin,
        DeviceMotionMixin {
  DoorDeviceView({
    required super.deviceModel,
    required super.channels,
  });

  @override
  DeviceInformationChannelView get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelView>().first;

  DoorChannelView get doorChannel =>
      channels.whereType<DoorChannelView>().first;

  @override
  BatteryChannelView? get batteryChannel =>
      channels.whereType<BatteryChannelView>().firstOrNull;

  @override
  ContactChannelView? get contactChannel =>
      channels.whereType<ContactChannelView>().firstOrNull;

  @override
  LockChannelView? get lockChannel =>
      channels.whereType<LockChannelView>().firstOrNull;

  @override
  MotionChannelView? get motionChannel =>
      channels.whereType<MotionChannelView>().firstOrNull;

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
}
