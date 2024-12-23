import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/television.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:flutter/cupertino.dart';

class TelevisionDeviceDataModel extends DeviceDataModel
    with DeviceDeviceInformationMixin, DeviceSpeakerMixin {
  TelevisionDeviceDataModel({
    required super.id,
    required super.name,
    super.description,
    super.icon,
    super.controls,
    super.channels,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: DeviceCategoryType.television,
        );

  @override
  DeviceInformationChannelDataModel get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelDataModel>().first;

  @override
  SpeakerChannelDataModel get speakerChannel =>
      channels.whereType<SpeakerChannelDataModel>().first;

  TelevisionChannelDataModel get televisionChannel =>
      channels.whereType<TelevisionChannelDataModel>().first;

  bool get isTelevisionOn => televisionChannel.on;

  int get televisionBrightness => televisionChannel.brightness;

  int get televisionMinBrightness => televisionChannel.minBrightness;

  int get televisionMaxBrightness => televisionChannel.maxBrightness;

  TelevisionInputSourceValue? get televisionInputSource =>
      televisionChannel.inputSource;

  List<TelevisionInputSourceValue> get televisionAvailableInputSources =>
      televisionChannel.availableInputSources;

  bool get hasTelevisionRemoteKey => televisionChannel.hasRemoteKey;

  TelevisionRemoteKeyValue? get televisionRemoteKey =>
      televisionChannel.remoteKey;

  List<TelevisionRemoteKeyValue> get televisionAvailableRemoteKeys =>
      televisionChannel.availableRemoteKeys;

  @override
  bool get isOn => televisionChannel.on;

  factory TelevisionDeviceDataModel.fromJson(
    Map<String, dynamic> json,
    List<DeviceControlDataModel> controls,
    List<ChannelDataModel> channels,
  ) {
    return TelevisionDeviceDataModel(
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
