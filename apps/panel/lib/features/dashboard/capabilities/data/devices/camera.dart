import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/camera.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/contact.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/light.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/microphone.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/motion.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/camera.dart';

class CameraDeviceCapability extends DeviceCapability<CameraDeviceDataModel>
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
  CameraDeviceCapability({
    required super.device,
    required super.capabilities,
  });

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
