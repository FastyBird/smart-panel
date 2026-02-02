import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/media_playback.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/switcher.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class GameConsoleDeviceView extends DeviceView
    with
        DeviceDeviceInformationMixin,
        DeviceSwitcherMixin,
        DeviceMediaPlaybackMixin {
  GameConsoleDeviceView({
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
  SwitcherChannelView? get switcherChannel =>
      channels.whereType<SwitcherChannelView>().firstOrNull;

  @override
  MediaPlaybackChannelView? get mediaPlaybackChannel =>
      channels.whereType<MediaPlaybackChannelView>().firstOrNull;

  @override
  bool get isOn => hasSwitcher ? isSwitcherOn : true;
}
