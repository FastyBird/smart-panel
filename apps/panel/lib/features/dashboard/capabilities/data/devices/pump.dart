import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/flow.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/leak.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/pressure.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/switcher.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/pump.dart';

class PumpDeviceCapability extends DeviceCapability<PumpDeviceDataModel>
    with
        DeviceDeviceInformationMixin,
        DeviceFlowMixin,
        DeviceSwitcherMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceLeakMixin,
        DevicePressureMixin {
  PumpDeviceCapability({
    required super.device,
    required super.capabilities,
  });

  @override
  DeviceInformationChannelCapability get deviceInformationCapability =>
      capabilities.whereType<DeviceInformationChannelCapability>().first;

  @override
  FlowChannelCapability get flowCapability =>
      capabilities.whereType<FlowChannelCapability>().first;

  @override
  SwitcherChannelCapability get switcherCapability =>
      capabilities.whereType<SwitcherChannelCapability>().first;

  @override
  ElectricalEnergyChannelCapability? get electricalEnergyCapability =>
      capabilities.whereType<ElectricalEnergyChannelCapability>().firstOrNull;

  @override
  ElectricalPowerChannelCapability? get electricalPowerCapability =>
      capabilities.whereType<ElectricalPowerChannelCapability>().firstOrNull;

  @override
  LeakChannelCapability? get leakCapability =>
      capabilities.whereType<LeakChannelCapability>().firstOrNull;

  @override
  PressureChannelCapability? get pressureCapability =>
      capabilities.whereType<PressureChannelCapability>().firstOrNull;

  @override
  bool get isOn => switcherCapability.on;
}
