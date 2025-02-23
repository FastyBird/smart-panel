import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/media_input.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/media_playback.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/microphone.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/type.dart';
import 'package:flutter/cupertino.dart';
import 'package:material_symbols_icons/symbols.dart';

class MediaDeviceType extends DeviceType
    with
        DeviceDeviceInformationMixin,
        DeviceMediaInputMixin,
        DeviceMediaPlaybackMixin,
        DeviceMicrophoneMixin,
        DeviceSpeakerMixin {
  MediaDeviceType({
    required super.device,
    required super.capabilities,
  });

  @override
  IconData get icon => super.icon ?? Symbols.media_output;

  @override
  DeviceInformationChannelCapability get deviceInformationCapability =>
      capabilities.whereType<DeviceInformationChannelCapability>().first;

  @override
  MediaInputChannelCapability get mediaInputCapability =>
      capabilities.whereType<MediaInputChannelCapability>().first;

  @override
  MediaPlaybackChannelCapability get mediaPlaybackCapability =>
      capabilities.whereType<MediaPlaybackChannelCapability>().first;

  @override
  MicrophoneChannelCapability? get microphoneCapability =>
      capabilities.whereType<MicrophoneChannelCapability>().firstOrNull;

  @override
  SpeakerChannelCapability? get speakerCapability =>
      capabilities.whereType<SpeakerChannelCapability>().firstOrNull;
}
