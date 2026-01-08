import 'package:fastybird_smart_panel/modules/devices/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/speaker.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/television.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class TelevisionDeviceView extends DeviceView
    with DeviceDeviceInformationMixin, DeviceSpeakerMixin {
  TelevisionDeviceView({
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
  SpeakerChannelView get speakerChannel =>
      channels.whereType<SpeakerChannelView>().first;

  TelevisionChannelView get televisionChannel =>
      channels.whereType<TelevisionChannelView>().first;

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
}
