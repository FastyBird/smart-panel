import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/media_input.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/media_playback.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/speaker.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class SpeakerDeviceView extends DeviceView
    with
        DeviceDeviceInformationMixin,
        DeviceSpeakerMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceMediaInputMixin,
        DeviceMediaPlaybackMixin {
  SpeakerDeviceView({
    required super.deviceModel,
    required super.channels,
  });

  @override
  DeviceInformationChannelView get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelView>().first;

  @override
  SpeakerChannelView get speakerChannel =>
      channels.whereType<SpeakerChannelView>().first;

  @override
  ElectricalEnergyChannelView? get electricalEnergyChannel =>
      channels.whereType<ElectricalEnergyChannelView>().firstOrNull;

  @override
  ElectricalPowerChannelView? get electricalPowerChannel =>
      channels.whereType<ElectricalPowerChannelView>().firstOrNull;

  @override
  MediaInputChannelView? get mediaInputChannel =>
      channels.whereType<MediaInputChannelView>().firstOrNull;

  @override
  MediaPlaybackChannelView? get mediaPlaybackChannel =>
      channels.whereType<MediaPlaybackChannelView>().firstOrNull;
}
