import 'package:fastybird_smart_panel/modules/devices/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/battery.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/window_covering.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class WindowCoveringDeviceView extends DeviceView
    with
        DeviceDeviceInformationMixin,
        DeviceBatteryMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin {
  WindowCoveringDeviceView({
    required super.deviceModel,
    required super.channels,
  });

  @override
  DeviceInformationChannelView get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelView>().first;

  WindowCoveringChannelView get windowCoveringChannel =>
      channels.whereType<WindowCoveringChannelView>().first;

  @override
  BatteryChannelView? get batteryChannel =>
      channels.whereType<BatteryChannelView>().firstOrNull;

  @override
  ElectricalEnergyChannelView? get electricalEnergyChannel =>
      channels.whereType<ElectricalEnergyChannelView>().firstOrNull;

  @override
  ElectricalPowerChannelView? get electricalPowerChannel =>
      channels.whereType<ElectricalPowerChannelView>().firstOrNull;

  bool get hasWindowCoveringObstruction => windowCoveringChannel.hasObstruction;

  bool get windowCoveringObstruction => windowCoveringChannel.obstruction;

  WindowCoveringStatusValue get windowCoveringStatus =>
      windowCoveringChannel.status;

  bool get isWindowCoveringOpen => windowCoveringChannel.isOpen;

  bool get isWindowCoveringClosed => windowCoveringChannel.isClosed;

  bool get isWindowCoveringOpening => windowCoveringChannel.isOpening;

  bool get isWindowCoveringClosing => windowCoveringChannel.isClosing;

  bool get isWindowCoveringStopped => windowCoveringChannel.isStopped;

  List<WindowCoveringStatusValue> get windowCoveringAvailableStatuses =>
      windowCoveringChannel.availableStatuses;

  WindowCoveringTypeValue get windowCoveringType => windowCoveringChannel.type;

  bool get hasWindowCoveringPercentage => windowCoveringChannel.hasPosition;

  int get isWindowCoveringPercentage => windowCoveringChannel.position;

  int get windowCoveringMinPercentage => windowCoveringChannel.minPosition;

  int get windowCoveringMaxPercentage => windowCoveringChannel.maxPosition;

  bool get hasWindowCoveringTilt => windowCoveringChannel.hasTilt;

  int get isWindowCoveringTilt => windowCoveringChannel.tilt;

  int get windowCoveringMinTilt => windowCoveringChannel.minTilt;

  int get windowCoveringMaxTilt => windowCoveringChannel.maxTilt;

  bool get hasWindowCoveringFault => windowCoveringChannel.hasFault;

  num? get windowCoveringFaultCode => windowCoveringChannel.faultCode;

  @override
  bool get isOn => isWindowCoveringOpen;
}
