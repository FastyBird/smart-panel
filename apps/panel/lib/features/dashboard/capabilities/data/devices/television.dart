import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/television.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/television.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';

class TelevisionDeviceCapability
    extends DeviceCapability<TelevisionDeviceDataModel>
    with DeviceDeviceInformationMixin, DeviceSpeakerMixin {
  TelevisionDeviceCapability({
    required super.device,
    required super.capabilities,
  });

  @override
  DeviceInformationChannelCapability get deviceInformationCapability =>
      capabilities.whereType<DeviceInformationChannelCapability>().first;

  @override
  SpeakerChannelCapability get speakerCapability =>
      capabilities.whereType<SpeakerChannelCapability>().first;

  TelevisionChannelCapability get televisionCapability =>
      capabilities.whereType<TelevisionChannelCapability>().first;

  bool get isTelevisionOn => televisionCapability.on;

  int get televisionBrightness => televisionCapability.brightness;

  int get televisionMinBrightness => televisionCapability.minBrightness;

  int get televisionMaxBrightness => televisionCapability.maxBrightness;

  TelevisionInputSourceValue? get televisionInputSource =>
      televisionCapability.inputSource;

  List<TelevisionInputSourceValue> get televisionAvailableInputSources =>
      televisionCapability.availableInputSources;

  bool get hasTelevisionRemoteKey => televisionCapability.hasRemoteKey;

  TelevisionRemoteKeyValue? get televisionRemoteKey =>
      televisionCapability.remoteKey;

  List<TelevisionRemoteKeyValue> get televisionAvailableRemoteKeys =>
      televisionCapability.availableRemoteKeys;

  @override
  bool get isOn => televisionCapability.on;
}
