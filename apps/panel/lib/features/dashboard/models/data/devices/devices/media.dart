import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/media_input.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/media_playback.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/microphone.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:flutter/cupertino.dart';

class MediaDeviceDataModel extends DeviceDataModel
    with
        DeviceDeviceInformationMixin,
        DeviceMediaInputMixin,
        DeviceMediaPlaybackMixin,
        DeviceMicrophoneMixin,
        DeviceSpeakerMixin {
  MediaDeviceDataModel({
    required super.id,
    required super.name,
    super.description,
    super.icon,
    super.controls,
    super.channels,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: DeviceCategoryType.media,
        );

  @override
  DeviceInformationChannelDataModel get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelDataModel>().first;

  @override
  MediaInputChannelDataModel get mediaInputChannel =>
      channels.whereType<MediaInputChannelDataModel>().first;

  @override
  MediaPlaybackChannelDataModel get mediaPlaybackChannel =>
      channels.whereType<MediaPlaybackChannelDataModel>().first;

  @override
  MicrophoneChannelDataModel? get microphoneChannel =>
      channels.whereType<MicrophoneChannelDataModel>().firstOrNull;

  @override
  SpeakerChannelDataModel? get speakerChannel =>
      channels.whereType<SpeakerChannelDataModel>().firstOrNull;

  factory MediaDeviceDataModel.fromJson(
    Map<String, dynamic> json,
    List<DeviceControlDataModel> controls,
    List<ChannelDataModel> channels,
  ) {
    return MediaDeviceDataModel(
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
