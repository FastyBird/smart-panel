import 'package:fastybird_smart_panel/modules/devices/views/channels/battery.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/camera.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/contact.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/microphone.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/motion.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/speaker.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class CameraDeviceView extends DeviceView
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
  CameraDeviceView({
    required super.id,
    required super.type,
    super.category,
    required super.name,
    super.description,
    super.icon,
    super.roomId,
    super.zoneIds,
    required super.channels,
    super.enabled,
    super.isOnline,
    super.isValid,
    super.validationIssues,
  });

  @override
  CameraChannelView get cameraChannel =>
      channels.whereType<CameraChannelView>().first;

  @override
  DeviceInformationChannelView get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelView>().first;

  @override
  BatteryChannelView? get batteryChannel =>
      channels.whereType<BatteryChannelView>().firstOrNull;

  @override
  ContactChannelView? get contactChannel =>
      channels.whereType<ContactChannelView>().firstOrNull;

  @override
  HumidityChannelView? get humidityChannel =>
      channels.whereType<HumidityChannelView>().firstOrNull;

  @override
  LightChannelView? get lightChannel =>
      channels.whereType<LightChannelView>().firstOrNull;

  @override
  MicrophoneChannelView? get microphoneChannel =>
      channels.whereType<MicrophoneChannelView>().firstOrNull;

  @override
  MotionChannelView? get motionChannel =>
      channels.whereType<MotionChannelView>().firstOrNull;

  @override
  SpeakerChannelView? get speakerChannel =>
      channels.whereType<SpeakerChannelView>().firstOrNull;

  @override
  TemperatureChannelView? get temperatureChannel =>
      channels.whereType<TemperatureChannelView>().firstOrNull;
}
