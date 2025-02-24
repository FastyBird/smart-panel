import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/camera.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/contact.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/light.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/microphone.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/motion.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/type.dart';
import 'package:flutter/cupertino.dart';
import 'package:material_symbols_icons/symbols.dart';

class CameraDeviceType extends DeviceType
    with
        DeviceCameraMixin,
        DeviceDeviceInformationMixin,
        DeviceBatteryMixin,
        DeviceContactMixin,
        DeviceHumidityMixin,
        DeviceLightMixin,
        DeviceMicrophoneMixin,
        DeviceMotionMixin,
        DeviceSpeakerMixin,
        DeviceTemperatureMixin {
  CameraDeviceType({
    required super.device,
    required super.capabilities,
  });

  @override
  IconData get icon => super.icon ?? Symbols.camera_video;

  @override
  CameraChannelCapability get cameraCapability =>
      capabilities.whereType<CameraChannelCapability>().first;

  @override
  DeviceInformationChannelCapability get deviceInformationCapability =>
      capabilities.whereType<DeviceInformationChannelCapability>().first;

  @override
  BatteryChannelCapability? get batteryCapability =>
      capabilities.whereType<BatteryChannelCapability>().firstOrNull;

  @override
  ContactChannelCapability? get contactCapability =>
      capabilities.whereType<ContactChannelCapability>().firstOrNull;

  @override
  HumidityChannelCapability? get humidityCapability =>
      capabilities.whereType<HumidityChannelCapability>().firstOrNull;

  @override
  LightChannelCapability? get lightCapability =>
      capabilities.whereType<LightChannelCapability>().firstOrNull;

  @override
  MicrophoneChannelCapability? get microphoneCapability =>
      capabilities.whereType<MicrophoneChannelCapability>().firstOrNull;

  @override
  MotionChannelCapability? get motionCapability =>
      capabilities.whereType<MotionChannelCapability>().firstOrNull;

  @override
  SpeakerChannelCapability? get speakerCapability =>
      capabilities.whereType<SpeakerChannelCapability>().firstOrNull;

  @override
  TemperatureChannelCapability? get temperatureCapability =>
      capabilities.whereType<TemperatureChannelCapability>().firstOrNull;
}
