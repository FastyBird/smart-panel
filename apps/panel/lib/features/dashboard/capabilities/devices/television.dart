import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/television.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/type.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:flutter/cupertino.dart';
import 'package:material_symbols_icons/symbols.dart';

class TelevisionDeviceType extends DeviceType
    with DeviceDeviceInformationMixin, DeviceSpeakerMixin {
  TelevisionDeviceType({
    required super.device,
    required super.capabilities,
  });

  @override
  IconData get icon => super.icon ?? Symbols.tv;

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
