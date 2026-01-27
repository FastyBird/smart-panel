import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/battery.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/camera.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/contact.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/doorbell.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/lock.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/microphone.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/motion.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/speaker.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class DoorbellDeviceView extends DeviceView
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
  DoorbellDeviceView({
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
    super.lastStateChange,
    super.isValid,
    super.validationIssues,
  });

  @override
  DeviceInformationChannelView get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelView>().first;

  DoorbellChannelView get doorbellChannel =>
      channels.whereType<DoorbellChannelView>().first;

  @override
  BatteryChannelView? get batteryChannel =>
      channels.whereType<BatteryChannelView>().firstOrNull;

  @override
  CameraChannelView? get cameraChannel =>
      channels.whereType<CameraChannelView>().firstOrNull;

  @override
  ContactChannelView? get contactChannel =>
      channels.whereType<ContactChannelView>().firstOrNull;

  @override
  LightChannelView? get lightChannel =>
      channels.whereType<LightChannelView>().firstOrNull;

  @override
  LockChannelView? get lockChannel =>
      channels.whereType<LockChannelView>().firstOrNull;

  @override
  MicrophoneChannelView? get microphoneChannel =>
      channels.whereType<MicrophoneChannelView>().firstOrNull;

  @override
  MotionChannelView? get motionChannel =>
      channels.whereType<MotionChannelView>().firstOrNull;

  @override
  SpeakerChannelView? get speakerChannel =>
      channels.whereType<SpeakerChannelView>().firstOrNull;

  DoorbellEventValue? get doorbellEvent => doorbellChannel.event;

  List<DoorbellEventValue> get doorbellAvailableEvents =>
      doorbellChannel.availableEvents;

  bool get hasDoorbellBrightness => doorbellChannel.hasBrightness;

  int get doorbellBrightness => doorbellChannel.brightness;

  int get doorbellMinBrightness => doorbellChannel.minBrightness;

  int get doorbellMaxBrightness => doorbellChannel.maxBrightness;

  bool get hasDoorTampered => doorbellChannel.hasTampered;

  bool get isDoorTampered => doorbellChannel.isTampered;
}
