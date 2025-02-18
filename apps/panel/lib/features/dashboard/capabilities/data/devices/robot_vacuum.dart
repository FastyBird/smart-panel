import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/leak.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/robot_vacuum.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/robot_vacuum.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';

class RobotVacuumDeviceCapability
    extends DeviceCapability<RobotVacuumDeviceDataModel>
    with
        DeviceBatteryMixin,
        DeviceDeviceInformationMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceLeakMixin {
  RobotVacuumDeviceCapability({
    required super.device,
    required super.capabilities,
  });

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
