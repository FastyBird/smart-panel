import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/window_covering.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/type.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:flutter/cupertino.dart';
import 'package:material_symbols_icons/symbols.dart';

class WindowCoveringDeviceType extends DeviceType
    with
        DeviceDeviceInformationMixin,
        DeviceBatteryMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin {
  WindowCoveringDeviceType({
    required super.device,
    required super.capabilities,
  });

  @override
  IconData get icon => super.icon ?? Symbols.roller_shades;

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
