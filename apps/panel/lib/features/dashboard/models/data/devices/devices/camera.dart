import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/camera.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/contact.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/light.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/microphone.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/motion.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:flutter/cupertino.dart';

class CameraDeviceDataModel extends DeviceDataModel
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
  CameraDeviceDataModel({
    required super.id,
    required super.name,
    super.description,
    super.icon,
    super.controls,
    super.channels,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: DeviceCategoryType.camera,
        );

  @override
  CameraChannelDataModel get cameraChannel =>
      channels.whereType<CameraChannelDataModel>().first;

  @override
  DeviceInformationChannelDataModel get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelDataModel>().first;

  @override
  BatteryChannelDataModel? get batteryChannel =>
      channels.whereType<BatteryChannelDataModel>().firstOrNull;

  @override
  ContactChannelDataModel? get contactChannel =>
      channels.whereType<ContactChannelDataModel>().firstOrNull;

  @override
  HumidityChannelDataModel? get humidityChannel =>
      channels.whereType<HumidityChannelDataModel>().firstOrNull;

  @override
  LightChannelDataModel? get lightChannel =>
      channels.whereType<LightChannelDataModel>().firstOrNull;

  @override
  MicrophoneChannelDataModel? get microphoneChannel =>
      channels.whereType<MicrophoneChannelDataModel>().firstOrNull;

  @override
  MotionChannelDataModel? get motionChannel =>
      channels.whereType<MotionChannelDataModel>().firstOrNull;

  @override
  SpeakerChannelDataModel? get speakerChannel =>
      channels.whereType<SpeakerChannelDataModel>().firstOrNull;

  @override
  TemperatureChannelDataModel? get temperatureChannel =>
      channels.whereType<TemperatureChannelDataModel>().firstOrNull;

  factory CameraDeviceDataModel.fromJson(
    Map<String, dynamic> json,
    List<DeviceControlDataModel> controls,
    List<ChannelDataModel> channels,
  ) {
    return CameraDeviceDataModel(
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
