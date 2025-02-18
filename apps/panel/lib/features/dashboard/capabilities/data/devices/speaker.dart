import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/media_input.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/media_playback.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/speaker.dart';

class SpeakerDeviceCapability extends DeviceCapability<SpeakerDeviceDataModel>
    with
        DeviceDeviceInformationMixin,
        DeviceSpeakerMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceMediaInputMixin,
        DeviceMediaPlaybackMixin {
  SpeakerDeviceCapability({
    required super.device,
    required super.capabilities,
  });

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
