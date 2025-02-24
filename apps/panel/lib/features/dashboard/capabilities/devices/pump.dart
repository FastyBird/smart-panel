import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/flow.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/leak.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/pressure.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/switcher.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/type.dart';
import 'package:flutter/cupertino.dart';
import 'package:material_symbols_icons/symbols.dart';

class PumpDeviceType extends DeviceType
    with
        DeviceDeviceInformationMixin,
        DeviceFlowMixin,
        DeviceSwitcherMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceLeakMixin,
        DevicePressureMixin {
  PumpDeviceType({
    required super.device,
    required super.capabilities,
  });

  @override
  IconData get icon => super.icon ?? Symbols.water_pump;

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
