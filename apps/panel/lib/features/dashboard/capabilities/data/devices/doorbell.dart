import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/camera.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/contact.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/doorbell.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/light.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/lock.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/microphone.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/motion.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/doorbell.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';

class DoorbellDeviceCapability extends DeviceCapability<DoorbellDeviceDataModel>
    with
        DeviceDeviceInformationMixin,
        DeviceBatteryMixin,
        DeviceCameraMixin,
        DeviceContactMixin,
        DeviceLightMixin,
        DeviceLockMixin,
        DeviceMicrophoneMixin,
        DeviceMotionMixin,
        DeviceSpeakerMixin {
  DoorbellDeviceCapability({
    required super.device,
    required super.capabilities,
  });

  @override
  DeviceInformationChannelCapability get deviceInformationCapability =>
      capabilities.whereType<DeviceInformationChannelCapability>().first;

  DoorbellChannelCapability get doorbellCapability =>
      capabilities.whereType<DoorbellChannelCapability>().first;

  @override
  BatteryChannelCapability? get batteryCapability =>
      capabilities.whereType<BatteryChannelCapability>().firstOrNull;

  @override
  CameraChannelCapability? get cameraCapability =>
      capabilities.whereType<CameraChannelCapability>().firstOrNull;

  @override
  ContactChannelCapability? get contactCapability =>
      capabilities.whereType<ContactChannelCapability>().firstOrNull;

  @override
  LightChannelCapability? get lightCapability =>
      capabilities.whereType<LightChannelCapability>().firstOrNull;

  @override
  LockChannelCapability? get lockCapability =>
      capabilities.whereType<LockChannelCapability>().firstOrNull;

  @override
  MicrophoneChannelCapability? get microphoneCapability =>
      capabilities.whereType<MicrophoneChannelCapability>().firstOrNull;

  @override
  MotionChannelCapability? get motionCapability =>
      capabilities.whereType<MotionChannelCapability>().firstOrNull;

  @override
  SpeakerChannelCapability? get speakerCapability =>
      capabilities.whereType<SpeakerChannelCapability>().firstOrNull;

  ButtonEventValue? get doorbellEvent => doorbellCapability.event;

  List<ButtonEventValue> get doorbellAvailableEvents =>
      doorbellCapability.availableEvents;

  bool get hasDoorbellBrightness => doorbellCapability.hasBrightness;

  int get doorbellBrightness => doorbellCapability.brightness;

  int get doorbellMinBrightness => doorbellCapability.minBrightness;

  int get doorbellMaxBrightness => doorbellCapability.maxBrightness;

  bool get hasDoorTampered => doorbellCapability.hasTampered;

  bool get isDoorTampered => doorbellCapability.isTampered;
}
