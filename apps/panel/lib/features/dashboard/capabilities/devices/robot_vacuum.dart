import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/leak.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/robot_vacuum.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/type.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:flutter/cupertino.dart';
import 'package:material_symbols_icons/symbols.dart';

class RobotVacuumDeviceType extends DeviceType
    with
        DeviceBatteryMixin,
        DeviceDeviceInformationMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceLeakMixin {
  RobotVacuumDeviceType({
    required super.device,
    required super.capabilities,
  });

  @override
  IconData get icon => super.icon ?? Symbols.vacuum;

  @override
  BatteryChannelCapability get batteryCapability =>
      capabilities.whereType<BatteryChannelCapability>().first;

  @override
  DeviceInformationChannelCapability get deviceInformationCapability =>
      capabilities.whereType<DeviceInformationChannelCapability>().first;

  RobotVacuumChannelCapability get robotVacuumCapability =>
      capabilities.whereType<RobotVacuumChannelCapability>().first;

  @override
  ElectricalEnergyChannelCapability? get electricalEnergyCapability =>
      capabilities.whereType<ElectricalEnergyChannelCapability>().firstOrNull;

  @override
  ElectricalPowerChannelCapability? get electricalPowerCapability =>
      capabilities.whereType<ElectricalPowerChannelCapability>().firstOrNull;

  @override
  LeakChannelCapability? get leakCapability =>
      capabilities.whereType<LeakChannelCapability>().firstOrNull;

  bool get isRobotVacuumOn => robotVacuumCapability.on;

  RobotVacuumStatusValue get robotVacuumStatus => robotVacuumCapability.status;

  List<RobotVacuumStatusValue> get robotVacuumAvailableStatuses =>
      robotVacuumCapability.availableStatuses;

  bool get hasRobotVacuumMode => robotVacuumCapability.hasMode;

  RobotVacuumModeValue? get robotVacuumMode => robotVacuumCapability.mode;

  bool get hasRobotVacuumFault => robotVacuumCapability.hasFault;

  num? get robotVacuumFaultCode => robotVacuumCapability.faultCode;

  List<RobotVacuumModeValue> get robotVacuumAvailableModes =>
      robotVacuumCapability.availableModes;

  @override
  bool get isOn => isRobotVacuumOn;
}
