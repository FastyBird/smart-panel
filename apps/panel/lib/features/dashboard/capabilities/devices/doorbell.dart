import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/camera.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/contact.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/doorbell.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/light.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/lock.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/microphone.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/motion.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/type.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:flutter/cupertino.dart';
import 'package:material_symbols_icons/symbols.dart';

class DoorbellDeviceType extends DeviceType
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
  DoorbellDeviceType({
    required super.device,
    required super.capabilities,
  });

  @override
  IconData get icon => super.icon ?? Symbols.doorbell_3p;

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
