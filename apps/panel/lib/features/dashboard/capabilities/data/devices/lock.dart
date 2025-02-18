import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/contact.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/lock.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/motion.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/lock.dart';

class LockDeviceCapability extends DeviceCapability<LockDeviceDataModel>
    with
        DeviceDeviceInformationMixin,
        DeviceLockMixin,
        DeviceBatteryMixin,
        DeviceContactMixin,
        DeviceMotionMixin {
  LockDeviceCapability({
    required super.device,
    required super.capabilities,
  });

  @override
  DeviceInformationChannelCapability get deviceInformationCapability =>
      capabilities.whereType<DeviceInformationChannelCapability>().first;

  @override
  LockChannelCapability get lockCapability =>
      capabilities.whereType<LockChannelCapability>().first;

  @override
  BatteryChannelCapability? get batteryCapability =>
      capabilities.whereType<BatteryChannelCapability>().firstOrNull;

  @override
  ContactChannelCapability? get contactCapability =>
      capabilities.whereType<ContactChannelCapability>().firstOrNull;

  @override
  MotionChannelCapability? get motionCapability =>
      capabilities.whereType<MotionChannelCapability>().firstOrNull;
}
