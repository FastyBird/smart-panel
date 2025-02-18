import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/media_input.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/media_playback.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/microphone.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/media.dart';

class MediaDeviceCapability extends DeviceCapability<MediaDeviceDataModel>
    with
        DeviceDeviceInformationMixin,
        DeviceMediaInputMixin,
        DeviceMediaPlaybackMixin,
        DeviceMicrophoneMixin,
        DeviceSpeakerMixin {
  MediaDeviceCapability({
    required super.device,
    required super.capabilities,
  });

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
