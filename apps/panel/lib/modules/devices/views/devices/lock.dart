import 'package:fastybird_smart_panel/modules/devices/views/channels/battery.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/contact.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/lock.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/motion.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class LockDeviceView extends DeviceView
    with
        DeviceDeviceInformationMixin,
        DeviceLockMixin,
        DeviceBatteryMixin,
        DeviceContactMixin,
        DeviceMotionMixin {
  LockDeviceView({
    required super.id,
    required super.type,
    super.category,
    required super.name,
    super.description,
    super.icon,
    super.roomId,
    super.zoneIds,
    required super.channels,
    super.isValid,
    super.validationIssues,
  });

  @override
  DeviceInformationChannelView get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelView>().first;

  @override
  LockChannelView get lockChannel =>
      channels.whereType<LockChannelView>().first;

  @override
  BatteryChannelView? get batteryChannel =>
      channels.whereType<BatteryChannelView>().firstOrNull;

  @override
  ContactChannelView? get contactChannel =>
      channels.whereType<ContactChannelView>().firstOrNull;

  @override
  MotionChannelView? get motionChannel =>
      channels.whereType<MotionChannelView>().firstOrNull;
}
