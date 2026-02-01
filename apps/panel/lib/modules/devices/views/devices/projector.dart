import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/projector.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/speaker.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class ProjectorDeviceView extends DeviceView
    with DeviceDeviceInformationMixin, DeviceSpeakerMixin {
  ProjectorDeviceView({
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

  @override
  SpeakerChannelView? get speakerChannel =>
      channels.whereType<SpeakerChannelView>().firstOrNull;

  ProjectorChannelView get projectorChannel =>
      channels.whereType<ProjectorChannelView>().first;

  bool get isProjectorOn => projectorChannel.on;

  int get projectorBrightness => projectorChannel.brightness;

  int get projectorMinBrightness => projectorChannel.minBrightness;

  int get projectorMaxBrightness => projectorChannel.maxBrightness;

  bool get hasProjectorRemoteKey => projectorChannel.hasRemoteKey;

  ProjectorRemoteKeyValue? get projectorRemoteKey =>
      projectorChannel.remoteKey;

  List<ProjectorRemoteKeyValue> get projectorAvailableRemoteKeys =>
      projectorChannel.availableRemoteKeys;

  @override
  bool get isOn => projectorChannel.on;
}
