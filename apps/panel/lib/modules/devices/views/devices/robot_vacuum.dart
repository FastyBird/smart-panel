import 'package:fastybird_smart_panel/modules/devices/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/battery.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/leak.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/robot_vacuum.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class RobotVacuumDeviceView extends DeviceView
    with
        DeviceBatteryMixin,
        DeviceDeviceInformationMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceLeakMixin {
  RobotVacuumDeviceView({
    required super.deviceModel,
    required super.channels,
  });

  @override
  BatteryChannelView get batteryChannel =>
      channels.whereType<BatteryChannelView>().first;

  @override
  DeviceInformationChannelView get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelView>().first;

  RobotVacuumChannelView get robotVacuumChannel =>
      channels.whereType<RobotVacuumChannelView>().first;

  @override
  ElectricalEnergyChannelView? get electricalEnergyChannel =>
      channels.whereType<ElectricalEnergyChannelView>().firstOrNull;

  @override
  ElectricalPowerChannelView? get electricalPowerChannel =>
      channels.whereType<ElectricalPowerChannelView>().firstOrNull;

  @override
  LeakChannelView? get leakChannel =>
      channels.whereType<LeakChannelView>().firstOrNull;

  bool get isRobotVacuumOn => robotVacuumChannel.on;

  RobotVacuumStatusValue get robotVacuumStatus => robotVacuumChannel.status;

  List<RobotVacuumStatusValue> get robotVacuumAvailableStatuses =>
      robotVacuumChannel.availableStatuses;

  bool get hasRobotVacuumMode => robotVacuumChannel.hasMode;

  RobotVacuumModeValue? get robotVacuumMode => robotVacuumChannel.mode;

  bool get hasRobotVacuumFault => robotVacuumChannel.hasFault;

  num? get robotVacuumFaultCode => robotVacuumChannel.faultCode;

  List<RobotVacuumModeValue> get robotVacuumAvailableModes =>
      robotVacuumChannel.availableModes;

  @override
  bool get isOn => isRobotVacuumOn;
}
