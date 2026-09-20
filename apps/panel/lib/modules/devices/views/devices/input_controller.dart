import 'package:fastybird_smart_panel/modules/devices/views/channels/analog_input.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/battery.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/binary_input.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/button.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class InputControllerDeviceView extends DeviceView
    with
        DeviceDeviceInformationMixin,
        DeviceBatteryMixin,
        DeviceButtonMixin,
        DeviceBinaryInputMixin,
        DeviceAnalogInputMixin {
  InputControllerDeviceView({
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
  BatteryChannelView? get batteryChannel =>
      channels.whereType<BatteryChannelView>().firstOrNull;

  @override
  ButtonChannelView? get buttonChannel =>
      channels.whereType<ButtonChannelView>().firstOrNull;

  @override
  BinaryInputChannelView? get binaryInputChannel =>
      channels.whereType<BinaryInputChannelView>().firstOrNull;

  @override
  AnalogInputChannelView? get analogInputChannel =>
      channels.whereType<AnalogInputChannelView>().firstOrNull;

  List<ButtonChannelView> get buttonChannels =>
      channels.whereType<ButtonChannelView>().toList();

  List<BinaryInputChannelView> get binaryInputChannels =>
      channels.whereType<BinaryInputChannelView>().toList();

  List<AnalogInputChannelView> get analogInputChannels =>
      channels.whereType<AnalogInputChannelView>().toList();
}
