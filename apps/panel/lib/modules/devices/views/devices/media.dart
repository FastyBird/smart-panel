import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/media_input.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/media_playback.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/microphone.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/speaker.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class MediaDeviceView extends DeviceView
    with
        DeviceDeviceInformationMixin,
        DeviceMediaInputMixin,
        DeviceMediaPlaybackMixin,
        DeviceMicrophoneMixin,
        DeviceSpeakerMixin {
  MediaDeviceView({
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
  DeviceInformationChannelView get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelView>().first;

  @override
  MediaInputChannelView? get mediaInputChannel =>
      channels.whereType<MediaInputChannelView>().firstOrNull;

  @override
  MediaPlaybackChannelView get mediaPlaybackChannel =>
      channels.whereType<MediaPlaybackChannelView>().first;

  @override
  MicrophoneChannelView? get microphoneChannel =>
      channels.whereType<MicrophoneChannelView>().firstOrNull;

  @override
  SpeakerChannelView? get speakerChannel =>
      channels.whereType<SpeakerChannelView>().firstOrNull;
}
