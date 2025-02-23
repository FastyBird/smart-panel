import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/media_input.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/media_playback.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/type.dart';
import 'package:flutter/cupertino.dart';
import 'package:material_symbols_icons/symbols.dart';

class SpeakerDeviceType extends DeviceType
    with
        DeviceDeviceInformationMixin,
        DeviceSpeakerMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceMediaInputMixin,
        DeviceMediaPlaybackMixin {
  SpeakerDeviceType({
    required super.device,
    required super.capabilities,
  });

  @override
  IconData get icon => super.icon ?? Symbols.speaker;

  @override
  DeviceInformationChannelCapability get deviceInformationCapability =>
      capabilities.whereType<DeviceInformationChannelCapability>().first;

  @override
  SpeakerChannelCapability get speakerCapability =>
      capabilities.whereType<SpeakerChannelCapability>().first;

  @override
  ElectricalEnergyChannelCapability? get electricalEnergyCapability =>
      capabilities.whereType<ElectricalEnergyChannelCapability>().firstOrNull;

  @override
  ElectricalPowerChannelCapability? get electricalPowerCapability =>
      capabilities.whereType<ElectricalPowerChannelCapability>().firstOrNull;

  @override
  MediaInputChannelCapability? get mediaInputCapability =>
      capabilities.whereType<MediaInputChannelCapability>().firstOrNull;

  @override
  MediaPlaybackChannelCapability? get mediaPlaybackCapability =>
      capabilities.whereType<MediaPlaybackChannelCapability>().firstOrNull;
}
