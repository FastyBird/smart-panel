import 'package:fastybird_smart_panel/modules/devices/views/channels/battery.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/flow.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/leak.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/pressure.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/valve.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class ValveDeviceView extends DeviceView
    with
        DeviceDeviceInformationMixin,
        DeviceValveMixin,
        DeviceBatteryMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceFlowMixin,
        DeviceLeakMixin,
        DevicePressureMixin {
  ValveDeviceView({
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
    super.isValid,
    super.validationIssues,
  });

  @override
  DeviceInformationChannelView get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelView>().first;

  @override
  ValveChannelView get valveChannel =>
      channels.whereType<ValveChannelView>().first;

  @override
  BatteryChannelView? get batteryChannel =>
      channels.whereType<BatteryChannelView>().firstOrNull;

  @override
  ElectricalEnergyChannelView? get electricalEnergyChannel =>
      channels.whereType<ElectricalEnergyChannelView>().firstOrNull;

  @override
  ElectricalPowerChannelView? get electricalPowerChannel =>
      channels.whereType<ElectricalPowerChannelView>().firstOrNull;

  @override
  FlowChannelView? get flowChannel =>
      channels.whereType<FlowChannelView>().firstOrNull;

  @override
  LeakChannelView? get leakChannel =>
      channels.whereType<LeakChannelView>().firstOrNull;

  @override
  PressureChannelView? get pressureChannel =>
      channels.whereType<PressureChannelView>().firstOrNull;

  @override
  bool get isOn => valveChannel.on;
}
