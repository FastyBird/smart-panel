import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/camera.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/contact.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/doorbell.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/light.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/lock.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/microphone.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/motion.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:flutter/cupertino.dart';

class DoorbellDeviceDataModel extends DeviceDataModel
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
  DoorbellDeviceDataModel({
    required super.id,
    required super.name,
    super.description,
    super.icon,
    super.controls,
    super.channels,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: DeviceCategoryType.doorbell,
        );

  @override
  DeviceInformationChannelDataModel get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelDataModel>().first;

  DoorbellChannelDataModel get doorbellChannel =>
      channels.whereType<DoorbellChannelDataModel>().first;

  @override
  BatteryChannelDataModel? get batteryChannel =>
      channels.whereType<BatteryChannelDataModel>().firstOrNull;

  @override
  CameraChannelDataModel? get cameraChannel =>
      channels.whereType<CameraChannelDataModel>().firstOrNull;

  @override
  ContactChannelDataModel? get contactChannel =>
      channels.whereType<ContactChannelDataModel>().firstOrNull;

  @override
  LightChannelDataModel? get lightChannel =>
      channels.whereType<LightChannelDataModel>().firstOrNull;

  @override
  LockChannelDataModel? get lockChannel =>
      channels.whereType<LockChannelDataModel>().firstOrNull;

  @override
  MicrophoneChannelDataModel? get microphoneChannel =>
      channels.whereType<MicrophoneChannelDataModel>().firstOrNull;

  @override
  MotionChannelDataModel? get motionChannel =>
      channels.whereType<MotionChannelDataModel>().firstOrNull;

  @override
  SpeakerChannelDataModel? get speakerChannel =>
      channels.whereType<SpeakerChannelDataModel>().firstOrNull;

  ButtonEventValue? get doorbellEvent => doorbellChannel.event;

  List<ButtonEventValue> get doorbellAvailableEvents =>
      doorbellChannel.availableEvents;

  bool get hasDoorbellBrightness => doorbellChannel.hasBrightness;

  int get doorbellBrightness => doorbellChannel.brightness;

  int get doorbellMinBrightness => doorbellChannel.minBrightness;

  int get doorbellMaxBrightness => doorbellChannel.maxBrightness;

  bool get hasDoorTampered => doorbellChannel.hasTampered;

  bool get isDoorTampered => doorbellChannel.isTampered;

  factory DoorbellDeviceDataModel.fromJson(
    Map<String, dynamic> json,
    List<DeviceControlDataModel> controls,
    List<ChannelDataModel> channels,
  ) {
    return DoorbellDeviceDataModel(
      id: json['id'],
      name: json['name'],
      description: json['description'],
      icon: json['icon'] != null
          ? IconData(json['icon'], fontFamily: 'MaterialIcons')
          : null,
      controls: controls,
      channels: channels,
      createdAt:
          json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      updatedAt:
          json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
    );
  }
}
