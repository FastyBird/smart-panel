import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/window_covering.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/window_covering.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';

class WindowCoveringDeviceCapability
    extends DeviceCapability<WindowCoveringDeviceDataModel>
    with
        DeviceDeviceInformationMixin,
        DeviceBatteryMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin {
  WindowCoveringDeviceCapability({
    required super.device,
    required super.capabilities,
  });

  @override
  DeviceInformationChannelCapability get deviceInformationCapability =>
      capabilities.whereType<DeviceInformationChannelCapability>().first;

  WindowCoveringChannelCapability get windowCoveringCapability =>
      capabilities.whereType<WindowCoveringChannelCapability>().first;

  @override
  BatteryChannelCapability? get batteryCapability =>
      capabilities.whereType<BatteryChannelCapability>().firstOrNull;

  @override
  ElectricalEnergyChannelCapability? get electricalEnergyCapability =>
      capabilities.whereType<ElectricalEnergyChannelCapability>().firstOrNull;

  @override
  ElectricalPowerChannelCapability? get electricalPowerCapability =>
      capabilities.whereType<ElectricalPowerChannelCapability>().firstOrNull;

  bool get hasWindowCoveringObstruction =>
      windowCoveringCapability.hasObstruction;

  bool get windowCoveringObstruction => windowCoveringCapability.obstruction;

  WindowCoveringStatusValue get windowCoveringStatus =>
      windowCoveringCapability.status;

  bool get isWindowCoveringOpen => windowCoveringCapability.isOpen;

  bool get isWindowCoveringClosed => windowCoveringCapability.isClosed;

  bool get isWindowCoveringOpening => windowCoveringCapability.isOpening;

  bool get isWindowCoveringClosing => windowCoveringCapability.isClosing;

  bool get isWindowCoveringStopped => windowCoveringCapability.isStopped;

  List<WindowCoveringStatusValue> get windowCoveringAvailableStatuses =>
      windowCoveringCapability.availableStatuses;

  WindowCoveringTypeValue get windowCoveringType =>
      windowCoveringCapability.type;

  WindowCoveringPositionValue? get windowCoveringCurrentAction =>
      windowCoveringCapability.currentAction;

  bool get hasWindowCoveringPercentage =>
      windowCoveringCapability.hasPercentage;

  int get isWindowCoveringPercentage => windowCoveringCapability.percentage;

  int get windowCoveringMinPercentage => windowCoveringCapability.minPercentage;

  int get windowCoveringMaxPercentage => windowCoveringCapability.maxPercentage;

  bool get hasWindowCoveringTilt => windowCoveringCapability.hasTilt;

  int get isWindowCoveringTilt => windowCoveringCapability.tilt;

  int get windowCoveringMinTilt => windowCoveringCapability.minTilt;

  int get windowCoveringMaxTilt => windowCoveringCapability.maxTilt;

  bool get hasWindowCoveringFault => windowCoveringCapability.hasFault;

  num? get windowCoveringFaultCode => windowCoveringCapability.faultCode;

  @override
  bool get isOn => isWindowCoveringOpen;
}
